import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Users, Loader2, Zap, Trophy, Home, RotateCcw, ChevronLeft, ChevronRight, Timer, Clock, Flag, Handshake, MessageCircle, Send, AlertTriangle } from "lucide-react";
import { Layout } from "@/components/Layout";
import { RetroButton } from "@/components/ui/RetroButton";
import { usePlayerStore } from "@/lib/playerStore";
import { useToast } from "@/hooks/use-toast";
import { api, buildUrl } from "@shared/routes";
import { type OnlineMatch, TIME_CONTROLS, type TimeControlId } from "@shared/schema";

export default function PlayDuel() {
  const [, setLocation] = useLocation();
  const { playerId, playerName } = usePlayerStore();
  const { toast } = useToast();
  
  const [status, setStatus] = useState<"idle" | "searching" | "matched">("idle");
  const [match, setMatch] = useState<OnlineMatch | null>(null);
  const [countdown, setCountdown] = useState(60);
  const [selectedTimeControl, setSelectedTimeControl] = useState<TimeControlId>("blitz");
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (status === "searching") {
      interval = setInterval(async () => {
        try {
          const res = await fetch(buildUrl(api.matchmaking.status.path, { playerId }));
          const data = await res.json();
          
          if (data.status === "matched" && data.match) {
            setStatus("matched");
            setMatch(data.match);
          }
        } catch (e) {
          console.error("Polling error:", e);
        }
      }, 2000);
    }

    return () => clearInterval(interval);
  }, [status, playerId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (match && match.phase === "rps" && match.rpsDeadline) {
      interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((new Date(match.rpsDeadline!).getTime() - Date.now()) / 1000));
        setCountdown(remaining);
        
        if (remaining === 0) {
          toast({
            title: "Time's Up",
            description: "RPS phase expired. Match cancelled.",
            variant: "destructive",
          });
          setStatus("idle");
          setMatch(null);
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [match]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (match && !match.isGameOver) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(buildUrl(api.matches.get.path, { roomId: match.roomId }));
          if (res.ok) {
            const updatedMatch = await res.json();
            setMatch(updatedMatch);
          }
        } catch (e) {
          console.error("Match polling error:", e);
        }
      }, 1500);
    }

    return () => clearInterval(interval);
  }, [match?.roomId, match?.isGameOver]);

  const handleFindMatch = async () => {
    setStatus("searching");
    
    try {
      const res = await fetch(api.matchmaking.join.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, playerName, timeControl: selectedTimeControl }),
      });
      
      const data = await res.json();
      
      if (data.status === "matched" && data.roomId) {
        const matchRes = await fetch(buildUrl(api.matches.get.path, { roomId: data.roomId }));
        const matchData = await matchRes.json();
        setStatus("matched");
        setMatch(matchData);
      }
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to join matchmaking queue",
        variant: "destructive",
      });
      setStatus("idle");
    }
  };

  const handleResign = async () => {
    if (!match) return;
    try {
      const res = await fetch(buildUrl(api.matches.resign.path, { roomId: match.roomId }), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json();
      setMatch(data);
      setShowResignConfirm(false);
    } catch (e) {
      toast({ title: "Error", description: "Failed to resign", variant: "destructive" });
    }
  };

  const handleDrawAction = async (action: "offer" | "accept" | "decline") => {
    if (!match) return;
    try {
      const res = await fetch(buildUrl(api.matches.offerDraw.path, { roomId: match.roomId }), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, action }),
      });
      const data = await res.json();
      setMatch(data);
    } catch (e) {
      toast({ title: "Error", description: "Failed to process draw", variant: "destructive" });
    }
  };

  const handleSendChat = async () => {
    if (!match || !chatMessage.trim()) return;
    try {
      await fetch(buildUrl(api.matches.chat.path, { roomId: match.roomId }), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, message: chatMessage.trim() }),
      });
      setChatMessage("");
    } catch (e) {
      console.error("Chat error:", e);
    }
  };

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [match?.chatMessages]);

  const handleCancelSearch = async () => {
    try {
      await fetch(api.matchmaking.leave.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
    } catch (e) {
      console.error("Leave queue error:", e);
    }
    setStatus("idle");
  };

  if (status === "idle") {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-4 py-12 text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Swords className="w-16 h-16 text-primary mx-auto mb-4" />
            <h1 className="text-3xl font-display font-bold text-white mb-2">
              Chaos Duels
            </h1>
            <p className="text-muted-foreground">
              Play online against another player. Win Rock-Paper-Scissors to earn one illegal move!
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border border-border rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/30">
              <Zap className="w-5 h-5 text-primary" />
              <div className="text-left">
                <p className="font-bold text-white text-sm">Chaos Token</p>
                <p className="text-xs text-muted-foreground">RPS winner gets one illegal move per game!</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground text-left">Time Control</p>
              <div className="grid grid-cols-3 gap-2">
                {TIME_CONTROLS.map((tc) => {
                  const IconComponent = tc.id === "bullet" ? Zap : tc.id === "rapid" ? Clock : Timer;
                  return (
                    <button
                      key={tc.id}
                      onClick={() => setSelectedTimeControl(tc.id)}
                      className={`p-3 rounded-lg border transition-all flex flex-col items-center gap-1 ${
                        selectedTimeControl === tc.id
                          ? "bg-primary/20 border-primary text-white"
                          : "bg-background border-border text-muted-foreground hover:border-primary/50"
                      }`}
                      data-testid={`button-time-${tc.id}`}
                    >
                      <IconComponent className="w-5 h-5" />
                      <span className="text-sm font-medium">{tc.name}</span>
                      <span className="text-xs">{tc.seconds >= 60 ? `${tc.seconds / 60}min` : `${tc.seconds}s`}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <RetroButton
              onClick={handleFindMatch}
              className="w-full py-5 text-lg"
              data-testid="button-find-match"
            >
              <Users className="w-5 h-5 mr-2" />
              Find Opponent
            </RetroButton>
          </motion.div>
        </div>
      </Layout>
    );
  }

  if (status === "searching") {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-4 py-12 text-center space-y-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Loader2 className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
            <h2 className="text-2xl font-bold text-white mb-2">Searching for opponent...</h2>
            <p className="text-muted-foreground">Waiting in matchmaking queue</p>
          </motion.div>

          <RetroButton
            variant="ghost"
            onClick={handleCancelSearch}
            data-testid="button-cancel-search"
          >
            Cancel
          </RetroButton>
        </div>
      </Layout>
    );
  }

  if (!match) {
    return <Layout><div className="p-8 text-center text-muted-foreground">Loading match...</div></Layout>;
  }

  if (match.phase === "rps") {
    return <RpsPhase match={match} playerId={playerId} countdown={countdown} setMatch={setMatch} />;
  }

  return <OnlineGameInterface match={match} playerId={playerId} setMatch={setMatch} />;
}

function RpsPhase({ 
  match, 
  playerId, 
  countdown, 
  setMatch 
}: { 
  match: OnlineMatch; 
  playerId: string; 
  countdown: number;
  setMatch: (m: OnlineMatch) => void;
}) {
  const [myChoice, setMyChoice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const isPlayer1 = match.player1Id === playerId;
  const myRps = isPlayer1 ? match.player1Rps : match.player2Rps;
  const theirRps = isPlayer1 ? match.player2Rps : match.player1Rps;

  const handleSubmit = async (choice: string) => {
    setMyChoice(choice);
    setIsSubmitting(true);
    
    try {
      const res = await fetch(buildUrl(api.matches.rps.path, { roomId: match.roomId }), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, choice }),
      });
      
      if (res.ok) {
        const updatedMatch = await res.json();
        setMatch(updatedMatch);
      }
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to submit choice",
        variant: "destructive",
      });
    }
    
    setIsSubmitting(false);
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto px-4 py-8 text-center space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Rock Paper Scissors</h2>
          <p className="text-muted-foreground">Winner gets the Chaos Token!</p>
        </div>

        <div className="text-4xl font-bold text-primary">{countdown}s</div>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">You</p>
              <p className="font-bold text-white">{isPlayer1 ? match.player1Name : match.player2Name}</p>
              {myRps && <p className="text-primary capitalize mt-2">{myRps}</p>}
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Opponent</p>
              <p className="font-bold text-white">{isPlayer1 ? match.player2Name : match.player1Name}</p>
              {theirRps ? (
                <p className="text-primary capitalize mt-2">{theirRps}</p>
              ) : (
                <p className="text-muted-foreground mt-2">Waiting...</p>
              )}
            </div>
          </div>

          {!myRps ? (
            <div className="grid grid-cols-3 gap-2">
              {["rock", "paper", "scissors"].map((choice) => (
                <button
                  key={choice}
                  onClick={() => handleSubmit(choice)}
                  disabled={isSubmitting}
                  className="p-4 rounded-lg border border-border bg-background text-white capitalize hover:border-primary hover:bg-primary/10 transition-all disabled:opacity-50"
                  data-testid={`button-rps-${choice}`}
                >
                  {choice}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Waiting for opponent...</p>
          )}
        </div>
      </div>
    </Layout>
  );
}

function OnlineGameInterface({ 
  match, 
  playerId,
  setMatch 
}: { 
  match: OnlineMatch; 
  playerId: string;
  setMatch: (m: OnlineMatch) => void;
}) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [useChaosToken, setUseChaosToken] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  const isPlayer1 = match.player1Id === playerId;
  const myColor = isPlayer1 ? 'w' : 'b';
  const isMyTurn = match.turn === myColor;
  const myName = isPlayer1 ? match.player1Name : match.player2Name;
  const opponentName = isPlayer1 ? match.player2Name : match.player1Name;

  const chess = useMemo(() => new Chess(match.fen), [match.fen]);
  
  const displayFen = useMemo(() => {
    if (viewIndex === null || viewIndex === match.history.length - 1) {
      return match.fen;
    }
    const tempChess = new Chess();
    for (let i = 0; i <= viewIndex; i++) {
      const [from, to] = match.history[i].split('-');
      try {
        tempChess.move({ from, to, promotion: 'q' });
      } catch (e) {
        break;
      }
    }
    return tempChess.fen();
  }, [viewIndex, match.fen, match.history]);

  useEffect(() => {
    if (match.isGameOver && !showEndModal) {
      setShowEndModal(true);
    }
  }, [match.isGameOver]);

  useEffect(() => {
    if (match.history.length > 0) {
      setViewIndex(match.history.length - 1);
    }
  }, [match.history.length]);

  const canUseChaosToken = !match.chaosTokenUsed && 
    match.chaosTokenHolder && 
    ((isPlayer1 && match.rpsWinner === "player1") || (!isPlayer1 && match.rpsWinner === "player2"));

  async function makeMove(from: string, to: string) {
    if (!isMyTurn || match.isGameOver || isMoving) return false;

    setIsMoving(true);
    
    try {
      const res = await fetch(buildUrl(api.matches.move.path, { roomId: match.roomId }), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          playerId, 
          from, 
          to, 
          promotion: "q",
          useChaosToken: useChaosToken && canUseChaosToken,
        }),
      });
      
      if (res.ok) {
        const updatedMatch = await res.json();
        setMatch(updatedMatch);
        setUseChaosToken(false);
        return true;
      } else {
        const error = await res.json();
        toast({
          title: "Invalid Move",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to make move",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsMoving(false);
    }
  }

  function handleSquareClick(square: string) {
    if (!isMyTurn || match.isGameOver || isMoving) return;
    if (viewIndex !== null && viewIndex !== match.history.length - 1) return;

    if (selectedSquare) {
      if (useChaosToken && canUseChaosToken) {
        makeMove(selectedSquare, square);
      } else if (legalMoves.includes(square)) {
        makeMove(selectedSquare, square);
      }
      setSelectedSquare(null);
      setLegalMoves([]);
    } else {
      const piece = chess.get(square as Square);
      if (piece && piece.color === myColor) {
        setSelectedSquare(square);
        if (!useChaosToken) {
          const moves = chess.moves({ square: square as Square, verbose: true });
          setLegalMoves(moves.map(m => m.to));
        }
      }
    }
  }

  function onDrop(sourceSquare: string, targetSquare: string) {
    if (!isMyTurn || match.isGameOver || isMoving) return false;
    if (viewIndex !== null && viewIndex !== match.history.length - 1) return false;

    if (useChaosToken && canUseChaosToken) {
      makeMove(sourceSquare, targetSquare);
      return true;
    }

    try {
      const testChess = new Chess(match.fen);
      const move = testChess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });
      if (!move) return false;

      makeMove(sourceSquare, targetSquare);
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
      styles[selectedSquare] = { backgroundColor: useChaosToken ? 'rgba(255, 200, 0, 0.5)' : 'rgba(255, 255, 0, 0.4)' };
    }
    
    if (!useChaosToken) {
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
    }
    
    return styles;
  }, [selectedSquare, legalMoves, chess, useChaosToken]);

  const isViewingHistory = viewIndex !== null && viewIndex !== match.history.length - 1;
  const currentMoveIndex = viewIndex ?? match.history.length - 1;

  const moveNotationsPaired = useMemo(() => {
    const pairs: { num: number; white: string; black?: string }[] = [];
    for (let i = 0; i < match.moveNotations.length; i += 2) {
      pairs.push({
        num: Math.floor(i / 2) + 1,
        white: match.moveNotations[i],
        black: match.moveNotations[i + 1],
      });
    }
    return pairs;
  }, [match.moveNotations]);

  const iAmWinner = match.winner === myName;

  return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        <div className="flex items-center justify-between bg-card border border-border rounded-lg p-3">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${!isMyTurn ? 'bg-green-500 animate-pulse' : 'bg-muted'}`} />
            <span className="font-bold text-white">{opponentName}</span>
            <span className="text-xs text-muted-foreground">({isPlayer1 ? 'Black' : 'White'})</span>
          </div>
          {match.chaosTokenHolder === opponentName && !match.chaosTokenUsed && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-yellow-500/20 border border-yellow-500/30">
              <Zap className="w-3 h-3 text-yellow-400" />
            </div>
          )}
        </div>

        <div className="relative">
          <div className="relative rounded-lg overflow-hidden shadow-2xl border-2 border-card">
            <Chessboard 
              position={displayFen} 
              onPieceDrop={onDrop}
              onSquareClick={handleSquareClick}
              boardOrientation={isPlayer1 ? "white" : "black"}
              arePiecesDraggable={!isViewingHistory && isMyTurn && !match.isGameOver && !isMoving}
              customDarkSquareStyle={{ backgroundColor: "#7b4a2e" }}
              customLightSquareStyle={{ backgroundColor: "#f0d9b5" }}
              customSquareStyles={customSquareStyles}
              animationDuration={200}
            />
          </div>
        </div>

        <div className="flex items-center justify-between bg-card border border-border rounded-lg p-3">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isMyTurn ? 'bg-green-500 animate-pulse' : 'bg-muted'}`} />
            <span className="font-bold text-white">{myName}</span>
            <span className="text-xs text-muted-foreground">({isPlayer1 ? 'White' : 'Black'})</span>
          </div>
          <div className="flex items-center gap-2">
            {canUseChaosToken && (
              <button
                onClick={() => setUseChaosToken(!useChaosToken)}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg border transition-all ${
                  useChaosToken
                    ? "border-yellow-500 bg-yellow-500/30 text-yellow-300"
                    : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
                }`}
                data-testid="button-chaos-token"
              >
                <Zap className="w-3 h-3" />
                <span className="text-xs font-bold">{useChaosToken ? 'ACTIVE' : 'Use Token'}</span>
              </button>
            )}
            <button
              onClick={() => setViewIndex(Math.max(0, currentMoveIndex - 1))}
              disabled={match.history.length === 0 || currentMoveIndex <= 0}
              className="p-2 rounded bg-muted hover-elevate disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>
            <span className="text-xs text-muted-foreground font-mono">
              {match.history.length > 0 ? `${currentMoveIndex + 1}/${match.history.length}` : '0/0'}
            </span>
            <button
              onClick={() => setViewIndex(Math.min(match.history.length - 1, currentMoveIndex + 1))}
              disabled={match.history.length === 0 || currentMoveIndex >= match.history.length - 1}
              className="p-2 rounded bg-muted hover-elevate disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-2">Moves</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {moveNotationsPaired.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-2">No moves yet</p>
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
        </div>

        {!match.isGameOver && (
          <>
            {match.drawOfferedBy && match.drawOfferedBy !== playerId && (
              <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Handshake className="w-5 h-5 text-yellow-400" />
                  <span className="text-white font-medium">Draw Offered</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDrawAction("accept")}
                    className="flex-1 py-2 px-3 rounded bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors"
                    data-testid="button-accept-draw"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleDrawAction("decline")}
                    className="flex-1 py-2 px-3 rounded bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
                    data-testid="button-decline-draw"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setShowResignConfirm(true)}
                className="flex flex-col items-center gap-1 p-3 rounded-lg bg-card border border-border hover:border-red-500/50 hover:bg-red-500/10 transition-all"
                data-testid="button-resign"
              >
                <Flag className="w-5 h-5 text-red-400" />
                <span className="text-xs text-muted-foreground">Resign</span>
              </button>
              <button
                onClick={() => handleDrawAction("offer")}
                disabled={match.drawOfferedBy === playerId}
                className="flex flex-col items-center gap-1 p-3 rounded-lg bg-card border border-border hover:border-yellow-500/50 hover:bg-yellow-500/10 transition-all disabled:opacity-50"
                data-testid="button-offer-draw"
              >
                <Handshake className="w-5 h-5 text-yellow-400" />
                <span className="text-xs text-muted-foreground">{match.drawOfferedBy === playerId ? 'Offered' : 'Draw'}</span>
              </button>
              <button
                onClick={() => setShowChat(!showChat)}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                  showChat ? 'bg-primary/20 border-primary' : 'bg-card border-border hover:border-primary/50'
                }`}
                data-testid="button-chat"
              >
                <MessageCircle className="w-5 h-5 text-primary" />
                <span className="text-xs text-muted-foreground">Chat</span>
              </button>
            </div>
          </>
        )}

        {showChat && (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="h-32 overflow-y-auto p-3 space-y-2">
              {(match.chatMessages || []).length === 0 ? (
                <p className="text-muted-foreground text-xs text-center py-4">No messages yet</p>
              ) : (
                (match.chatMessages || []).map((msg, i) => (
                  <div key={i} className={`text-sm ${msg.playerId === playerId ? 'text-right' : 'text-left'}`}>
                    <span className={`inline-block px-2 py-1 rounded ${
                      msg.playerId === playerId ? 'bg-primary/20 text-white' : 'bg-muted text-white'
                    }`}>
                      {msg.message}
                    </span>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="flex border-t border-border">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder="Type a message..."
                className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none"
                data-testid="input-chat"
              />
              <button
                onClick={handleSendChat}
                className="px-3 py-2 text-primary hover:bg-primary/10 transition-colors"
                data-testid="button-send-chat"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showResignConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
            onClick={() => setShowResignConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-xl p-6 max-w-sm w-full"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-red-500/20">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Resign Game?</h3>
                  <p className="text-sm text-muted-foreground">This will count as a loss</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowResignConfirm(false)}
                  className="py-2 px-4 rounded-lg bg-muted text-white hover:bg-muted/80 transition-colors"
                  data-testid="button-cancel-resign"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResign}
                  className="py-2 px-4 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors"
                  data-testid="button-confirm-resign"
                >
                  Resign
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showEndModal && (
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
              className="bg-card border border-border rounded-xl p-6 max-w-sm w-full space-y-4"
            >
              <div className="text-center">
                <Trophy className={`w-12 h-12 mx-auto mb-3 ${iAmWinner ? "text-yellow-400" : "text-muted-foreground"}`} />
                <h2 className="text-2xl font-bold text-white mb-1">
                  {match.result === "checkmate" ? "Checkmate!" : match.result === "stalemate" ? "Stalemate" : "Game Over"}
                </h2>
                <p className="text-lg text-primary">
                  {match.winner ? `${match.winner} wins!` : "Draw"}
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between p-2 rounded bg-background">
                  <span className="text-muted-foreground">Mode</span>
                  <span className="text-white font-bold">Online Chaos Duel</span>
                </div>
                {match.chaosTokenUsed && (
                  <div className="flex justify-between p-2 rounded bg-background">
                    <span className="text-muted-foreground">Chaos Token</span>
                    <span className="text-yellow-400 font-bold">Used by {match.chaosTokenHolder}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2">
                <RetroButton onClick={() => setLocation("/play-duel")} className="w-full">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  New Match
                </RetroButton>
                <RetroButton variant="ghost" onClick={() => setLocation("/")} className="w-full">
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
