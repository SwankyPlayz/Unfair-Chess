import { pgTable, text, serial, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const AI_NAMES = [
  "NEXUS-7", "OMEGA", "SENTINEL", "CIPHER", "VORTEX", 
  "PHANTOM", "ECLIPSE", "APEX", "KRONOS", "SPECTRE",
  "MAELSTROM", "HYDRA", "TEMPEST", "ORION", "NEMESIS"
];

export const AI_PERSONALITIES = [
  { id: "aggressive", name: "Aggressive", description: "Plays fast and talks trash" },
  { id: "cold", name: "Cold & Calculating", description: "Emotionless and precise" },
  { id: "trickster", name: "Trickster", description: "Loves chaos and deception" },
  { id: "dramatic", name: "Dramatic", description: "Over-the-top villain vibes" },
  { id: "ancient", name: "Ancient Entity", description: "Speaks in riddles" },
  { id: "glitchy", name: "Glitchy AI", description: "Corrupted and unstable" },
];

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  fen: text("fen").notNull(),
  turn: text("turn").notNull(),
  isGameOver: boolean("is_game_over").default(false).notNull(),
  result: text("result"),
  winner: text("winner"),
  history: jsonb("history").$type<string[]>().default([]).notNull(),
  aiComment: text("ai_comment"),
  aiName: text("ai_name").notNull(),
  aiPersonality: text("ai_personality").notNull(),
  pastComments: jsonb("past_comments").$type<string[]>().default([]).notNull(),
  isCheck: boolean("is_check").default(false).notNull(),
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
});

export type Game = typeof games.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;

export const moveSchema = z.object({
  from: z.string(),
  to: z.string(),
  promotion: z.string().optional(),
});

export type MoveRequest = z.infer<typeof moveSchema>;
