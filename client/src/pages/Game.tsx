import { useEffect, useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Cpu, RotateCcw, ChevronLeft, ChevronRight, User, Trophy, Home, Flag } from "lucide-react";

import { useGame, useHumanMove, useResignGame, useResetGame } from "@/hooks/use-game";
import { Layout } from "@/components/Layout";
import { RetroButton } from "@/components/ui/RetroButton";
import { usePlayerStore } from "@/lib/playerStore";
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
  const [, setLocation] = useLocation();
  const getDisplayName = usePlayerStore((state) => state.getDisplayName);
  const playerName = getDisplayName();
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"moves" | "newgame">("moves");
  const [showEndModal, setShowEndModal] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState<{from: string; to: string} | null>(null);
  
  const { mutate: humanMove, isPending: isMoving } = useHumanMove();
  const { mutate: resignGame } = useResignGame();
  const { mutate: resetGame, isPending: isResetting } = useResetGame();

  const chess = useMemo(() => new Chess(game.fen), [game.fen]);
  
  const displayFen = useMemo(() => {
    if (viewIndex === null || viewIndex === game.history.length - 1) {
      return game.fen;
    }
    const tempChess = new Chess();
    for (let i = 0; i <= viewIndex; i++) {
      const [from, to] = game.history[i].split('-');
      try {
        tempChess.move({ from, to, promotion: 'q' });
      } catch (e) {
        break;
      }
    }
    return tempChess.fen();
  }, [viewIndex, game.fen, game.history]);

  useEffect(() => {
    if (game.isGameOver && !showEndModal) {
      setShowEndModal(true);
    }
  }, [game.isGameOver]);

  useEffect(() => {
    if (game.history.length > 0) {
      setViewIndex(game.history.length - 1);
    }
  }, [game.history.length]);

  function isPawnPromotion(from: string, to: string): boolean {
    const piece = chess.get(from as Square);
    if (!piece || piece.type !== 'p') return false;
    const toRank = parseInt(to[1]);
    return (piece.color === 'w' && toRank === 8) || (piece.color === 'b' && toRank === 1);
  }

  function handleSquareClick(square: string) {
    if (game.isGameOver || isMoving || game.turn !== 'w') return;
    if (viewIndex !== null && viewIndex !== game.history.length - 1) return;

    if (selectedSquare) {
      if (legalMoves.includes(square)) {
        if (isPawnPromotion(selectedSquare, square)) {
          setPendingPromotion({ from: selectedSquare, to: square });
        } else {
          humanMove({ 
            gameId: game.id, 
            move: { from: selectedSquare, to: square } 
          });
        }
      }
      setSelectedSquare(null);
      setLegalMoves([]);
    } else {
      const piece = chess.get(square as Square);
      if (piece && piece.color === 'w') {
        setSelectedSquare(square);
        const moves = chess.moves({ square: square as Square, verbose: true });
        setLegalMoves(moves.map(m => m.to));
      }
    }
  }

  function handlePromotion(piece: string) {
    if (pendingPromotion) {
      humanMove({
        gameId: game.id,
        move: { from: pendingPromotion.from, to: pendingPromotion.to, promotion: piece }
      });
      setPendingPromotion(null);
    }
  }

  function onDrop(sourceSquare: string, targetSquare: string) {
    if (game.isGameOver || isMoving || game.turn !== 'w') return false;
    if (viewIndex !== null && viewIndex !== game.history.length - 1) return false;

    try {
      const testChess = new Chess(game.fen);
      const move = testChess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });
      if (!move) return false;

      if (isPawnPromotion(sourceSquare, targetSquare)) {
        setPendingPromotion({ from: sourceSquare, to: targetSquare });
        setSelectedSquare(null);
        setLegalMoves([]);
        return true;
      }

      humanMove({ 
        gameId: game.id, 
        move: { from: sourceSquare, to: targetSquare } 
      });
      setSelectedSquare(null);
      setLegalMoves([]);
      return true;
    } catch (e) {
      return false;
    }
  }

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    
    if (selectedSquare) {
      styles[selectedSquare] = { backgroundColor: 'rgba(255, 255, 0, 0.4)' };
    }
    
    legalMoves.forEach(square => {
      const piece = chess.get(square as Square);
      if (piece) {
        styles[square] = { 
          background: 'radial-gradient(circle, rgba(255, 0, 0, 0.5) 85%, transparent 85%)',
        };
      } else {
        styles[square] = { 
          background: 'radial-gradient(circle, rgba(0, 0, 0, 0.2) 25%, transparent 25%)',
        };
      }
    });
    
    return styles;
  }, [selectedSquare, legalMoves, chess]);

  const isAiThinking = isMoving || game.turn === 'b';
  const isViewingHistory = viewIndex !== null && viewIndex !== game.history.length - 1;
  const currentMoveIndex = viewIndex ?? game.history.length - 1;

  const moveNotationsPaired = useMemo(() => {
    const pairs: { num: number; white: string; black?: string }[] = [];
    for (let i = 0; i < game.moveNotations.length; i += 2) {
      pairs.push({
        num: Math.floor(i / 2) + 1,
        white: game.moveNotations[i],
        black: game.moveNotations[i + 1],
      });
    }
    return pairs;
  }, [game.moveNotations]);

  const handleNewGame = () => {
    setShowEndModal(false);
    resetGame({ gameId: game.id });
  };

  return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-lg p-4"
        >
          {game.aiComment && !game.isGameOver ? (
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-destructive/20 border border-destructive/30">
                <Cpu className="w-5 h-5 text-destructive" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground font-mono mb-1">{game.botName}</p>
                <p className="text-white text-sm italic">"{game.aiComment}"</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isAiThinking ? 'bg-destructive/20 border-destructive/30' : 'bg-muted'} border`}>
                <Cpu className={`w-5 h-5 ${isAiThinking ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{game.botName}</p>
                <p className="text-xs text-muted-foreground font-mono">{game.botSubtitle}</p>
              </div>
            </div>
          )}
        </motion.div>

        <div className="relative">
          <div className={`absolute -inset-2 rounded-xl opacity-20 blur-xl transition-colors duration-500 ${
            game.isGameOver ? "bg-muted" : isAiThinking ? "bg-destructive" : "bg-primary"
          }`} />
          
          <div className="relative rounded-lg overflow-hidden shadow-2xl border-2 border-card">
            <Chessboard 
              position={displayFen} 
              onPieceDrop={onDrop}
              onSquareClick={handleSquareClick}
              boardOrientation="white"
              arePiecesDraggable={!isViewingHistory && game.turn === 'w' && !game.isGameOver && !isMoving}
              customDarkSquareStyle={{ backgroundColor: "#7b4a2e" }}
              customLightSquareStyle={{ backgroundColor: "#f0d9b5" }}
              customSquareStyles={customSquareStyles}
              animationDuration={200}
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

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <span className="text-sm text-white">Player: <span className="font-bold">{game.playerName || playerName}</span></span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewIndex(Math.max(0, currentMoveIndex - 1))}
              disabled={game.history.length === 0 || currentMoveIndex <= 0}
              className="p-2 rounded bg-muted hover-elevate disabled:opacity-30"
              data-testid="button-prev-move"
            >
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>
            <span className="text-sm text-muted-foreground font-mono min-w-[50px] text-center">
              {game.history.length > 0 ? `${currentMoveIndex + 1}/${game.history.length}` : '0/0'}
            </span>
            <button
              onClick={() => setViewIndex(Math.min(game.history.length - 1, currentMoveIndex + 1))}
              disabled={game.history.length === 0 || currentMoveIndex >= game.history.length - 1}
              className="p-2 rounded bg-muted hover-elevate disabled:opacity-30"
              data-testid="button-next-move"
            >
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab("moves")}
              className={`flex-1 py-3 text-sm font-bold transition-colors ${
                activeTab === "moves" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-white"
              }`}
              data-testid="tab-moves"
            >
              Moves
            </button>
            <button
              onClick={() => setActiveTab("newgame")}
              className={`flex-1 py-3 text-sm font-bold transition-colors ${
                activeTab === "newgame" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-white"
              }`}
              data-testid="tab-newgame"
            >
              New Game
            </button>
          </div>

          <div className="p-4">
            {activeTab === "moves" ? (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {moveNotationsPaired.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">No moves yet</p>
                ) : (
                  moveNotationsPaired.map((pair) => (
                    <div key={pair.num} className="flex items-center gap-2 text-sm font-mono">
                      <span className="text-muted-foreground w-6">{pair.num}.</span>
                      <span className="text-white w-16">{pair.white}</span>
                      <span className="text-white w-16">{pair.black || ''}</span>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {!game.isGameOver ? (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground text-sm mb-4">Game in progress</p>
                    <RetroButton
                      variant="destructive"
                      onClick={() => resignGame({ gameId: game.id })}
                      className="w-full"
                      data-testid="button-resign"
                    >
                      <Flag className="w-4 h-4 mr-2" />
                      Resign
                    </RetroButton>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <RetroButton
                      onClick={handleNewGame}
                      disabled={isResetting}
                      className="w-full"
                      data-testid="button-play-again"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Play Again
                    </RetroButton>
                    <RetroButton
                      variant="ghost"
                      onClick={() => setLocation("/play-bots")}
                      className="w-full"
                      data-testid="button-change-bot"
                    >
                      Change Bot
                    </RetroButton>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {pendingPromotion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card border border-border rounded-xl p-6 max-w-xs w-full"
            >
              <h3 className="text-xl font-bold text-white text-center mb-4">Choose Promotion</h3>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { piece: 'q', symbol: '\u2655', name: 'Queen' },
                  { piece: 'r', symbol: '\u2656', name: 'Rook' },
                  { piece: 'b', symbol: '\u2657', name: 'Bishop' },
                  { piece: 'n', symbol: '\u2658', name: 'Knight' },
                ].map((option) => (
                  <button
                    key={option.piece}
                    onClick={() => handlePromotion(option.piece)}
                    className="flex flex-col items-center justify-center p-4 rounded-lg bg-background border border-border hover:border-primary hover:bg-primary/10 transition-all"
                    data-testid={`button-promote-${option.piece}`}
                  >
                    <span className="text-4xl text-white mb-1">{option.symbol}</span>
                    <span className="text-xs text-muted-foreground">{option.name}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setPendingPromotion(null)}
                className="w-full mt-4 py-2 text-sm text-muted-foreground hover:text-white transition-colors"
                data-testid="button-cancel-promotion"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}

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
                  game.winner === "human" ? "text-yellow-400" : "text-muted-foreground"
                }`} />
                <h2 className="text-2xl font-bold text-white mb-1">Game Over</h2>
                <p className="text-lg text-primary">{game.status}</p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between p-2 rounded bg-background">
                  <span className="text-muted-foreground">Mode</span>
                  <span className="text-white font-bold">Unfair AI</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-background">
                  <span className="text-muted-foreground">Bot</span>
                  <span className="text-white font-bold">{game.botName}</span>
                </div>
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
                  Home
                </RetroButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}

function LoadingScreen() {
  return (
    <Layout>
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center flex-col gap-4">
        <Cpu className="w-12 h-12 text-primary animate-pulse" />
        <p className="font-mono text-primary animate-pulse">Loading game...</p>
      </div>
    </Layout>
  );
}

function ErrorScreen({ error }: { error: unknown }) {
  const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
  
  return (
    <Layout>
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center flex-col gap-6 p-4">
        <AlertCircle className="w-16 h-16 text-destructive" />
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white">Error</h1>
          <p className="text-muted-foreground">{errorMessage}</p>
        </div>
        <RetroButton onClick={() => window.location.href = "/"} variant="ghost">
          <RotateCcw className="w-4 h-4 mr-2" />
          Return Home
        </RetroButton>
      </div>
    </Layout>
  );
}
