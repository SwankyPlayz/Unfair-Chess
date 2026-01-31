import { Link } from "wouter";
import { motion } from "framer-motion";
import { Cpu, Swords, Crown } from "lucide-react";
import { Layout } from "@/components/Layout";
import { RetroButton } from "@/components/ui/RetroButton";

export default function Home() {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] px-4 py-12">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 relative z-10"
        >
          <div className="mb-6">
            <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-zinc-700 flex items-center justify-center mx-auto">
              <Crown className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
            Unfair Chess
          </h1>
          <p className="text-xl text-muted-foreground max-w-md mx-auto">
            Where chess obeys humans, not machines.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-4 relative z-10"
        >
          <Link href="/play-bots">
            <RetroButton className="min-w-[200px] py-4 text-lg" data-testid="button-play-bots">
              <Cpu className="w-5 h-5 mr-2" />
              Play Unfair Bots
            </RetroButton>
          </Link>
          <Link href="/play-duel">
            <RetroButton variant="secondary" className="min-w-[200px] py-4 text-lg" data-testid="button-play-duel">
              <Swords className="w-5 h-5 mr-2" />
              Play Chaos Duels
            </RetroButton>
          </Link>
        </motion.div>
      </div>
    </Layout>
  );
}
