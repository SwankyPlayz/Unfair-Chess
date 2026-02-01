import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { BOT_OPTIONS, FALLBACK_MODELS, type Game, type OnlineMatch } from "@shared/schema";
import { Chess } from "chess.js";
import OpenAI from "openai";

const AI_API_KEY = process.env.AI_API_KEY;
const AI_BASE_URL = "https://api.a4f.co/v1";
const AI_TIMEOUT_MS = 6000;
const AI_MAX_TOKENS = 40;
const AI_TEMPERATURE = 0.7;

let openai: OpenAI | null = null;
if (AI_API_KEY) {
  openai = new OpenAI({
    baseURL: AI_BASE_URL,
    apiKey: AI_API_KEY,
    timeout: AI_TIMEOUT_MS,
  });
  console.log("[AI] OpenAI client initialized with base URL:", AI_BASE_URL);
} else {
  console.error("[AI] WARNING: AI_API_KEY not found in environment variables!");
}

async function prewarmModels() {
  if (!openai) return;
  console.log("[AI PREWARM] Starting model pre-warming...");
  
  const models = BOT_OPTIONS.map(b => b.model);
  for (const model of models) {
    try {
      const start = Date.now();
      await Promise.race([
        openai.chat.completions.create({
          model,
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 5,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000))
      ]);
      console.log(`[AI PREWARM] ${model} warmed in ${Date.now() - start}ms`);
    } catch (e: any) {
      console.log(`[AI PREWARM] ${model} failed: ${e.message}`);
    }
  }
  console.log("[AI PREWARM] Complete");
}

interface AiMoveResult {
  from: string;
  to: string;
  comment: string;
  modelUsed: string;
  timeMs: number;
  fallbacksTriggered: string[];
}

async function callAiWithTimeout(model: string, prompt: string, legalMoves: string[]): Promise<{ move: string; comment: string } | null> {
  if (!openai) return null;
  
  const systemPrompt = `You play chess. Return ONE legal move and a short taunt (max 8 words).
Legal moves: ${legalMoves.join(', ')}
Format exactly:
MOVE: e2e4
TEXT: Nice try.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      max_tokens: AI_MAX_TOKENS,
      temperature: AI_TEMPERATURE,
    }, { signal: controller.signal });
    
    clearTimeout(timeout);
    
    const content = response.choices[0]?.message?.content?.trim() || "";
    
    const moveMatch = content.match(/MOVE:\s*([a-h][1-8][a-h][1-8])/i);
    const textMatch = content.match(/TEXT:\s*(.+)/i);
    
    if (moveMatch) {
      return {
        move: moveMatch[1].toLowerCase(),
        comment: textMatch ? textMatch[1].trim().substring(0, 50) : "..."
      };
    }
    
    const fallbackMove = content.match(/([a-h][1-8])[-]?([a-h][1-8])/i);
    if (fallbackMove) {
      return {
        move: fallbackMove[1].toLowerCase() + fallbackMove[2].toLowerCase(),
        comment: "Interesting move..."
      };
    }
    
    return null;
  } catch (e: any) {
    console.log(`[AI] ${model} failed: ${e.message}`);
    return null;
  }
}

async function getAiMoveWithFallback(game: Game): Promise<AiMoveResult> {
  const chess = new Chess(game.fen);
  const legalMoves = chess.moves({ verbose: true }).map(m => m.from + m.to);
  const prompt = `FEN: ${game.fen}\nMake your move.`;
  
  const modelsToTry = [
    game.botModel || "provider-3/deepseek-v3",
    ...FALLBACK_MODELS.filter(m => m !== game.botModel)
  ];
  
  const fallbacksTriggered: string[] = [];
  
  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    const startTime = Date.now();
    
    console.log(`[AI] Trying model ${i + 1}/${modelsToTry.length}: ${model}`);
    
    const result = await callAiWithTimeout(model, prompt, legalMoves);
    const timeMs = Date.now() - startTime;
    
    if (result && legalMoves.some(lm => lm === result.move || lm.startsWith(result.move))) {
      console.log(`[AI] Success with ${model} in ${timeMs}ms: ${result.move}`);
      return {
        from: result.move.substring(0, 2),
        to: result.move.substring(2, 4),
        comment: result.comment,
        modelUsed: model,
        timeMs,
        fallbacksTriggered
      };
    }
    
    if (i > 0) {
      fallbacksTriggered.push(modelsToTry[i - 1]);
    }
    console.log(`[AI] Model ${model} failed or returned invalid move, trying next...`);
  }
  
  console.log("[AI] All models failed, using random legal move");
  const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
  return {
    from: randomMove.substring(0, 2),
    to: randomMove.substring(2, 4),
    comment: "The AI is struggling... retrying",
    modelUsed: "fallback-random",
    timeMs: 0,
    fallbacksTriggered: modelsToTry
  };
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

async function executeAiMove(game: Game): Promise<Game> {
  const chess = new Chess(game.fen);
  
  if (!openai) {
    throw new Error("AI service not configured. Please set AI_API_KEY environment variable.");
  }

  console.log(`[AI] Starting move for ${game.botName} (${game.botModel})`);
  const startTime = Date.now();

  const aiResult = await getAiMoveWithFallback(game);
  
  console.log(`[AI RESULT] Model: ${aiResult.modelUsed}, Time: ${aiResult.timeMs}ms`);
  if (aiResult.fallbacksTriggered.length > 0) {
    console.log(`[AI FALLBACKS] Triggered: ${aiResult.fallbacksTriggered.join(', ')}`);
  }

  const { from, to, comment } = aiResult;

  const pieceAtFrom = chess.get(from as any);
  if (!pieceAtFrom) {
    console.error(`[AI] No piece at ${from}, using random move`);
    const legalMoves = chess.moves({ verbose: true });
    const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
    return executeAiMoveWithCoords(game, randomMove.from, randomMove.to, "Hmm...");
  }

  return executeAiMoveWithCoords(game, from, to, comment);
}

async function executeAiMoveWithCoords(game: Game, from: string, to: string, comment: string): Promise<Game> {
  const chess = new Chess(game.fen);

  let notation = "";
  let isIllegalMove = false;
  
  try {
    const move = chess.move({ from, to, promotion: 'q' });
    notation = move?.san || `${from}-${to}`;
    console.log(`[AI MOVE] Legal move applied: ${notation}`);
  } catch (e) {
    console.log(`[AI MOVE] Attempting illegal move: ${from}-${to}`);
    const piece = chess.remove(from as any);
    chess.remove(to as any);
    if (piece) {
      chess.put(piece, to as any);
      notation = `${from}-${to}*`;
      isIllegalMove = true;
    }
    const fenParts = chess.fen().split(' ');
    fenParts[1] = 'w';
    chess.load(fenParts.join(' '));
    console.log(`[AI MOVE] Illegal move applied: ${notation}`);
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
    aiComment: comment || "...",
    pastComments: [...game.pastComments, comment || "..."],
    isCheck,
    status: getGameStatus({ ...game, isGameOver, result, winner, turn: 'w' } as Game, chess),
  });

  console.log(`[AI COMPLETE] Game ${game.id} updated. GameOver: ${isGameOver}`);
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
      console.log(`[GAME CREATED] ID: ${game.id}, Bot: ${bot.name}, Model: ${bot.model}`);
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

      res.json(game);

      if (!isGameOver && game.turn === 'b') {
        try {
          await executeAiMove(game);
        } catch (aiError: any) {
          console.error("[AI MOVE ERROR]", aiError.message);
          await storage.updateGame(id, {
            status: `AI Error: ${aiError.message}`,
          });
        }
      }
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
    const timeControl = input.timeControl || "blitz";
    
    const existingMatch = await storage.getMatchByPlayerId(input.playerId);
    if (existingMatch) {
      return res.json({ status: "matched", roomId: existingMatch.roomId });
    }

    const opponent = await storage.findMatchInQueue(input.playerId, timeControl);
    
    if (opponent) {
      const match = await storage.createMatch(
        opponent.playerId,
        opponent.playerName,
        input.playerId,
        input.playerName,
        timeControl
      );
      return res.json({ status: "matched", roomId: match.roomId });
    }

    await storage.joinQueue(input.playerId, input.playerName, timeControl);
    return res.json({ status: "waiting" });
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

  app.post(api.matches.resign.path, async (req, res) => {
    const input = api.matches.resign.input.parse(req.body);
    let match = await storage.getMatch(String(req.params.roomId));
    if (!match) return res.status(404).json({ message: "Match not found" });

    if (match.isGameOver) {
      return res.status(400).json({ message: "Game already over" });
    }

    const isPlayer1 = input.playerId === match.player1Id;
    const winner = isPlayer1 ? match.player2Name : match.player1Name;

    match = await storage.updateMatch(match.roomId, {
      isGameOver: true,
      result: "resigned",
      winner,
    });

    res.json(match);
  });

  app.post(api.matches.offerDraw.path, async (req, res) => {
    const input = api.matches.offerDraw.input.parse(req.body);
    let match = await storage.getMatch(String(req.params.roomId));
    if (!match) return res.status(404).json({ message: "Match not found" });

    if (match.isGameOver) {
      return res.status(400).json({ message: "Game already over" });
    }

    if (input.action === "offer") {
      match = await storage.updateMatch(match.roomId, {
        drawOfferedBy: input.playerId,
      });
    } else if (input.action === "accept") {
      if (match.drawOfferedBy && match.drawOfferedBy !== input.playerId) {
        match = await storage.updateMatch(match.roomId, {
          isGameOver: true,
          result: "draw",
          drawOfferedBy: null,
        });
      }
    } else if (input.action === "decline") {
      match = await storage.updateMatch(match.roomId, {
        drawOfferedBy: null,
      });
    }

    res.json(match);
  });

  app.post(api.matches.chat.path, async (req, res) => {
    const input = api.matches.chat.input.parse(req.body);
    let match = await storage.getMatch(String(req.params.roomId));
    if (!match) return res.status(404).json({ message: "Match not found" });

    const newMessage = {
      playerId: input.playerId,
      message: input.message.substring(0, 200),
      timestamp: new Date().toISOString(),
    };

    const existingMessages = match.chatMessages || [];
    match = await storage.updateMatch(match.roomId, {
      chatMessages: [...existingMessages, newMessage],
    });

    res.json(match);
  });

  setTimeout(() => prewarmModels(), 1000);

  return httpServer;
}
