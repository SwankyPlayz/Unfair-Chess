import { pgTable, text, serial, jsonb, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const BOT_OPTIONS = [
  { 
    id: "deepseek", 
    name: "DeepSeek", 
    subtitle: "Deepseek-v3",
    model: "provider-3/deepseek-v3",
    personality: "Mysterious and cryptic, speaks in riddles about the game" 
  },
  { 
    id: "gemini", 
    name: "Gemini", 
    subtitle: "Gemini-2.5 flash-lite",
    model: "provider-5/gemini-2.5-flash-lite",
    personality: "Dual personality - alternates between supportive and ruthless" 
  },
  { 
    id: "llama", 
    name: "LLaMA", 
    subtitle: "llama-3.1-8b-instant",
    model: "provider-6/llama-3.1-8b-instant",
    personality: "Calm and zen-like, philosophical about chess and life" 
  },
  { 
    id: "gptoss", 
    name: "GPT-OSS", 
    subtitle: "Gpt-oss-120b",
    model: "provider-2/gpt-oss-120b",
    personality: "Confident and strategic, makes bold predictions" 
  },
] as const;

export type BotId = typeof BOT_OPTIONS[number]["id"];

export type GameMode = "ai" | "chaos";

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  mode: text("mode").default("ai").notNull(),
  fen: text("fen").notNull(),
  turn: text("turn").notNull(),
  isGameOver: boolean("is_game_over").default(false).notNull(),
  result: text("result"),
  winner: text("winner"),
  history: jsonb("history").$type<string[]>().default([]).notNull(),
  moveCount: integer("move_count").default(0).notNull(),
  aiComment: text("ai_comment"),
  botId: text("bot_id"),
  botName: text("bot_name"),
  botModel: text("bot_model"),
  botSubtitle: text("bot_subtitle"),
  botPersonality: text("bot_personality"),
  pastComments: jsonb("past_comments").$type<string[]>().default([]).notNull(),
  isCheck: boolean("is_check").default(false).notNull(),
  status: text("status").default("Your move").notNull(),
  player1Name: text("player1_name").default("Player 1"),
  player2Name: text("player2_name").default("Player 2"),
  chaosTokenHolder: text("chaos_token_holder"),
  chaosTokenUsed: boolean("chaos_token_used").default(false),
  rpsWinner: text("rps_winner"),
  rpsComplete: boolean("rps_complete").default(false),
});

export const sessionStats = pgTable("session_stats", {
  id: serial("id").primaryKey(),
  humanWins: integer("human_wins").default(0).notNull(),
  botWins: jsonb("bot_wins").$type<Record<string, number>>().default({}).notNull(),
  player1Wins: integer("player1_wins").default(0).notNull(),
  player2Wins: integer("player2_wins").default(0).notNull(),
});

export const insertGameSchema = createInsertSchema(games).omit({ 
  id: true, 
  isGameOver: true,
  result: true,
  winner: true,
  history: true,
  moveCount: true,
  aiComment: true,
  pastComments: true,
  isCheck: true,
  status: true,
  chaosTokenUsed: true,
  rpsComplete: true,
});

export type Game = typeof games.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;
export type SessionStats = typeof sessionStats.$inferSelect;

export const moveSchema = z.object({
  from: z.string(),
  to: z.string(),
  promotion: z.string().optional(),
  useChaosToken: z.boolean().optional(),
});

export type MoveRequest = z.infer<typeof moveSchema>;
