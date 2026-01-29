import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { motion } from "framer-motion";
import { AlertCircle, Cpu, RotateCcw, User, Flag } from "lucide-react";

import { useGame, useHumanMove, useResignGame, useResetGame } from "@/hooks/use-game";
import { RetroButton } from "@/components/ui/RetroButton";
import { type Game } from "@shared/schema";

export default function GamePage() {
  const [, params] = useRoute("/game/:id");
  const id = Number(params?.id);
  const { data: game, isLoading, error } = useGame(id);

  if (isLoading) return <LoadingScreen />;
  if (error || !game) return <ErrorScreen error={error} />;

  return <GameInterface game={game} />;
}

function GameInterface({ game }: { game: Game }) {
  const [chess] = useState(new Chess(game.fen));
  const [fen, setFen] = useState(game.fen);
  
  const { mutate: humanMove, isPending: isMoving } = useHumanMove();
  const { mutate: resignGame, isPending: isResigning } = useResignGame();
  const { mutate: resetGame, isPending: isResetting } = useResetGame();

  useEffect(() => {
    try {
      setFen(game.fen);
      chess.load(game.fen);
    } catch (e) {
      console.error("Invalid FEN from server:", game.fen);
    }
  }, [game.fen, chess]);

  function onDrop(sourceSquare: string, targetSquare: string) {
    if (game.turn !== 'w' || game.isGameOver || isMoving) return false;

    try {
      const move = chess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (!move) return false;

      setFen(chess.fen());

      humanMove({ 
        gameId: game.id, 
        move: { from: sourceSquare, to: targetSquare, promotion: "q" } 
      }, {
        onError: () => {
          chess.undo();
          setFen(chess.fen());
        }
      });

      return true;
    } catch (e) {
      return false;
    }
  }

  const isPlayerTurn = game.turn === 'w' && !game.isGameOver && !isMoving;
  const isAiThinking = isMoving || game.turn === 'b';

  const handleResign = () => {
    if (game.isGameOver) return;
    resignGame({ gameId: game.id });
  };

  const handleNewGame = () => {
    resetGame({ gameId: game.id });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[500px] space-y-4">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-lg p-4"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-destructive/20 border border-destructive/30">
              <Cpu className={`w-5 h-5 text-destructive ${isAiThinking && !game.isGameOver ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-mono">BOT</p>
              <p className="text-lg font-bold text-white" data-testid="text-bot-name">{game.botName}</p>
            </div>
          </div>
          <div className={`px-3 py-2 rounded-md text-sm font-mono text-center ${
            game.isGameOver 
              ? game.winner === 'human' 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                : 'bg-destructive/20 text-destructive border border-destructive/30'
              : game.status?.includes('Check') 
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : isAiThinking 
                  ? 'bg-destructive/10 text-destructive border border-destructive/20'
                  : 'bg-primary/20 text-primary border border-primary/30'
          }`} data-testid="text-game-status">
            {game.status}
          </div>
        </motion.div>

        <div className="relative">
          <div className={`absolute -inset-2 rounded-xl opacity-20 blur-xl transition-colors duration-500 ${
            game.isGameOver ? "bg-muted" : isAiThinking ? "bg-destructive" : "bg-primary"
          }`} />
          
          <div className="relative rounded-lg overflow-hidden shadow-2xl border-2 border-card">
            <Chessboard 
              position={fen} 
              onPieceDrop={onDrop}
              boardOrientation="white"
              arePiecesDraggable={isPlayerTurn}
              customDarkSquareStyle={{ backgroundColor: "#7b4a2e" }}
              customLightSquareStyle={{ backgroundColor: "#f0d9b5" }}
              animationDuration={300}
            />
          </div>

          {isAiThinking && !game.isGameOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
              <div className="bg-card px-5 py-3 rounded-lg border border-destructive/50 shadow-lg">
                <div className="flex items-center gap-3">
                  <Cpu className="w-5 h-5 text-destructive animate-spin" />
                  <span className="text-white font-mono text-sm">{game.botName} is thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-lg p-4"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/20 border border-primary/30">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-mono">PLAYER</p>
              <p className="text-lg font-bold text-white">Human</p>
            </div>
          </div>

          {game.aiComment && (
            <div className="mb-3 p-3 rounded-md bg-background border border-border">
              <p className="text-xs text-muted-foreground mb-1 font-mono">[{game.botName}]:</p>
              <p className="text-sm text-white italic">"{game.aiComment}"</p>
            </div>
          )}

          <div className="flex gap-3">
            <RetroButton 
              variant="destructive" 
              className="flex-1"
              onClick={handleResign}
              disabled={game.isGameOver || isResigning}
              data-testid="button-resign"
            >
              <Flag className="w-4 h-4 mr-2" />
              RESIGN
            </RetroButton>
            <RetroButton 
              variant="primary" 
              className="flex-1"
              onClick={handleNewGame}
              disabled={isResetting}
              data-testid="button-new-game"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              NEW GAME
            </RetroButton>
          </div>
        </motion.div>
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

function ErrorScreen({ error }: { error: unknown }) {
  const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center flex-col gap-6 p-4">
      <AlertCircle className="w-16 h-16 text-destructive" />
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-white">System Failure</h1>
        <p className="text-muted-foreground">{errorMessage}</p>
      </div>
      <RetroButton onClick={() => window.location.href = "/"} variant="ghost">
        <RotateCcw className="w-4 h-4 mr-2" />
        Return to Lobby
      </RetroButton>
    </div>
  );
}
