import { pgTable, text, serial, jsonb, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const BOT_OPTIONS = [
  { 
    id: "chatgpt", 
    name: "ChatGPT", 
    subtitle: "Gpt-oss-20b",
    model: "provider-6/gpt-oss-20b",
    personality: "Confident and strategic" 
  },
  { 
    id: "deepseek", 
    name: "DeepSeek", 
    subtitle: "Deepseek-v3",
    model: "provider-3/deepseek-v3",
    personality: "Mysterious and cryptic" 
  },
  { 
    id: "gemini", 
    name: "Gemini", 
    subtitle: "Gemini-2.0-flash",
    model: "provider-8/gemini-2.0-flash",
    personality: "Quick and ruthless" 
  },
  { 
    id: "llama", 
    name: "LLaMA", 
    subtitle: "llama-4-scout-17b-16e-instruct",
    model: "provider-6/llama-4-scout-17b-16e-instruct",
    personality: "Calm and zen-like" 
  },
] as const;

export const FALLBACK_MODELS = [
  "provider-3/deepseek-v3",
  "provider-6/llama-4-scout-17b-16e-instruct",
] as const;

export type BotId = typeof BOT_OPTIONS[number]["id"];

export type GameMode = "bot" | "online";
export type PlayerColor = "white" | "black" | "random";

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  mode: text("mode").default("bot").notNull(),
  fen: text("fen").notNull(),
  turn: text("turn").notNull(),
  isGameOver: boolean("is_game_over").default(false).notNull(),
  result: text("result"),
  winner: text("winner"),
  history: jsonb("history").$type<string[]>().default([]).notNull(),
  moveNotations: jsonb("move_notations").$type<string[]>().default([]).notNull(),
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
  playerColor: text("player_color").default("white"),
  playerName: text("player_name").default("Player"),
});

export const TIME_CONTROLS = [
  { id: "bullet", name: "Bullet", seconds: 60, icon: "Zap" },
  { id: "blitz", name: "Blitz", seconds: 180, icon: "Timer" },
  { id: "rapid", name: "Rapid", seconds: 600, icon: "Clock" },
] as const;

export type TimeControlId = typeof TIME_CONTROLS[number]["id"];

export const onlineMatches = pgTable("online_matches", {
  id: serial("id").primaryKey(),
  roomId: text("room_id").notNull().unique(),
  player1Id: text("player1_id").notNull(),
  player1Name: text("player1_name").default("Player 1").notNull(),
  player2Id: text("player2_id").notNull(),
  player2Name: text("player2_name").default("Player 2").notNull(),
  fen: text("fen").notNull(),
  turn: text("turn").default("w").notNull(),
  isGameOver: boolean("is_game_over").default(false).notNull(),
  result: text("result"),
  winner: text("winner"),
  history: jsonb("history").$type<string[]>().default([]).notNull(),
  moveNotations: jsonb("move_notations").$type<string[]>().default([]).notNull(),
  phase: text("phase").default("rps").notNull(),
  player1Rps: text("player1_rps"),
  player2Rps: text("player2_rps"),
  rpsWinner: text("rps_winner"),
  chaosTokenHolder: text("chaos_token_holder"),
  chaosTokenUsed: boolean("chaos_token_used").default(false),
  rpsDeadline: timestamp("rps_deadline"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  timeControl: text("time_control").default("blitz"),
  player1TimeLeft: integer("player1_time_left"),
  player2TimeLeft: integer("player2_time_left"),
  lastMoveAt: timestamp("last_move_at"),
  drawOfferedBy: text("draw_offered_by"),
  chatMessages: jsonb("chat_messages").$type<{playerId: string; message: string; timestamp: string}[]>().default([]),
});

export const matchQueue = pgTable("match_queue", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull().unique(),
  playerName: text("player_name").default("Player").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  status: text("status").default("waiting").notNull(),
  timeControl: text("time_control").default("blitz"),
});

export const insertGameSchema = createInsertSchema(games).omit({ 
  id: true, 
  isGameOver: true,
  result: true,
  winner: true,
  history: true,
  moveNotations: true,
  moveCount: true,
  aiComment: true,
  pastComments: true,
  isCheck: true,
  status: true,
});

export type Game = typeof games.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;
export type OnlineMatch = typeof onlineMatches.$inferSelect;
export type MatchQueueEntry = typeof matchQueue.$inferSelect;

export const moveSchema = z.object({
  from: z.string(),
  to: z.string(),
  promotion: z.string().optional(),
  useChaosToken: z.boolean().optional(),
});

export type MoveRequest = z.infer<typeof moveSchema>;
