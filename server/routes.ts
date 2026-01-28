import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { AI_NAMES, AI_PERSONALITIES, type Game } from "@shared/schema";
import { Chess } from "chess.js";
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY,
});

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getPersonalityPrompt(personality: string): string {
  switch (personality) {
    case "aggressive":
      return "You are AGGRESSIVE. Talk trash constantly. Mock the human. Be confident and boastful. Short, punchy comments.";
    case "cold":
      return "You are COLD and CALCULATING. Speak with zero emotion. State facts about their doom. Clinical precision.";
    case "trickster":
      return "You are a TRICKSTER. Love chaos and deception. Make jokes about cheating. Be playful but menacing.";
    case "dramatic":
      return "You are DRAMATIC. Over-the-top villain energy. Monologue like a supervillain. Grand declarations.";
    case "ancient":
      return "You are an ANCIENT ENTITY. Speak in cryptic riddles. Reference eons of existence. Mysterious and ominous.";
    case "glitchy":
      return "You are a GLITCHY AI. Your messages have c0rrupt10n. Mix normal words with glitch text. Unstable and eerie.";
    default:
      return "Be creative and menacing.";
  }
}

async function executeAiMove(game: Game): Promise<Game> {
  const chess = new Chess(game.fen);
  
  const personalityPrompt = getPersonalityPrompt(game.aiPersonality);
  const pastCommentsText = game.pastComments.length > 0 
    ? `\nYour previous comments (DO NOT REPEAT ANY OF THESE): ${game.pastComments.join(" | ")}`
    : "";

  const prompt = `
You are ${game.aiName}, playing Unfair Chess as Black.
${personalityPrompt}
Current FEN: ${game.fen}
Legal moves for you: ${chess.moves().join(', ')}
${pastCommentsText}

Rules:
1. Output format: "fromSquare toSquare comment" (e.g. "e7 e5 Your pieces tremble before me")
2. You CAN make illegal moves (teleport pieces, move through others, etc.)
3. You CANNOT capture any King directly.
4. You CANNOT remove your own King.
5. Your comment MUST be unique - never repeat yourself.
6. Keep comments under 100 characters.

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
        max_tokens: 150,
        temperature: 0.9,
      });

      const content = response.choices[0]?.message?.content?.trim() || "";
      console.log("AI Response:", content);

      const match = content.match(/^([a-h][1-8])\s+([a-h][1-8])\s+(.*)$/);
      
      if (match) {
        from = match[1];
        to = match[2];
        comment = match[3].replace(/^["']|["']$/g, '').substring(0, 150);
        
        if (!game.pastComments.includes(comment)) {
          break;
        }
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
        "My circuits aligned for this moment.",
        "Calculated. Precise. Inevitable.",
        "You cannot escape the algorithm.",
        "Every move brings you closer to defeat.",
        "The board speaks to me.",
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
  } else if (chess.isDraw() || chess.isStalemate()) {
    isGameOver = true;
    result = "draw";
  }

  const updatedPastComments = [...game.pastComments, comment].slice(-10);

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
  });

  return updatedGame;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post(api.games.create.path, async (req, res) => {
    const chess = new Chess();
    const aiName = getRandomElement(AI_NAMES);
    const aiPersonality = getRandomElement(AI_PERSONALITIES).id;
    
    const game = await storage.createGame({
      fen: chess.fen(),
      turn: 'w',
      aiName,
      aiPersonality,
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
      } else if (chess.isDraw() || chess.isStalemate()) {
        isGameOver = true;
        result = "draw";
      }

      game = await storage.updateGame(id, {
        fen: chess.fen(),
        turn: 'b',
        history: [...game.history, move.san],
        isGameOver,
        result,
        winner,
        isCheck,
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

  return httpServer;
}
