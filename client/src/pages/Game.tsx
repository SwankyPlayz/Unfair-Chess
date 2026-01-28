import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { motion } from "framer-motion";
import { AlertCircle, Cpu, RotateCcw, Crown, Zap, Shield } from "lucide-react";

import { useGame, useHumanMove } from "@/hooks/use-game";
import { RetroButton } from "@/components/ui/RetroButton";
import { GameCard, TerminalCard } from "@/components/ui/GameCard";
import { type Game } from "@shared/schema";
import { AI_PERSONALITIES } from "@shared/schema";

export default function GamePage() {
  const [, params] = useRoute("/game/:id");
  const id = Number(params?.id);
  const { data: game, isLoading, error } = useGame(id);

  if (isLoading) return <LoadingScreen />;
  if (error || !game) return <ErrorScreen error={error} />;

  return <GameInterface game={game} />;
}

function getPersonalityDisplay(personalityId: string): { name: string; description: string } {
  const found = AI_PERSONALITIES.find(p => p.id === personalityId);
  return found || { name: "Unknown", description: "" };
}

function GameInterface({ game }: { game: Game }) {
  const [chess] = useState(new Chess(game.fen));
  const [fen, setFen] = useState(game.fen);
  
  const { mutate: humanMove, isPending: isMoving } = useHumanMove();

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
  const isAiThinking = isMoving;
  const personality = getPersonalityDisplay(game.aiPersonality);

  const getTurnStatus = () => {
    if (game.isGameOver) {
      if (game.result === 'checkmate') {
        return game.winner === 'human' ? "YOU WIN" : `${game.aiName} WINS`;
      }
      return "DRAW";
    }
    if (isAiThinking) return `${game.aiName} is thinking...`;
    if (game.isCheck) return "CHECK";
    if (isPlayerTurn) return "Your move";
    return "Waiting...";
  };

  const getStatusColor = () => {
    if (game.isGameOver) {
      return game.winner === 'human' ? "text-green-400" : "text-destructive";
    }
    if (game.isCheck) return "text-yellow-400";
    if (isAiThinking) return "text-destructive animate-pulse";
    return "text-primary";
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 flex flex-col md:flex-row gap-8 items-center justify-center relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
      
      <div className="w-full max-w-md space-y-6 order-2 md:order-1">
        <GameCard>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/20 border border-primary/30">
              <Crown className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-mono">YOU</p>
              <p className="text-lg font-bold text-white">Human Player</p>
            </div>
          </div>
          
          <div className="text-center py-4 mb-4 border-y border-white/10">
            <p className="text-xs text-muted-foreground mb-1">VS</p>
            <h2 className={`text-2xl font-display font-bold ${getStatusColor()}`}>
              {getTurnStatus()}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/20 border border-destructive/30">
              <Cpu className={`w-6 h-6 text-destructive ${isAiThinking ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-mono">AI OPPONENT</p>
              <p className="text-lg font-bold text-white" data-testid="text-ai-name">{game.aiName}</p>
              <p className="text-xs text-muted-foreground">{personality.name}</p>
            </div>
          </div>
        </GameCard>

        <TerminalCard title={`${game.aiName}_CORE.log`} className="h-56">
          <div className="space-y-3">
            {!game.aiComment && game.history.length === 0 && (
              <p className="text-muted-foreground text-sm">
                <span className="text-xs opacity-50 mr-2">[SYS]:</span>
                Awaiting first move...
              </p>
            )}
            {game.aiComment && (
              <motion.div 
                key={game.aiComment}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-destructive font-medium"
              >
                <span className="text-xs opacity-50 mr-2">[{game.aiName}]:</span>
                "{game.aiComment}"
              </motion.div>
            )}
            {isAiThinking && (
              <div className="flex items-center gap-2 text-primary">
                <Zap className="w-4 h-4 animate-pulse" />
                <span className="text-sm animate-pulse">Processing unfair advantage...</span>
              </div>
            )}
            {game.isCheck && !game.isGameOver && (
              <div className="flex items-center gap-2 text-yellow-400">
                <Shield className="w-4 h-4" />
                <span className="text-sm font-bold">Your King is in CHECK!</span>
              </div>
            )}
          </div>
        </TerminalCard>

        {game.isGameOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <RetroButton 
              variant="default" 
              className="w-full"
              onClick={() => window.location.href = "/"}
              data-testid="button-new-game"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              NEW GAME
            </RetroButton>
          </motion.div>
        )}
      </div>

      <div className="w-full max-w-[600px] order-1 md:order-2">
        <div className="relative aspect-square">
          <div className={`absolute -inset-4 rounded-xl opacity-30 blur-2xl transition-colors duration-1000 ${
            game.isCheck ? "bg-yellow-500" : isAiThinking ? "bg-destructive" : "bg-primary"
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

          {isAiThinking && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg z-20">
              <div className="bg-card px-6 py-4 rounded-lg border border-destructive/50 shadow-lg">
                <div className="flex items-center gap-3">
                  <Cpu className="w-6 h-6 text-destructive animate-spin" />
                  <span className="text-white font-mono">{game.aiName} is thinking...</span>
                </div>
              </div>
            </div>
          )}
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

function ErrorScreen({ error }: { error: unknown }) {
  const [, setLocation] = useLocation();
  const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center flex-col gap-6 p-4">
      <AlertCircle className="w-16 h-16 text-destructive" />
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-white">System Failure</h1>
        <p className="text-muted-foreground">{errorMessage}</p>
      </div>
      <RetroButton onClick={() => setLocation("/")} variant="ghost">
        <RotateCcw className="w-4 h-4 mr-2" />
        Return to Lobby
      </RetroButton>
    </div>
  );
}
