import { pgTable, text, serial, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  fen: text("fen").notNull(),
  turn: text("turn").notNull(), // 'w' or 'b'
  isGameOver: boolean("is_game_over").default(false).notNull(),
  result: text("result"), // 'checkmate', 'draw', etc.
  history: jsonb("history").$type<string[]>().default([]).notNull(),
  aiComment: text("ai_comment"),
});

export const insertGameSchema = createInsertSchema(games).omit({ 
  id: true, 
  isGameOver: true,
  result: true,
  history: true,
  aiComment: true
});

export type Game = typeof games.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;

export const moveSchema = z.object({
  from: z.string(),
  to: z.string(),
  promotion: z.string().optional(),
});

export type MoveRequest = z.infer<typeof moveSchema>;
