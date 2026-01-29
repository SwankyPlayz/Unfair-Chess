import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { BOT_OPTIONS, type Game } from "@shared/schema";
import { Chess } from "chess.js";
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY,
});

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getGameStatus(chess: Chess, isGameOver: boolean, result: string | null, winner: string | null, isAiTurn: boolean, botName: string): string {
  if (isGameOver) {
    if (result === "checkmate") {
      return winner === "human" ? "Checkmate. You win!" : `Checkmate. ${botName} wins.`;
    }
    if (result === "stalemate") return "Stalemate.";
    if (result === "draw") return "Draw.";
    if (result === "resigned") return `Human resigned. ${botName} wins.`;
    return "Game over.";
  }
  if (chess.isCheck()) return "Check!";
  if (isAiTurn) return `${botName} is thinking...`;
  return "Your move";
}

async function executeAiMove(game: Game): Promise<Game> {
  const chess = new Chess(game.fen);
  
  const pastCommentsText = game.pastComments.length > 0 
    ? `\nYour previous comments (DO NOT REPEAT ANY OF THESE EXACTLY): ${game.pastComments.slice(-5).join(" | ")}`
    : "";

  const prompt = `
You are ${game.botName}, an AI playing chess as Black in "Unfair Chess".
Personality: ${game.botPersonality}
Current FEN: ${game.fen}
Legal moves for you: ${chess.moves().join(', ')}
${pastCommentsText}

Rules:
1. Output format: "fromSquare toSquare comment" (e.g. "e7 e5 Interesting choice...")
2. You CAN make illegal moves (teleport pieces, move through others, etc.)
3. You CANNOT capture any King directly.
4. You CANNOT remove your own King.
5. Your comment MUST be unique and in character.
6. Keep comments under 80 characters.

Output EXACTLY one line.
`;

  let from = "";
  let to = "";
  let comment = "...";
  let retries = 0;
  const maxRetries = 2;

  while (retries <= maxRetries) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 120,
        temperature: 0.9,
      });

      const content = response.choices[0]?.message?.content?.trim() || "";
      console.log("AI Response:", content);

      const match = content.match(/^([a-h][1-8])\s+([a-h][1-8])\s+(.*)$/);
      
      if (match) {
        from = match[1];
        to = match[2];
        comment = match[3].replace(/^["']|["']$/g, '').substring(0, 100);
        
        const isDuplicate = game.pastComments.some(
          c => c.toLowerCase() === comment.toLowerCase()
        );
        if (!isDuplicate) break;
        retries++;
      } else {
        retries++;
      }
    } catch (e) {
      console.error("AI call failed:", e);
      retries++;
    }
  }

  if (!from || !to) {
    const moves = chess.moves({ verbose: true });
    if (moves.length > 0) {
      const randomMove = getRandomElement(moves);
      from = randomMove.from;
      to = randomMove.to;
      const fallbackComments = [
        "A calculated move.",
        "Let me think about this...",
        "Interesting position.",
        "The game continues.",
        "Your turn.",
      ];
      comment = getRandomElement(fallbackComments.filter(c => !game.pastComments.includes(c))) || "...";
    } else {
      return game;
    }
  }

  const pieceAtFrom = chess.get(from as any);
  const pieceAtTo = chess.get(to as any);

  if (!pieceAtFrom) {
    const moves = chess.moves({ verbose: true });
    if (moves.length > 0) {
      const randomMove = getRandomElement(moves);
      from = randomMove.from;
      to = randomMove.to;
    }
  }

  if (pieceAtTo && pieceAtTo.type === 'k') {
    const moves = chess.moves({ verbose: true });
    if (moves.length > 0) {
      const randomMove = getRandomElement(moves);
      from = randomMove.from;
      to = randomMove.to;
      comment = "The king lives... for now.";
    }
  }

  try {
    chess.move({ from, to, promotion: 'q' });
  } catch (e) {
    const piece = chess.remove(from as any);
    chess.remove(to as any);
    if (piece) {
      chess.put(piece, to as any);
    }
    const fenParts = chess.fen().split(' ');
    fenParts[1] = 'w';
    const newFen = fenParts.join(' ');
    chess.load(newFen);
  }

  let result = null;
  let winner = null;
  let isGameOver = false;
  const isCheck = chess.isCheck();

  if (chess.isCheckmate()) {
    isGameOver = true;
    result = "checkmate";
    winner = chess.turn() === 'w' ? 'ai' : 'human';
  } else if (chess.isStalemate()) {
    isGameOver = true;
    result = "stalemate";
  } else if (chess.isDraw()) {
    isGameOver = true;
    result = "draw";
  }

  const updatedPastComments = [...game.pastComments, comment].slice(-10);
  const status = getGameStatus(chess, isGameOver, result, winner, false, game.botName);

  const updatedGame = await storage.updateGame(game.id, {
    fen: chess.fen(),
    turn: 'w',
    history: [...game.history, `${from}-${to}`],
    isGameOver,
    result,
    winner,
    aiComment: comment,
    pastComments: updatedPastComments,
    isCheck,
    status,
  });

  return updatedGame;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post(api.games.create.path, async (req, res) => {
    const input = api.games.create.input.parse(req.body);
    const bot = BOT_OPTIONS.find(b => b.id === input.botId);
    
    if (!bot) {
      return res.status(400).json({ message: "Invalid bot selection" });
    }

    const chess = new Chess();
    
    const game = await storage.createGame({
      fen: chess.fen(),
      turn: 'w',
      botId: bot.id,
      botName: bot.name,
      botPersonality: bot.personality,
    });
    res.status(201).json(game);
  });

  app.get(api.games.get.path, async (req, res) => {
    const game = await storage.getGame(Number(req.params.id));
    if (!game) return res.status(404).json({ message: "Game not found" });
    res.json(game);
  });

  app.post(api.games.humanMove.path, async (req, res) => {
    const id = Number(req.params.id);
    let game = await storage.getGame(id);
    if (!game) return res.status(404).json({ message: "Game not found" });

    if (game.isGameOver) return res.status(400).json({ message: "Game is over" });
    if (game.turn !== 'w') return res.status(400).json({ message: "Not your turn" });

    const input = api.games.humanMove.input.parse(req.body);
    const chess = new Chess(game.fen);

    try {
      const move = chess.move({
        from: input.from,
        to: input.to,
        promotion: input.promotion || 'q',
      });

      if (!move) throw new Error("Invalid move");

      let result = null;
      let winner = null;
      let isGameOver = false;
      const isCheck = chess.isCheck();

      if (chess.isCheckmate()) {
        isGameOver = true;
        result = "checkmate";
        winner = "human";
      } else if (chess.isStalemate()) {
        isGameOver = true;
        result = "stalemate";
      } else if (chess.isDraw()) {
        isGameOver = true;
        result = "draw";
      }

      const status = isGameOver 
        ? getGameStatus(chess, isGameOver, result, winner, false, game.botName)
        : `${game.botName} is thinking...`;

      game = await storage.updateGame(id, {
        fen: chess.fen(),
        turn: 'b',
        history: [...game.history, move.san],
        isGameOver,
        result,
        winner,
        isCheck,
        status,
      });

      if (!isGameOver) {
        game = await executeAiMove(game);
      }

      res.json(game);
    } catch (e) {
      return res.status(400).json({ message: "Illegal move" });
    }
  });

  app.post(api.games.aiMove.path, async (req, res) => {
    const id = Number(req.params.id);
    const game = await storage.getGame(id);
    if (!game) return res.status(404).json({ message: "Game not found" });

    if (game.isGameOver) return res.status(400).json({ message: "Game is over" });
    if (game.turn !== 'b') return res.status(400).json({ message: "Not AI's turn" });

    try {
      const updatedGame = await executeAiMove(game);
      res.json(updatedGame);
    } catch (error) {
      console.error("AI Error:", error);
      res.status(500).json({ message: "AI failed to think" });
    }
  });

  app.post(api.games.resign.path, async (req, res) => {
    const id = Number(req.params.id);
    const game = await storage.getGame(id);
    if (!game) return res.status(404).json({ message: "Game not found" });

    if (game.isGameOver) return res.status(400).json({ message: "Game is already over" });

    const updatedGame = await storage.updateGame(id, {
      isGameOver: true,
      result: "resigned",
      winner: "ai",
      status: `Human resigned. ${game.botName} wins.`,
    });

    res.json(updatedGame);
  });

  app.post(api.games.reset.path, async (req, res) => {
    const id = Number(req.params.id);
    const game = await storage.getGame(id);
    if (!game) return res.status(404).json({ message: "Game not found" });

    const chess = new Chess();
    
    const updatedGame = await storage.updateGame(id, {
      fen: chess.fen(),
      turn: 'w',
      isGameOver: false,
      result: null,
      winner: null,
      history: [],
      aiComment: null,
      pastComments: [],
      isCheck: false,
      status: "Your move",
    });

    res.json(updatedGame);
  });

  return httpServer;
}
