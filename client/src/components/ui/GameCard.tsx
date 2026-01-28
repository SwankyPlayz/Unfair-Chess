import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface GameCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  active?: boolean;
}

export function GameCard({ children, className, active, ...props }: GameCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "relative rounded-xl border border-border bg-card/50 backdrop-blur-xl p-6 shadow-2xl overflow-hidden",
        active && "ring-1 ring-primary/50 shadow-primary/10",
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

export function TerminalCard({ children, title, className }: { children: React.ReactNode; title: string; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-black/80 font-mono text-sm overflow-hidden flex flex-col", className)}>
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border">
        <div className="w-3 h-3 rounded-full bg-red-500/50" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
        <div className="w-3 h-3 rounded-full bg-green-500/50" />
        <span className="ml-2 text-xs text-muted-foreground uppercase tracking-widest">{title}</span>
      </div>
      <div className="p-4 overflow-y-auto custom-scrollbar">
        {children}
      </div>
    </div>
  );
}
