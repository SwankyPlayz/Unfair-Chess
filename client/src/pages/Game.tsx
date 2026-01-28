import { useEffect, useState, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { Chess, Move } from "chess.js";
import { Chessboard } from "react-chessboard";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Terminal, Cpu, RotateCcw } from "lucide-react";

import { useGame, useHumanMove, useAiMove } from "@/hooks/use-game";
import { RetroButton } from "@/components/ui/RetroButton";
import { GameCard, TerminalCard } from "@/components/ui/GameCard";
import { type Game } from "@shared/schema";

export default function GamePage() {
  const [, params] = useRoute("/game/:id");
  const id = Number(params?.id);
  const [, setLocation] = useLocation();
  const { data: game, isLoading, error } = useGame(id);

  if (isLoading) return <LoadingScreen />;
  if (error || !game) return <ErrorScreen error={error} />;

  return <GameInterface game={game} />;
}

function GameInterface({ game }: { game: Game }) {
  const [chess] = useState(new Chess(game.fen));
  const [fen, setFen] = useState(game.fen);
  
  const { mutate: humanMove, isPending: isMoving } = useHumanMove();
  const { mutate: aiMove, isPending: isAiThinking } = useAiMove();

  // Sync local chess instance with backend FEN
  useEffect(() => {
    try {
      // Create a temp instance to validate FEN before applying
      // AI might send weird FENs, we need to handle them gracefully if possible
      // But mostly we just trust backend FEN
      const newGame = new Chess(game.fen);
      setFen(game.fen);
      // We don't necessarily update 'chess' state variable because react-chessboard takes 'position' prop
      // However, for onDrop validation, we need a chess instance that matches current board
      chess.load(game.fen);
    } catch (e) {
      console.error("Invalid FEN from server:", game.fen);
    }
  }, [game.fen, chess]);

  // Handle Drag & Drop
  function onDrop(sourceSquare: string, targetSquare: string, piece: string) {
    if (game.turn !== 'w' || game.isGameOver) return false;

    try {
      // Validate move locally first
      const move = chess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q", // always promote to queen for simplicity in drag/drop
      });

      if (!move) return false;

      // Optimistic update
      setFen(chess.fen());

      // Send to backend
      humanMove({ 
        gameId: game.id, 
        move: { from: sourceSquare, to: targetSquare, promotion: "q" } 
      }, {
        onError: () => {
          // Revert on error
          chess.undo();
          setFen(chess.fen());
        }
      });

      return true;
    } catch (e) {
      return false;
    }
  }

  const isPlayerTurn = game.turn === 'w' && !game.isGameOver;
  const isAiTurn = game.turn === 'b' && !game.isGameOver;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 flex flex-col md:flex-row gap-8 items-center justify-center relative overflow-hidden">
      {/* Ambience */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
      
      {/* Left Panel: Game Info & Terminal */}
      <div className="w-full max-w-md space-y-6 order-2 md:order-1">
        <GameCard>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-display font-bold text-white flex items-center gap-2">
                    <Cpu className={isAiTurn ? "text-destructive animate-pulse" : "text-muted-foreground"} />
                    MATCH STATUS
                </h2>
                <div className={`px-3 py-1 rounded-full text-xs font-bold font-mono border ${
                    game.isGameOver ? "bg-muted text-white border-white" :
                    isPlayerTurn ? "bg-primary/20 text-primary border-primary/50" : "bg-destructive/20 text-destructive border-destructive/50"
                }`}>
                    {game.isGameOver ? "GAME OVER" : isPlayerTurn ? "PLAYER TURN" : "AI TURN"}
                </div>
            </div>

            {game.isGameOver && (
                <div className="mb-6 p-4 rounded bg-white/5 border border-white/10 text-center">
                    <h3 className="text-xl font-bold mb-1 text-white">
                        {game.result === 'checkmate' ? "CHECKMATE" : "GAME OVER"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        {game.turn === 'w' ? "The AI has defeated you." : "You defeated the AI... for now."}
                    </p>
                </div>
            )}

            <TerminalCard title="AI_LOGIC_CORE.log" className="h-64 mb-6">
                <div className="space-y-4">
                    {game.history && game.history.length === 0 && (
                        <p className="text-muted-foreground">Waiting for game start...</p>
                    )}
                    {game.aiComment && (
                        <div className="text-destructive font-bold animate-in fade-in slide-in-from-left-2 duration-300">
                            <span className="text-xs opacity-50 mr-2">[AI]:</span>
                            "{game.aiComment}"
                        </div>
                    )}
                    {isAiThinking && (
                        <div className="text-primary animate-pulse">
                            <span className="text-xs opacity-50 mr-2">[SYS]:</span>
                            Calculating unfair advantage...
                        </div>
                    )}
                </div>
            </TerminalCard>

            <AnimatePresence>
                {isAiTurn && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                    >
                        <RetroButton 
                            variant="destructive" 
                            className="w-full"
                            onClick={() => aiMove({ gameId: game.id })}
                            isLoading={isAiThinking}
                            disabled={isAiThinking}
                        >
                            {isAiThinking ? "AI IS CHEATING..." : "TRIGGER AI MOVE"}
                        </RetroButton>
                        <p className="text-xs text-center text-muted-foreground mt-2">
                            * AI may break rules. Prepare yourself.
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </GameCard>
      </div>

      {/* Right Panel: Board */}
      <div className="w-full max-w-[600px] order-1 md:order-2">
        <div className="relative aspect-square">
            {/* Board Glow Effect */}
            <div className={`absolute -inset-4 rounded-xl opacity-30 blur-2xl transition-colors duration-1000 ${
                isAiTurn ? "bg-destructive" : "bg-primary"
            }`} />
            
            <div className="relative z-10 rounded-lg overflow-hidden shadow-2xl border-4 border-card bg-card">
                <Chessboard 
                    position={fen} 
                    onPieceDrop={onDrop}
                    boardOrientation="white"
                    arePiecesDraggable={isPlayerTurn}
                    customDarkSquareStyle={{ backgroundColor: "#1e293b" }}
                    customLightSquareStyle={{ backgroundColor: "#cbd5e1" }}
                    animationDuration={300}
                />
            </div>
        </div>
      </div>
    </div>
  );
}

function LoadingScreen() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center flex-col gap-4">
            <Cpu className="w-12 h-12 text-primary animate-pulse" />
            <p className="font-mono text-primary animate-pulse">INITIALIZING BOARD...</p>
        </div>
    );
}

function ErrorScreen({ error }: { error: any }) {
    const [, setLocation] = useLocation();
    return (
        <div className="min-h-screen bg-background flex items-center justify-center flex-col gap-6 p-4">
            <AlertCircle className="w-16 h-16 text-destructive" />
            <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold text-white">System Failure</h1>
                <p className="text-muted-foreground">{error?.message || "Unknown error occurred"}</p>
            </div>
            <RetroButton onClick={() => setLocation("/")} variant="ghost">
                <RotateCcw className="w-4 h-4 mr-2" />
                Return to Lobby
            </RetroButton>
        </div>
    );
}
