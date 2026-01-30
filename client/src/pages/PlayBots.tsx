import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Cpu } from "lucide-react";
import { Layout } from "@/components/Layout";
import { RetroButton } from "@/components/ui/RetroButton";
import { useCreateGame } from "@/hooks/use-game";
import { BOT_OPTIONS } from "@shared/schema";
import { usePlayerStore } from "@/lib/playerStore";

export default function PlayBots() {
  const [, setLocation] = useLocation();
  const { mutate: createGame, isPending } = useCreateGame();
  const playerName = usePlayerStore((state) => state.playerName);

  const handlePlayBot = (botId: string) => {
    createGame(
      { 
        mode: "bot", 
        botId, 
        playerName,
        playerColor: "white" 
      },
      {
        onSuccess: (game) => {
          setLocation(`/game/${game.id}`);
        },
      }
    );
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-display font-bold text-white mb-2">
            Play Unfair Bots
          </h1>
          <p className="text-muted-foreground">
            Choose your AI opponent. They don't play fair!
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {BOT_OPTIONS.map((bot, index) => (
            <motion.div
              key={bot.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-card border border-border rounded-xl p-6 space-y-4"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/20 border border-primary/30">
                  <Cpu className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white">{bot.name}</h3>
                  <p className="text-sm text-muted-foreground font-mono">{bot.subtitle}</p>
                </div>
              </div>
              
              <RetroButton
                onClick={() => handlePlayBot(bot.id)}
                disabled={isPending}
                className="w-full"
                data-testid={`button-play-${bot.id}`}
              >
                Play vs {bot.name}
              </RetroButton>
            </motion.div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
