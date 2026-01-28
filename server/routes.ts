import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { Chess } from "chess.js";
import OpenAI from "openai";

// OpenRouter client (via Replit AI Integrations)
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Create Game
  app.post(api.games.create.path, async (req, res) => {
    const chess = new Chess();
    const game = await storage.createGame({
      fen: chess.fen(),
      turn: 'w',
    });
    res.status(201).json(game);
  });

  // Get Game
  app.get(api.games.get.path, async (req, res) => {
    const game = await storage.getGame(Number(req.params.id));
    if (!game) return res.status(404).json({ message: "Game not found" });
    res.json(game);
  });

  // Human Move
  app.post(api.games.humanMove.path, async (req, res) => {
    const id = Number(req.params.id);
    const game = await storage.getGame(id);
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

      // Check game over status after move
      let result = null;
      let isGameOver = false;
      if (chess.isCheckmate()) {
        isGameOver = true;
        result = "checkmate";
      } else if (chess.isDraw() || chess.isStalemate()) {
        isGameOver = true;
        result = "draw";
      }

      const updatedGame = await storage.updateGame(id, {
        fen: chess.fen(),
        turn: 'b', // Pass to AI
        history: [...game.history, move.san],
        isGameOver,
        result,
      });

      res.json(updatedGame);
    } catch (e) {
      return res.status(400).json({ message: "Illegal move" });
    }
  });

  // AI Move
  app.post(api.games.aiMove.path, async (req, res) => {
    const id = Number(req.params.id);
    const game = await storage.getGame(id);
    if (!game) return res.status(404).json({ message: "Game not found" });

    if (game.isGameOver) return res.status(400).json({ message: "Game is over" });
    if (game.turn !== 'b') return res.status(400).json({ message: "Not AI's turn" });

    const chess = new Chess(game.fen);

    // Prompt construction
    const prompt = `
You are playing Unfair Chess. You are Black.
Current FEN: ${game.fen}
Legal moves: ${chess.moves().join(', ')}

Rules for you (AI):
1. You MUST output a move in format: "fromSquare toSquare comment" (e.g. "e7 e5 I will crush you")
2. You CAN make illegal moves (e.g. move a knight like a rook, capture own pieces).
3. You CANNOT capture the White King directly (game ends on checkmate only).
4. You CANNOT remove your own King.
5. Be creative and unfair if you want, or play normally.
6. Provide a short, trash-talking comment.

Output EXACTLY one line.
`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Or allow user selection if we had that. Using efficient model.
        messages: [{ role: "system", content: prompt }],
        max_tokens: 100,
      });

      const content = response.choices[0]?.message?.content?.trim() || "";
      console.log("AI Response:", content);

      // Parse response: "e7 e5 comment..."
      // Regex to capture from, to, and rest
      const match = content.match(/^([a-h][1-8])\s+([a-h][1-8])\s+(.*)$/);
      
      let from = "";
      let to = "";
      let comment = "Thinking...";

      if (match) {
        from = match[1];
        to = match[2];
        comment = match[3];
      } else {
        // Fallback: Random legal move if parse fails
        const moves = chess.moves({ verbose: true });
        if (moves.length > 0) {
          const randomMove = moves[Math.floor(Math.random() * moves.length)];
          from = randomMove.from;
          to = randomMove.to;
          comment = "I decided to play by the rules for once.";
        } else {
            // No moves? Checkmate? Should have been caught earlier.
            return res.status(500).json({ message: "AI has no moves" });
        }
      }

      // Apply move (Forcefully if needed)
      // Check if it involves Kings
      const pieceAtFrom = chess.get(from as any);
      const pieceAtTo = chess.get(to as any);

      if (!pieceAtFrom) {
         // Fallback if AI tries to move empty square
         const moves = chess.moves({ verbose: true });
         const randomMove = moves[Math.floor(Math.random() * moves.length)];
         from = randomMove.from;
         to = randomMove.to;
         comment = "My magic failed, normal move.";
      }

      // Prevent King Deletion
      if (pieceAtTo && pieceAtTo.type === 'k') {
          // Illegal to capture king directly in chess (should be checkmate). 
          // But "Unfair Chess" says "Game ENDS on checkmate". 
          // "King in check with no legal escape -> CHECKMATE".
          // If AI simply captures the king, the game state is broken.
          // I will prevent capturing king.
          comment = "I wanted to take your king, but the rules forbid it.";
          // Pick a random legal move instead
          const moves = chess.moves({ verbose: true });
          const randomMove = moves[Math.floor(Math.random() * moves.length)];
          from = randomMove.from;
          to = randomMove.to;
      }

      // Try legal move first
      try {
        chess.move({ from, to, promotion: 'q' });
      } catch (e) {
        // Illegal move logic
        // Manual board update
        const piece = chess.remove(from as any);
        chess.remove(to as any); // Remove target (capture)
        if (piece) {
            chess.put(piece, to as any);
        }
        
        // Update turn manually because .move() didn't run
        // chess.js doesn't easily let us toggle turn if we manipulate board directly
        // We might need to load FEN, manipulate, and generate new FEN with swapped turn.
        const fenParts = chess.fen().split(' ');
        fenParts[1] = 'w'; // Force turn to white
        // Also need to update en passant, castling if we want to be perfect, but chaos is fine.
        const newFen = fenParts.join(' ');
        chess.load(newFen);
      }

      // Check game over
      let result = null;
      let isGameOver = false;
      if (chess.isCheckmate()) {
        isGameOver = true;
        result = "checkmate"; // AI wins
      }

      const updatedGame = await storage.updateGame(id, {
        fen: chess.fen(),
        turn: 'w',
        history: [...game.history, `${from}-${to}`],
        isGameOver,
        result,
        aiComment: comment,
      });

      res.json(updatedGame);

    } catch (error) {
      console.error("AI Error:", error);
      res.status(500).json({ message: "AI failed to think" });
    }
  });

  return httpServer;
}
