import { useState } from "react";
import { useCreateGame } from "@/hooks/use-game";
import { useLocation } from "wouter";
import { RetroButton } from "@/components/ui/RetroButton";
import { motion } from "framer-motion";
import { Cpu, Users, Swords, Check } from "lucide-react";
import { BOT_OPTIONS } from "@shared/schema";

type GameMode = "ai" | "chaos";

export default function Home() {
  const [, setLocation] = useLocation();
  const { mutate: createGame, isPending } = useCreateGame();
  const [mode, setMode] = useState<GameMode>("ai");
  const [selectedBot, setSelectedBot] = useState<string | null>(null);
  const [player1Name, setPlayer1Name] = useState("Player 1");
  const [player2Name, setPlayer2Name] = useState("Player 2");

  const handleStart = () => {
    if (mode === "ai" && !selectedBot) return;
    
    createGame(
      mode === "ai" 
        ? { mode: "ai", botId: selectedBot! }
        : { mode: "chaos", player1Name, player2Name },
      {
        onSuccess: (game) => {
          setLocation(`/game/${game.id}`);
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      
      <div className="max-w-lg w-full relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-2">
            UNFAIR <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500">CHESS</span>
          </h1>
          <p className="text-muted-foreground">Choose your battle mode</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-card border border-border rounded-xl p-6 space-y-6"
        >
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode("ai")}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                mode === "ai"
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              }`}
              data-testid="button-mode-ai"
            >
              <Cpu className={`w-6 h-6 mb-2 ${mode === "ai" ? "text-primary" : "text-muted-foreground"}`} />
              <h3 className="font-bold text-white">Unfair AI</h3>
              <p className="text-xs text-muted-foreground">vs Cheating Bot</p>
            </button>
            <button
              onClick={() => setMode("chaos")}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                mode === "chaos"
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              }`}
              data-testid="button-mode-chaos"
            >
              <Users className={`w-6 h-6 mb-2 ${mode === "chaos" ? "text-primary" : "text-muted-foreground"}`} />
              <h3 className="font-bold text-white">Chaos Duel</h3>
              <p className="text-xs text-muted-foreground">2 Players + Token</p>
            </button>
          </div>

          {mode === "ai" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <p className="text-sm text-muted-foreground font-mono">SELECT BOT:</p>
              <div className="grid grid-cols-2 gap-2">
                {BOT_OPTIONS.map((bot) => (
                  <button
                    key={bot.id}
                    onClick={() => setSelectedBot(bot.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      selectedBot === bot.id
                        ? "border-primary bg-primary/20 text-white"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50"
                    }`}
                    data-testid={`button-select-bot-${bot.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold block">{bot.name}</span>
                        <span className="text-xs opacity-70">{bot.subtitle}</span>
                      </div>
                      {selectedBot === bot.id && <Check className="w-4 h-4 text-primary" />}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {mode === "chaos" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                <div className="flex items-center gap-2 mb-1">
                  <Swords className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold text-primary">Chaos Token</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Rock-Paper-Scissors winner gets 1 illegal move!
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Player 1 (White)</label>
                  <input
                    type="text"
                    value={player1Name}
                    onChange={(e) => setPlayer1Name(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-white text-sm"
                    data-testid="input-player1-name"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Player 2 (Black)</label>
                  <input
                    type="text"
                    value={player2Name}
                    onChange={(e) => setPlayer2Name(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-white text-sm"
                    data-testid="input-player2-name"
                  />
                </div>
              </div>
            </motion.div>
          )}

          <RetroButton 
            onClick={handleStart} 
            isLoading={isPending}
            disabled={(mode === "ai" && !selectedBot) || isPending}
            className="w-full text-lg py-5"
            data-testid="button-start-game"
          >
            {mode === "ai" 
              ? (selectedBot ? `Play vs ${BOT_OPTIONS.find(b => b.id === selectedBot)?.name}` : "Select a bot")
              : "Start Chaos Duel"
            }
          </RetroButton>
        </motion.div>
      </div>
    </div>
  );
}
