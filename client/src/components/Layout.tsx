import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Home, Cpu, Swords, User, Crown } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();

  const menuItems = [
    { path: "/", label: "Home", icon: Home },
    { path: "/play-bots", label: "Play Unfair Bots", icon: Cpu },
    { path: "/play-duel", label: "Play Chaos Duels", icon: Swords },
    { path: "/profile", label: "Profile", icon: User },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <Link href="/">
            <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center cursor-pointer hover:bg-zinc-800 transition-colors">
              <Crown className="w-5 h-5 text-white" />
            </div>
          </Link>
          
          <Link href="/">
            <span className="font-display font-bold text-lg text-white cursor-pointer">
              Unfair Chess
            </span>
          </Link>
          
          <button
            onClick={() => setMenuOpen(true)}
            className="p-2 hover-elevate rounded-lg"
            data-testid="button-menu"
          >
            <Menu className="w-5 h-5 text-white" />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-72 bg-card border-l border-border z-50 flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <span className="font-display font-bold text-white">Menu</span>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="p-2 hover-elevate rounded-lg"
                  data-testid="button-close-menu"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              
              <nav className="flex-1 p-4 space-y-2">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.path;
                  return (
                    <Link key={item.path} href={item.path}>
                      <div
                        onClick={() => setMenuOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors ${
                          isActive
                            ? "bg-primary/20 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-white"
                        }`}
                        data-testid={`menu-link-${item.path.replace("/", "") || "home"}`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1">
        {children}
      </main>

      <footer className="bg-card border-t border-border py-4 text-center">
        <p className="text-sm text-muted-foreground">
          Designed & Engineered by Ayush. &copy; 2026
        </p>
      </footer>
    </div>
  );
}
