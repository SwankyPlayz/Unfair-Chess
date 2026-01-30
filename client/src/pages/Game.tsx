import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Cpu, RotateCcw, User, Flag, Zap, Trophy, Home } from "lucide-react";

import { useGame, useHumanMove, useResignGame, useResetGame, useRps, useUpdateStats } from "@/hooks/use-game";
import { RetroButton } from "@/components/ui/RetroButton";
import { type Game } from "@shared/schema";

export default function GamePage() {
  const [, params] = useRoute("/game/:id");
  const id = Number(params?.id);
  const { data: game, isLoading, error } = useGame(id);

  if (isLoading) return <LoadingScreen />;
  if (error || !game) return <ErrorScreen error={error} />;

  if (game.mode === "chaos" && !game.rpsComplete) {
    return <RpsScreen game={game} />;
  }

  return <GameInterface game={game} />;
}

function RpsScreen({ game }: { game: Game }) {
  const { mutate: setRpsWinner, isPending } = useRps();
  const [p1Choice, setP1Choice] = useState<string | null>(null);
  const [p2Choice, setP2Choice] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const choices = ["rock", "paper", "scissors"];

  const determineWinner = () => {
    if (!p1Choice || !p2Choice) return null;
    if (p1Choice === p2Choice) return "tie";
    if (
      (p1Choice === "rock" && p2Choice === "scissors") ||
      (p1Choice === "paper" && p2Choice === "rock") ||
      (p1Choice === "scissors" && p2Choice === "paper")
    ) {
      return "player1";
    }
    return "player2";
  };

  const handleReveal = () => {
    if (!p1Choice || !p2Choice) return;
    setShowResult(true);
    
    setTimeout(() => {
      const winner = determineWinner();
      if (winner && winner !== "tie") {
        setRpsWinner({ gameId: game.id, winner });
      } else {
        setP1Choice(null);
        setP2Choice(null);
        setShowResult(false);
      }
    }, 2000);
  };

  const winner = determineWinner();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-3xl font-bold text-white">Rock Paper Scissors</h1>
        <p className="text-muted-foreground">Winner gets the Chaos Token!</p>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <p className="font-bold text-white">{game.player1Name}</p>
            {!showResult ? (
              <div className="flex flex-col gap-2">
                {choices.map((choice) => (
                  <button
                    key={choice}
                    onClick={() => setP1Choice(choice)}
                    className={`p-3 rounded-lg border capitalize transition-all ${
                      p1Choice === choice
                        ? "border-primary bg-primary/20 text-white"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                    data-testid={`button-p1-${choice}`}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-card border border-border">
                <p className="text-2xl capitalize">{p1Choice}</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="font-bold text-white">{game.player2Name}</p>
            {!showResult ? (
              <div className="flex flex-col gap-2">
                {choices.map((choice) => (
                  <button
                    key={choice}
                    onClick={() => setP2Choice(choice)}
                    className={`p-3 rounded-lg border capitalize transition-all ${
                      p2Choice === choice
                        ? "border-primary bg-primary/20 text-white"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                    data-testid={`button-p2-${choice}`}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-card border border-border">
                <p className="text-2xl capitalize">{p2Choice}</p>
              </div>
            )}
          </div>
        </div>

        {showResult && winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`p-4 rounded-lg ${winner === "tie" ? "bg-muted" : "bg-primary/20"}`}
          >
            <p className="text-xl font-bold text-white">
              {winner === "tie" 
                ? "It's a tie! Go again..." 
                : `${winner === "player1" ? game.player1Name : game.player2Name} wins the Chaos Token!`
              }
            </p>
          </motion.div>
        )}

        {!showResult && (
          <RetroButton
            onClick={handleReveal}
            disabled={!p1Choice || !p2Choice || isPending}
            className="w-full"
            data-testid="button-reveal-rps"
          >
            Reveal Choices
          </RetroButton>
        )}
      </div>
    </div>
  );
}

function GameInterface({ game }: { game: Game }) {
  const [, setLocation] = useLocation();
  const [chess] = useState(new Chess(game.fen));
  const [fen, setFen] = useState(game.fen);
  const [showEndModal, setShowEndModal] = useState(false);
  const [useChaosToken, setUseChaosToken] = useState(false);
  
  const { mutate: humanMove, isPending: isMoving } = useHumanMove();
  const { mutate: resignGame, isPending: isResigning } = useResignGame();
  const { mutate: resetGame, isPending: isResetting } = useResetGame();
  const { mutate: updateStats } = useUpdateStats();

  useEffect(() => {
    try {
      setFen(game.fen);
      chess.load(game.fen);
    } catch (e) {
      console.error("Invalid FEN from server:", game.fen);
    }
  }, [game.fen, chess]);

  useEffect(() => {
    if (game.isGameOver && !showEndModal) {
      setShowEndModal(true);
      if (game.winner) {
        updateStats({
          winner: game.winner,
          mode: game.mode as "ai" | "chaos",
          botId: game.botId || undefined,
        });
      }
    }
  }, [game.isGameOver]);

  function onDrop(sourceSquare: string, targetSquare: string) {
    if (game.isGameOver || isMoving) return false;
    
    if (game.mode === "ai" && game.turn !== 'w') return false;

    try {
      if (!useChaosToken) {
        const testChess = new Chess(game.fen);
        const move = testChess.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: "q",
        });
        if (!move) return false;
      }

      setFen(chess.fen());

      humanMove({ 
        gameId: game.id, 
        move: { 
          from: sourceSquare, 
          to: targetSquare, 
          promotion: "q",
          useChaosToken: useChaosToken && game.mode === "chaos" && !game.chaosTokenUsed,
        } 
      }, {
        onError: () => {
          chess.load(game.fen);
          setFen(game.fen);
        },
        onSuccess: () => {
          if (useChaosToken) setUseChaosToken(false);
        }
      });

      return true;
    } catch (e) {
      return false;
    }
  }

  const isPlayerTurn = game.mode === "ai" 
    ? game.turn === 'w' && !game.isGameOver && !isMoving
    : !game.isGameOver && !isMoving;
  const isAiThinking = game.mode === "ai" && (isMoving || game.turn === 'b');

  const handleResign = () => {
    if (game.isGameOver) return;
    resignGame({ gameId: game.id });
  };

  const handleNewGame = () => {
    setShowEndModal(false);
    resetGame({ gameId: game.id });
  };

  const canUseChaosToken = game.mode === "chaos" && 
    !game.chaosTokenUsed && 
    game.chaosTokenHolder && 
    ((game.turn === 'w' && game.chaosTokenHolder === game.player1Name) ||
     (game.turn === 'b' && game.chaosTokenHolder === game.player2Name));

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[500px] space-y-3">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-lg p-4"
        >
          {game.mode === "ai" ? (
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-destructive/20 border border-destructive/30">
                <Cpu className={`w-5 h-5 text-destructive ${isAiThinking ? 'animate-pulse' : ''}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-mono">BOT</p>
                <p className="text-lg font-bold text-white" data-testid="text-bot-name">{game.botName}</p>
                <p className="text-xs text-muted-foreground">{game.botSubtitle}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <User className={`w-5 h-5 ${game.turn === 'b' ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="font-bold text-white">{game.player2Name}</span>
                <span className="text-xs text-muted-foreground">(Black)</span>
              </div>
              {game.chaosTokenHolder === game.player2Name && !game.chaosTokenUsed && (
                <div className="flex items-center gap-1 px-2 py-1 rounded bg-yellow-500/20 border border-yellow-500/30">
                  <Zap className="w-3 h-3 text-yellow-400" />
                  <span className="text-xs text-yellow-400">Token</span>
                </div>
              )}
            </div>
          )}

          <div className={`px-3 py-2 rounded-md text-sm font-mono text-center ${
            game.isGameOver 
              ? game.winner === 'human' || game.winner === 'player1' || game.winner === 'player2'
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

          {isAiThinking && (
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
          {game.mode === "ai" ? (
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-primary/20 border border-primary/30">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-mono">PLAYER</p>
                <p className="text-lg font-bold text-white">Human</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <User className={`w-5 h-5 ${game.turn === 'w' ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="font-bold text-white">{game.player1Name}</span>
                <span className="text-xs text-muted-foreground">(White)</span>
              </div>
              {game.chaosTokenHolder === game.player1Name && !game.chaosTokenUsed && (
                <div className="flex items-center gap-1 px-2 py-1 rounded bg-yellow-500/20 border border-yellow-500/30">
                  <Zap className="w-3 h-3 text-yellow-400" />
                  <span className="text-xs text-yellow-400">Token</span>
                </div>
              )}
            </div>
          )}

          {canUseChaosToken && (
            <div className="mb-3">
              <button
                onClick={() => setUseChaosToken(!useChaosToken)}
                className={`w-full p-3 rounded-lg border-2 flex items-center justify-center gap-2 transition-all ${
                  useChaosToken
                    ? "border-yellow-500 bg-yellow-500/20 text-yellow-400"
                    : "border-border text-muted-foreground hover:border-yellow-500/50"
                }`}
                data-testid="button-use-chaos-token"
              >
                <Zap className="w-4 h-4" />
                <span className="font-bold text-sm">
                  {useChaosToken ? "CHAOS TOKEN ACTIVE - Make ANY move!" : "Use Chaos Token"}
                </span>
              </button>
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

      <AnimatePresence>
        {showEndModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
            onClick={() => setShowEndModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-xl p-6 max-w-sm w-full space-y-4"
            >
              <div className="text-center">
                <Trophy className={`w-12 h-12 mx-auto mb-3 ${
                  (game.mode === "ai" && game.winner === "human") || game.winner === "player1" || game.winner === "player2"
                    ? "text-yellow-400"
                    : "text-muted-foreground"
                }`} />
                <h2 className="text-2xl font-bold text-white mb-1">Game Over</h2>
                <p className="text-lg text-primary">{game.status}</p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between p-2 rounded bg-background">
                  <span className="text-muted-foreground">Mode</span>
                  <span className="text-white font-bold">{game.mode === "ai" ? "Unfair AI" : "Chaos Duel"}</span>
                </div>
                {game.mode === "ai" && (
                  <div className="flex justify-between p-2 rounded bg-background">
                    <span className="text-muted-foreground">Bot</span>
                    <span className="text-white font-bold">{game.botName}</span>
                  </div>
                )}
                <div className="flex justify-between p-2 rounded bg-background">
                  <span className="text-muted-foreground">Total Moves</span>
                  <span className="text-white font-bold">{game.moveCount}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <RetroButton onClick={handleNewGame} className="w-full" data-testid="button-modal-rematch">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Rematch
                </RetroButton>
                <RetroButton 
                  variant="ghost" 
                  onClick={() => setLocation("/")} 
                  className="w-full"
                  data-testid="button-modal-home"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Change Mode
                </RetroButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
