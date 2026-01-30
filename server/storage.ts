import { db } from "./db";
import { games, sessionStats, type Game, type InsertGame, type SessionStats } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  createGame(game: InsertGame): Promise<Game>;
  getGame(id: number): Promise<Game | undefined>;
  updateGame(id: number, game: Partial<Game>): Promise<Game>;
  getStats(): Promise<SessionStats>;
  updateStats(data: { winner: string; mode: "ai" | "chaos"; botId?: string }): Promise<SessionStats>;
}

export class DatabaseStorage implements IStorage {
  async createGame(insertGame: InsertGame): Promise<Game> {
    const [game] = await db.insert(games).values(insertGame).returning();
    return game;
  }

  async getGame(id: number): Promise<Game | undefined> {
    const [game] = await db.select().from(games).where(eq(games.id, id));
    return game;
  }

  async updateGame(id: number, updates: Partial<Game>): Promise<Game> {
    const [game] = await db.update(games)
      .set(updates)
      .where(eq(games.id, id))
      .returning();
    return game;
  }

  async getStats(): Promise<SessionStats> {
    const [stats] = await db.select().from(sessionStats).limit(1);
    if (stats) return stats;
    
    const [newStats] = await db.insert(sessionStats).values({}).returning();
    return newStats;
  }

  async updateStats(data: { winner: string; mode: "ai" | "chaos"; botId?: string }): Promise<SessionStats> {
    let stats = await this.getStats();
    
    if (data.mode === "ai") {
      if (data.winner === "human") {
        stats = (await db.update(sessionStats)
          .set({ humanWins: stats.humanWins + 1 })
          .where(eq(sessionStats.id, stats.id))
          .returning())[0];
      } else if (data.winner === "ai" && data.botId) {
        const newBotWins = { ...stats.botWins, [data.botId]: (stats.botWins[data.botId] || 0) + 1 };
        stats = (await db.update(sessionStats)
          .set({ botWins: newBotWins })
          .where(eq(sessionStats.id, stats.id))
          .returning())[0];
      }
    } else {
      if (data.winner === "player1") {
        stats = (await db.update(sessionStats)
          .set({ player1Wins: stats.player1Wins + 1 })
          .where(eq(sessionStats.id, stats.id))
          .returning())[0];
      } else if (data.winner === "player2") {
        stats = (await db.update(sessionStats)
          .set({ player2Wins: stats.player2Wins + 1 })
          .where(eq(sessionStats.id, stats.id))
          .returning())[0];
      }
    }
    
    return stats;
  }
}

export const storage = new DatabaseStorage();
