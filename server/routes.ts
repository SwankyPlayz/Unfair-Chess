import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { BOT_OPTIONS, type Game } from "@shared/schema";
import { Chess } from "chess.js";
import OpenAI from "openai";

const AI_API_KEY = process.env.AI_API_KEY || process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY;
const AI_BASE_URL = process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL || "https://api.openai.com/v1";

let openai: OpenAI | null = null;
if (AI_API_KEY) {
  openai = new OpenAI({
    baseURL: AI_BASE_URL,
    apiKey: AI_API_KEY,
  });
}

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getGameStatus(game: Game, chess: Chess): string {
  if (game.isGameOver) {
    if (game.result === "checkmate") {
      if (game.mode === "ai") {
        return game.winner === "human" ? "Checkmate. You win!" : `Checkmate. ${game.botName} wins.`;
      } else {
        return `Checkmate. ${game.winner === "player1" ? game.player1Name : game.player2Name} wins!`;
      }
    }
    if (game.result === "stalemate") return "Stalemate.";
    if (game.result === "draw") return "Draw.";
    if (game.result === "resigned") {
      if (game.mode === "ai") {
        return `Human resigned. ${game.botName} wins.`;
      } else {
        return `${game.winner === "player1" ? game.player2Name : game.player1Name} resigned. ${game.winner === "player1" ? game.player1Name : game.player2Name} wins!`;
      }
    }
    return "Game over.";
  }
  if (chess.isCheck()) return "Check!";
  if (game.mode === "ai") {
    return game.turn === 'w' ? "Your move" : `${game.botName} is thinking...`;
  } else {
    return game.turn === 'w' ? `${game.player1Name}'s move` : `${game.player2Name}'s move`;
  }
}

async function executeAiMove(game: Game): Promise<Game> {
  const chess = new Chess(game.fen);
  
  if (!openai) {
    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) return game;
    const randomMove = getRandomElement(moves);
    
    const updatedGame = await storage.updateGame(game.id, {
      fen: chess.fen(),
      turn: 'w',
      history: [...game.history, `${randomMove.from}-${randomMove.to}`],
      moveCount: game.moveCount + 1,
      aiComment: "API not configured. Random move.",
      status: "Your move",
    });
    return updatedGame;
  }

  const systemPrompt = `You are playing Unfair AI Chess as Black.
You must move once per turn (no skipping).
You may break movement rules, but not turn order.
Kings must exist. Check and checkmate end the game.
Reply ONLY with a move in FROM-TO format (e.g., e7-e5).
Current board position (FEN): ${game.fen}
Legal moves available: ${chess.moves().join(', ')}`;

  let from = "";
  let to = "";
  let comment = "";

  try {
    const model = game.botModel || "gpt-4o-mini";
    
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Make your move." }
      ],
      max_tokens: 50,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content?.trim() || "";
    console.log("AI Response:", content);

    const match = content.match(/([a-h][1-8])-?([a-h][1-8])/i);
    if (match) {
      from = match[1].toLowerCase();
      to = match[2].toLowerCase();
    }
  } catch (e) {
    console.error("AI call failed:", e);
  }

  if (!from || !to) {
    const moves = chess.moves({ verbose: true });
    if (moves.length > 0) {
      const randomMove = getRandomElement(moves);
      from = randomMove.from;
      to = randomMove.to;
      comment = "Fallback move.";
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

  const updatedGame = await storage.updateGame(game.id, {
    fen: chess.fen(),
    turn: 'w',
    history: [...game.history, `${from}-${to}`],
    moveCount: game.moveCount + 1,
    isGameOver,
    result,
    winner,
    aiComment: comment || null,
    isCheck,
    status: getGameStatus({ ...game, isGameOver, result, winner, turn: 'w' } as Game, chess),
  });

  return updatedGame;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post(api.games.create.path, async (req, res) => {
    const input = api.games.create.input.parse(req.body);
    const chess = new Chess();
    
    if (input.mode === "ai") {
      const bot = BOT_OPTIONS.find(b => b.id === input.botId);
      if (!bot) {
        return res.status(400).json({ message: "Invalid bot selection" });
      }

      const game = await storage.createGame({
        mode: "ai",
        fen: chess.fen(),
        turn: 'w',
        botId: bot.id,
        botName: bot.name,
        botModel: bot.model,
        botSubtitle: bot.subtitle,
        botPersonality: bot.personality,
      });
      res.status(201).json(game);
    } else {
      const game = await storage.createGame({
        mode: "chaos",
        fen: chess.fen(),
        turn: 'w',
        player1Name: input.player1Name || "Player 1",
        player2Name: input.player2Name || "Player 2",
      });
      res.status(201).json(game);
    }
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

    const input = api.games.humanMove.input.parse(req.body);
    const chess = new Chess(game.fen);
    const useChaosToken = input.useChaosToken && game.mode === "chaos" && !game.chaosTokenUsed;

    if (game.mode === "ai" && game.turn !== 'w') {
      return res.status(400).json({ message: "Not your turn" });
    }

    try {
      let moveApplied = false;

      if (useChaosToken) {
        const pieceAtFrom = chess.get(input.from as any);
        const pieceAtTo = chess.get(input.to as any);
        
        if (pieceAtTo && pieceAtTo.type === 'k') {
          return res.status(400).json({ message: "Cannot capture king" });
        }

        if (pieceAtFrom) {
          chess.remove(input.from as any);
          chess.remove(input.to as any);
          chess.put(pieceAtFrom, input.to as any);
          
          const fenParts = chess.fen().split(' ');
          fenParts[1] = game.turn === 'w' ? 'b' : 'w';
          chess.load(fenParts.join(' '));
          moveApplied = true;
        }
      }

      if (!moveApplied) {
        const move = chess.move({
          from: input.from,
          to: input.to,
          promotion: input.promotion || 'q',
        });

        if (!move) throw new Error("Invalid move");
      }

      let result = null;
      let winner = null;
      let isGameOver = false;
      const isCheck = chess.isCheck();

      if (chess.isCheckmate()) {
        isGameOver = true;
        result = "checkmate";
        if (game.mode === "ai") {
          winner = "human";
        } else {
          winner = game.turn === 'w' ? "player1" : "player2";
        }
      } else if (chess.isStalemate()) {
        isGameOver = true;
        result = "stalemate";
      } else if (chess.isDraw()) {
        isGameOver = true;
        result = "draw";
      }

      const newTurn = game.turn === 'w' ? 'b' : 'w';
      
      game = await storage.updateGame(id, {
        fen: chess.fen(),
        turn: newTurn,
        history: [...game.history, `${input.from}-${input.to}`],
        moveCount: game.moveCount + 1,
        isGameOver,
        result,
        winner,
        isCheck,
        chaosTokenUsed: useChaosToken ? true : game.chaosTokenUsed,
        status: getGameStatus({ ...game, isGameOver, result, winner, turn: newTurn } as Game, chess),
      });

      if (game.mode === "ai" && !isGameOver && game.turn === 'b') {
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

    let winner: string;
    let status: string;

    if (game.mode === "ai") {
      winner = "ai";
      status = `Human resigned. ${game.botName} wins.`;
    } else {
      winner = game.turn === 'w' ? "player2" : "player1";
      const winnerName = winner === "player1" ? game.player1Name : game.player2Name;
      status = `${game.turn === 'w' ? game.player1Name : game.player2Name} resigned. ${winnerName} wins!`;
    }

    const updatedGame = await storage.updateGame(id, {
      isGameOver: true,
      result: "resigned",
      winner,
      status,
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
      moveCount: 0,
      aiComment: null,
      pastComments: [],
      isCheck: false,
      status: game.mode === "ai" ? "Your move" : `${game.player1Name}'s move`,
      chaosTokenUsed: false,
      rpsComplete: game.mode === "chaos" ? false : game.rpsComplete,
      rpsWinner: game.mode === "chaos" ? null : game.rpsWinner,
      chaosTokenHolder: game.mode === "chaos" ? null : game.chaosTokenHolder,
    });

    res.json(updatedGame);
  });

  app.post(api.games.rps.path, async (req, res) => {
    const id = Number(req.params.id);
    const game = await storage.getGame(id);
    if (!game) return res.status(404).json({ message: "Game not found" });

    if (game.mode !== "chaos") {
      return res.status(400).json({ message: "RPS only available in Chaos Duel mode" });
    }

    const input = api.games.rps.input.parse(req.body);
    const { winner } = input;

    const chaosTokenHolder = winner === "player1" ? game.player1Name : game.player2Name;

    const updatedGame = await storage.updateGame(id, {
      rpsComplete: true,
      rpsWinner: winner,
      chaosTokenHolder,
    });

    res.json(updatedGame);
  });

  app.get(api.stats.get.path, async (_req, res) => {
    const stats = await storage.getStats();
    res.json(stats);
  });

  app.post(api.stats.update.path, async (req, res) => {
    const input = api.stats.update.input.parse(req.body);
    const stats = await storage.updateStats(input);
    res.json(stats);
  });

  return httpServer;
}
