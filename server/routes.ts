import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { BOT_OPTIONS, type Game, type OnlineMatch } from "@shared/schema";
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

function getMoveNotation(chess: Chess, from: string, to: string, piece: string): string {
  const pieceSymbols: Record<string, string> = { k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N', p: '' };
  const prefix = pieceSymbols[piece.toLowerCase()] || '';
  return `${prefix}${from}-${to}`;
}

function getGameStatus(game: Game, chess: Chess): string {
  if (game.isGameOver) {
    if (game.result === "checkmate") {
      return game.winner === "human" ? "Checkmate. You win!" : `Checkmate. ${game.botName} wins.`;
    }
    if (game.result === "stalemate") return "Stalemate.";
    if (game.result === "draw") return "Draw.";
    if (game.result === "resigned") return `You resigned. ${game.botName} wins.`;
    return "Game over.";
  }
  if (chess.isCheck()) return "Check!";
  return game.turn === 'w' ? "Your move" : `${game.botName} is thinking...`;
}

const AI_COMMENTS = {
  taunt: [
    "Nice move... for a beginner.",
    "Is that the best you've got?",
    "Interesting choice. Very interesting.",
    "You're making this too easy.",
    "I expected more from you.",
  ],
  neutral: [
    "Hmm, let me think...",
    "A solid move.",
    "Interesting position.",
    "The game develops nicely.",
  ],
  impressed: [
    "Not bad, human!",
    "You surprise me.",
    "A clever move indeed.",
    "Well played.",
  ],
};

async function executeAiMove(game: Game): Promise<Game> {
  const chess = new Chess(game.fen);
  
  let from = "";
  let to = "";
  let comment = getRandomElement([...AI_COMMENTS.taunt, ...AI_COMMENTS.neutral]);

  if (openai) {
    try {
      const model = game.botModel || "gpt-4o-mini";
      
      const response = await openai.chat.completions.create({
        model: model,
        messages: [
          { 
            role: "system", 
            content: `You are ${game.botName}, playing Unfair Chess as Black. Reply with ONLY a move in "e7-e5" format. Current FEN: ${game.fen}. Legal moves: ${chess.moves().join(', ')}` 
          },
          { role: "user", content: "Make your move." }
        ],
        max_tokens: 20,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content?.trim() || "";
      const match = content.match(/([a-h][1-8])-?([a-h][1-8])/i);
      if (match) {
        from = match[1].toLowerCase();
        to = match[2].toLowerCase();
      }
    } catch (e) {
      console.error("AI call failed:", e);
    }
  }

  if (!from || !to) {
    const moves = chess.moves({ verbose: true });
    if (moves.length > 0) {
      const randomMove = getRandomElement(moves);
      from = randomMove.from;
      to = randomMove.to;
    } else {
      return game;
    }
  }

  const pieceAtFrom = chess.get(from as any);
  const pieceAtTo = chess.get(to as any);

  if (!pieceAtFrom || (pieceAtTo && pieceAtTo.type === 'k')) {
    const moves = chess.moves({ verbose: true });
    if (moves.length > 0) {
      const randomMove = getRandomElement(moves);
      from = randomMove.from;
      to = randomMove.to;
    }
  }

  let notation = "";
  try {
    const move = chess.move({ from, to, promotion: 'q' });
    notation = move?.san || `${from}-${to}`;
  } catch (e) {
    const piece = chess.remove(from as any);
    chess.remove(to as any);
    if (piece) {
      chess.put(piece, to as any);
      notation = `${from}-${to}*`;
    }
    const fenParts = chess.fen().split(' ');
    fenParts[1] = 'w';
    chess.load(fenParts.join(' '));
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
    moveNotations: [...game.moveNotations, notation],
    moveCount: game.moveCount + 1,
    isGameOver,
    result,
    winner,
    aiComment: comment,
    pastComments: [...game.pastComments, comment],
    isCheck,
    status: getGameStatus({ ...game, isGameOver, result, winner, turn: 'w' } as Game, chess),
  });

  return updatedGame;
}

function determineRpsWinner(p1: string, p2: string): "player1" | "player2" | "tie" {
  if (p1 === p2) return "tie";
  if (
    (p1 === "rock" && p2 === "scissors") ||
    (p1 === "paper" && p2 === "rock") ||
    (p1 === "scissors" && p2 === "paper")
  ) {
    return "player1";
  }
  return "player2";
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post(api.games.create.path, async (req, res) => {
    const input = api.games.create.input.parse(req.body);
    const chess = new Chess();
    
    if (input.mode === "bot") {
      const bot = BOT_OPTIONS.find(b => b.id === input.botId);
      if (!bot) {
        return res.status(400).json({ message: "Invalid bot selection" });
      }

      const game = await storage.createGame({
        mode: "bot",
        fen: chess.fen(),
        turn: 'w',
        botId: bot.id,
        botName: bot.name,
        botModel: bot.model,
        botSubtitle: bot.subtitle,
        botPersonality: bot.personality,
        playerName: input.playerName || "Player",
        playerColor: input.playerColor || "white",
      });
      res.status(201).json(game);
    } else {
      res.status(400).json({ message: "Use matchmaking for online games" });
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

    if (game.turn !== 'w') {
      return res.status(400).json({ message: "Not your turn" });
    }

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
      
      game = await storage.updateGame(id, {
        fen: chess.fen(),
        turn: 'b',
        history: [...game.history, `${input.from}-${input.to}`],
        moveNotations: [...game.moveNotations, move.san],
        moveCount: game.moveCount + 1,
        isGameOver,
        result,
        winner,
        isCheck,
        aiComment: null,
        status: isGameOver ? getGameStatus({ ...game, isGameOver, result, winner } as Game, chess) : `${game.botName} is thinking...`,
      });

      if (!isGameOver && game.turn === 'b') {
        game = await executeAiMove(game);
      }

      res.json(game);
    } catch (e) {
      return res.status(400).json({ message: "Illegal move" });
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
      status: `You resigned. ${game.botName} wins.`,
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
      moveNotations: [],
      moveCount: 0,
      aiComment: null,
      pastComments: [],
      isCheck: false,
      status: "Your move",
    });

    res.json(updatedGame);
  });

  app.post(api.matchmaking.join.path, async (req, res) => {
    const input = api.matchmaking.join.input.parse(req.body);
    
    const existingMatch = await storage.getMatchByPlayerId(input.playerId);
    if (existingMatch) {
      return res.json({ status: "matched", roomId: existingMatch.roomId });
    }

    const opponent = await storage.findMatchInQueue(input.playerId);
    
    if (opponent) {
      const match = await storage.createMatch(
        opponent.playerId,
        opponent.playerName,
        input.playerId,
        input.playerName
      );
      return res.json({ status: "matched", roomId: match.roomId });
    }

    await storage.joinQueue(input.playerId, input.playerName);
    res.json({ status: "waiting" });
  });

  app.post(api.matchmaking.leave.path, async (req, res) => {
    const input = api.matchmaking.leave.input.parse(req.body);
    await storage.leaveQueue(input.playerId);
    res.json({ status: "left" });
  });

  app.get(api.matchmaking.status.path, async (req, res) => {
    const playerId = String(req.params.playerId);
    
    const match = await storage.getMatchByPlayerId(playerId);
    if (match) {
      return res.json({ status: "matched", roomId: match.roomId, match });
    }

    const queueEntry = await storage.getQueueEntry(playerId);
    if (queueEntry) {
      return res.json({ status: "waiting" });
    }

    res.json({ status: "idle" });
  });

  app.get(api.matches.get.path, async (req, res) => {
    const match = await storage.getMatch(String(req.params.roomId));
    if (!match) return res.status(404).json({ message: "Match not found" });
    res.json(match);
  });

  app.post(api.matches.rps.path, async (req, res) => {
    const input = api.matches.rps.input.parse(req.body);
    let match = await storage.getMatch(String(req.params.roomId));
    if (!match) return res.status(404).json({ message: "Match not found" });

    if (match.phase !== "rps") {
      return res.status(400).json({ message: "RPS phase is over" });
    }

    const updates: Partial<OnlineMatch> = {};
    
    if (input.playerId === match.player1Id) {
      updates.player1Rps = input.choice;
    } else if (input.playerId === match.player2Id) {
      updates.player2Rps = input.choice;
    } else {
      return res.status(400).json({ message: "Invalid player" });
    }

    match = await storage.updateMatch(match.roomId, updates);

    if (match.player1Rps && match.player2Rps) {
      const winner = determineRpsWinner(match.player1Rps, match.player2Rps);
      
      if (winner !== "tie") {
        const tokenHolder = winner === "player1" ? match.player1Name : match.player2Name;
        match = await storage.updateMatch(match.roomId, {
          phase: "playing",
          rpsWinner: winner,
          chaosTokenHolder: tokenHolder,
        });
      } else {
        match = await storage.updateMatch(match.roomId, {
          player1Rps: null,
          player2Rps: null,
          rpsDeadline: new Date(Date.now() + 60000),
        });
      }
    }

    res.json(match);
  });

  app.post(api.matches.move.path, async (req, res) => {
    const input = api.matches.move.input.parse(req.body);
    let match = await storage.getMatch(String(req.params.roomId));
    if (!match) return res.status(404).json({ message: "Match not found" });

    if (match.phase !== "playing") {
      return res.status(400).json({ message: "Game not started" });
    }

    if (match.isGameOver) {
      return res.status(400).json({ message: "Game is over" });
    }

    const isPlayer1Turn = match.turn === "w";
    const currentPlayerId = isPlayer1Turn ? match.player1Id : match.player2Id;
    
    if (input.playerId !== currentPlayerId) {
      return res.status(400).json({ message: "Not your turn" });
    }

    const chess = new Chess(match.fen);
    const useChaosToken = input.useChaosToken && !match.chaosTokenUsed;

    try {
      let moveApplied = false;
      let notation = "";

      if (useChaosToken) {
        const canUseToken = (isPlayer1Turn && match.chaosTokenHolder === match.player1Name) ||
                           (!isPlayer1Turn && match.chaosTokenHolder === match.player2Name);
        
        if (canUseToken) {
          const pieceAtFrom = chess.get(input.from as any);
          const pieceAtTo = chess.get(input.to as any);
          
          if (pieceAtTo && pieceAtTo.type === 'k') {
            return res.status(400).json({ message: "Cannot capture king" });
          }
          if (pieceAtFrom && pieceAtFrom.type === 'k') {
            return res.status(400).json({ message: "Cannot move king illegally" });
          }

          if (pieceAtFrom) {
            chess.remove(input.from as any);
            chess.remove(input.to as any);
            chess.put(pieceAtFrom, input.to as any);
            
            const fenParts = chess.fen().split(' ');
            fenParts[1] = match.turn === 'w' ? 'b' : 'w';
            chess.load(fenParts.join(' '));
            moveApplied = true;
            notation = `${input.from}-${input.to}*`;
          }
        }
      }

      if (!moveApplied) {
        const move = chess.move({
          from: input.from,
          to: input.to,
          promotion: input.promotion || 'q',
        });

        if (!move) throw new Error("Invalid move");
        notation = move.san;
      }

      let result = null;
      let winner = null;
      let isGameOver = false;

      if (chess.isCheckmate()) {
        isGameOver = true;
        result = "checkmate";
        winner = isPlayer1Turn ? match.player1Name : match.player2Name;
      } else if (chess.isStalemate()) {
        isGameOver = true;
        result = "stalemate";
      } else if (chess.isDraw()) {
        isGameOver = true;
        result = "draw";
      }

      match = await storage.updateMatch(match.roomId, {
        fen: chess.fen(),
        turn: match.turn === 'w' ? 'b' : 'w',
        history: [...match.history, `${input.from}-${input.to}`],
        moveNotations: [...match.moveNotations, notation],
        isGameOver,
        result,
        winner,
        chaosTokenUsed: useChaosToken ? true : match.chaosTokenUsed,
      });

      res.json(match);
    } catch (e) {
      return res.status(400).json({ message: "Illegal move" });
    }
  });

  return httpServer;
}
