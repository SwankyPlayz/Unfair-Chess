import { db } from "./db";
import { games, matchQueue, onlineMatches, type Game, type InsertGame, type OnlineMatch, type MatchQueueEntry } from "@shared/schema";
import { eq, and, ne } from "drizzle-orm";
import { Chess } from "chess.js";

export interface IStorage {
  createGame(game: InsertGame): Promise<Game>;
  getGame(id: number): Promise<Game | undefined>;
  updateGame(id: number, game: Partial<Game>): Promise<Game>;
  
  joinQueue(playerId: string, playerName: string, timeControl?: string): Promise<MatchQueueEntry>;
  leaveQueue(playerId: string): Promise<void>;
  getQueueEntry(playerId: string): Promise<MatchQueueEntry | undefined>;
  findMatchInQueue(excludePlayerId: string, timeControl?: string): Promise<MatchQueueEntry | undefined>;
  
  createMatch(player1Id: string, player1Name: string, player2Id: string, player2Name: string, timeControl?: string): Promise<OnlineMatch>;
  getMatch(roomId: string): Promise<OnlineMatch | undefined>;
  getMatchByPlayerId(playerId: string): Promise<OnlineMatch | undefined>;
  updateMatch(roomId: string, updates: Partial<OnlineMatch>): Promise<OnlineMatch>;
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

  async joinQueue(playerId: string, playerName: string, timeControl: string = "blitz"): Promise<MatchQueueEntry> {
    const existing = await this.getQueueEntry(playerId);
    if (existing) {
      const [updated] = await db.update(matchQueue)
        .set({ status: "waiting", playerName, timeControl })
        .where(eq(matchQueue.playerId, playerId))
        .returning();
      return updated;
    }
    const [entry] = await db.insert(matchQueue).values({ playerId, playerName, timeControl }).returning();
    return entry;
  }

  async leaveQueue(playerId: string): Promise<void> {
    await db.delete(matchQueue).where(eq(matchQueue.playerId, playerId));
  }

  async getQueueEntry(playerId: string): Promise<MatchQueueEntry | undefined> {
    const [entry] = await db.select().from(matchQueue).where(eq(matchQueue.playerId, playerId));
    return entry;
  }

  async findMatchInQueue(excludePlayerId: string, timeControl: string = "blitz"): Promise<MatchQueueEntry | undefined> {
    const [entry] = await db.select().from(matchQueue)
      .where(and(
        ne(matchQueue.playerId, excludePlayerId),
        eq(matchQueue.status, "waiting"),
        eq(matchQueue.timeControl, timeControl)
      ))
      .limit(1);
    return entry;
  }

  async createMatch(player1Id: string, player1Name: string, player2Id: string, player2Name: string, timeControl: string = "blitz"): Promise<OnlineMatch> {
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const chess = new Chess();
    const deadline = new Date(Date.now() + 60000);
    
    const timeSeconds = timeControl === "bullet" ? 60 : timeControl === "rapid" ? 600 : 180;
    
    await db.delete(matchQueue).where(eq(matchQueue.playerId, player1Id));
    await db.delete(matchQueue).where(eq(matchQueue.playerId, player2Id));
    
    const [match] = await db.insert(onlineMatches).values({
      roomId,
      player1Id,
      player1Name,
      player2Id,
      player2Name,
      fen: chess.fen(),
      turn: "w",
      phase: "rps",
      rpsDeadline: deadline,
      history: [],
      moveNotations: [],
      timeControl,
      player1TimeLeft: timeSeconds,
      player2TimeLeft: timeSeconds,
      chatMessages: [],
    }).returning();
    
    return match;
  }

  async getMatch(roomId: string): Promise<OnlineMatch | undefined> {
    const [match] = await db.select().from(onlineMatches).where(eq(onlineMatches.roomId, roomId));
    return match;
  }

  async getMatchByPlayerId(playerId: string): Promise<OnlineMatch | undefined> {
    const [match] = await db.select().from(onlineMatches)
      .where(
        and(
          eq(onlineMatches.isGameOver, false),
          eq(onlineMatches.player1Id, playerId)
        )
      );
    if (match) return match;
    
    const [match2] = await db.select().from(onlineMatches)
      .where(
        and(
          eq(onlineMatches.isGameOver, false),
          eq(onlineMatches.player2Id, playerId)
        )
      );
    return match2;
  }

  async updateMatch(roomId: string, updates: Partial<OnlineMatch>): Promise<OnlineMatch> {
    const [match] = await db.update(onlineMatches)
      .set(updates)
      .where(eq(onlineMatches.roomId, roomId))
      .returning();
    return match;
  }
}

export const storage = new DatabaseStorage();
