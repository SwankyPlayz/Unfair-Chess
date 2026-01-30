import { useState } from "react";
import { motion } from "framer-motion";
import { User, Check } from "lucide-react";
import { Layout } from "@/components/Layout";
import { RetroButton } from "@/components/ui/RetroButton";
import { usePlayerStore } from "@/lib/playerStore";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const { playerName, setPlayerName } = usePlayerStore();
  const [name, setName] = useState(playerName);
  const { toast } = useToast();

  const handleSave = () => {
    if (name.trim()) {
      setPlayerName(name.trim());
      toast({
        title: "Profile Updated",
        description: `Your name is now "${name.trim()}"`,
      });
    }
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-20 h-20 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white">
            Profile
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-xl p-6 space-y-6"
        >
          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Player Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-background border border-border text-white focus:border-primary focus:outline-none transition-colors"
              placeholder="Enter your name"
              data-testid="input-player-name"
            />
          </div>

          <RetroButton
            onClick={handleSave}
            className="w-full"
            disabled={!name.trim() || name.trim() === playerName}
            data-testid="button-save-profile"
          >
            <Check className="w-4 h-4 mr-2" />
            Save Changes
          </RetroButton>
        </motion.div>
      </div>
    </Layout>
  );
}
