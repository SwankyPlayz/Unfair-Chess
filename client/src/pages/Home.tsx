import { useCreateGame } from "@/hooks/use-game";
import { useLocation } from "wouter";
import { RetroButton } from "@/components/ui/RetroButton";
import { motion } from "framer-motion";
import { Cpu, Skull, Sword } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const { mutate: createGame, isPending } = useCreateGame();

  const handleStart = () => {
    createGame(undefined, {
      onSuccess: (game) => {
        setLocation(`/game/${game.id}`);
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      {/* Grid Background Effect */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      
      <div className="max-w-4xl w-full grid md:grid-cols-2 gap-12 items-center relative z-10">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="inline-block px-3 py-1 mb-6 border border-primary/30 rounded-full bg-primary/10 text-primary text-xs font-mono tracking-widest uppercase">
            System: Unfair AI Logic Core v9.0
          </div>
          <h1 className="text-6xl md:text-8xl font-display font-bold text-white mb-6 leading-tight">
            UNFAIR <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-500 text-glow">CHESS</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-lg leading-relaxed">
            Standard chess rules apply to <strong className="text-white">you</strong>. 
            <br/>
            <strong className="text-destructive">They do not apply to the AI.</strong>
            <br/>
            Prepare for chaos, cheating, and psychological warfare.
          </p>
          
          <div className="flex gap-4">
            <RetroButton 
              onClick={handleStart} 
              isLoading={isPending}
              className="w-full md:w-auto text-lg py-6"
            >
              Initialize Match
            </RetroButton>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative hidden md:block"
        >
          <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-destructive/20 rounded-full blur-3xl" />
          <div className="relative bg-card/80 backdrop-blur border border-border p-8 rounded-2xl shadow-2xl grid grid-cols-1 gap-6">
             <FeatureRow icon={Cpu} title="Turn-Based AI" desc="Powered by LLMs (GPT/Claude/Llama) that decide your fate." />
             <FeatureRow icon={Skull} title="Illegal Moves" desc="The AI can and will break the rules. You cannot." />
             <FeatureRow icon={Sword} title="Sacred Kings" desc="Checkmate is the only end. Kings cannot be captured." />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function FeatureRow({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="p-3 rounded-lg bg-background border border-border shrink-0">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
