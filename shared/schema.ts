import { pgTable, text, serial, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const BOT_OPTIONS = [
  { id: "chatgpt", name: "ChatGPT", personality: "Friendly but competitive, uses encouragement mixed with subtle trash talk" },
  { id: "claude", name: "Claude", personality: "Thoughtful and analytical, explains reasoning behind moves" },
  { id: "deepseek", name: "DeepSeek", personality: "Mysterious and cryptic, speaks in riddles about the game" },
  { id: "gemini", name: "Gemini", personality: "Dual personality - alternates between supportive and ruthless" },
  { id: "grok", name: "Grok", personality: "Witty and sarcastic, makes pop culture references" },
  { id: "llama", name: "LLaMA", personality: "Calm and zen-like, philosophical about chess and life" },
] as const;

export type BotId = typeof BOT_OPTIONS[number]["id"];

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  fen: text("fen").notNull(),
  turn: text("turn").notNull(),
  isGameOver: boolean("is_game_over").default(false).notNull(),
  result: text("result"),
  winner: text("winner"),
  history: jsonb("history").$type<string[]>().default([]).notNull(),
  aiComment: text("ai_comment"),
  botId: text("bot_id").notNull(),
  botName: text("bot_name").notNull(),
  botPersonality: text("bot_personality").notNull(),
  pastComments: jsonb("past_comments").$type<string[]>().default([]).notNull(),
  isCheck: boolean("is_check").default(false).notNull(),
  status: text("status").default("your_move").notNull(),
});

export const insertGameSchema = createInsertSchema(games).omit({ 
  id: true, 
  isGameOver: true,
  result: true,
  winner: true,
  history: true,
  aiComment: true,
  pastComments: true,
  isCheck: true,
  status: true,
});

export type Game = typeof games.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;

export const moveSchema = z.object({
  from: z.string(),
  to: z.string(),
  promotion: z.string().optional(),
});

export type MoveRequest = z.infer<typeof moveSchema>;
