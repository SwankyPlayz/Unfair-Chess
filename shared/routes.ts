import { z } from 'zod';
import { games, moveSchema, onlineMatches, matchQueue } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  illegalMove: z.object({
    message: z.string(),
  }),
};

export const createGameSchema = z.object({
  mode: z.enum(["bot", "online"]),
  botId: z.string().optional(),
  playerName: z.string().optional(),
  playerColor: z.enum(["white", "black", "random"]).optional(),
});

export const api = {
  games: {
    create: {
      method: 'POST' as const,
      path: '/api/games',
      input: createGameSchema,
      responses: {
        201: z.custom<typeof games.$inferSelect>(),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/games/:id',
      responses: {
        200: z.custom<typeof games.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    humanMove: {
      method: 'POST' as const,
      path: '/api/games/:id/move',
      input: moveSchema,
      responses: {
        200: z.custom<typeof games.$inferSelect>(),
        400: errorSchemas.illegalMove,
        404: errorSchemas.notFound,
      },
    },
    aiMove: {
      method: 'POST' as const,
      path: '/api/games/:id/ai-move',
      input: z.object({}),
      responses: {
        200: z.custom<typeof games.$inferSelect>(),
        404: errorSchemas.notFound,
        500: z.object({ message: z.string() }),
      },
    },
    resign: {
      method: 'POST' as const,
      path: '/api/games/:id/resign',
      input: z.object({}),
      responses: {
        200: z.custom<typeof games.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    reset: {
      method: 'POST' as const,
      path: '/api/games/:id/reset',
      input: z.object({}),
      responses: {
        200: z.custom<typeof games.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  matchmaking: {
    join: {
      method: 'POST' as const,
      path: '/api/matchmaking/join',
      input: z.object({
        playerId: z.string(),
        playerName: z.string(),
        timeControl: z.enum(["bullet", "blitz", "rapid"]).optional(),
      }),
      responses: {
        200: z.object({ status: z.string(), roomId: z.string().optional() }),
      },
    },
    leave: {
      method: 'POST' as const,
      path: '/api/matchmaking/leave',
      input: z.object({
        playerId: z.string(),
      }),
      responses: {
        200: z.object({ status: z.string() }),
      },
    },
    status: {
      method: 'GET' as const,
      path: '/api/matchmaking/status/:playerId',
      responses: {
        200: z.object({ 
          status: z.string(), 
          roomId: z.string().optional(),
          match: z.custom<typeof onlineMatches.$inferSelect>().optional(),
        }),
      },
    },
  },
  matches: {
    get: {
      method: 'GET' as const,
      path: '/api/matches/:roomId',
      responses: {
        200: z.custom<typeof onlineMatches.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    rps: {
      method: 'POST' as const,
      path: '/api/matches/:roomId/rps',
      input: z.object({
        playerId: z.string(),
        choice: z.enum(["rock", "paper", "scissors"]),
      }),
      responses: {
        200: z.custom<typeof onlineMatches.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    move: {
      method: 'POST' as const,
      path: '/api/matches/:roomId/move',
      input: z.object({
        playerId: z.string(),
        from: z.string(),
        to: z.string(),
        promotion: z.string().optional(),
        useChaosToken: z.boolean().optional(),
      }),
      responses: {
        200: z.custom<typeof onlineMatches.$inferSelect>(),
        400: errorSchemas.illegalMove,
        404: errorSchemas.notFound,
      },
    },
    resign: {
      method: 'POST' as const,
      path: '/api/matches/:roomId/resign',
      input: z.object({
        playerId: z.string(),
      }),
      responses: {
        200: z.custom<typeof onlineMatches.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    offerDraw: {
      method: 'POST' as const,
      path: '/api/matches/:roomId/draw',
      input: z.object({
        playerId: z.string(),
        action: z.enum(["offer", "accept", "decline"]),
      }),
      responses: {
        200: z.custom<typeof onlineMatches.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    chat: {
      method: 'POST' as const,
      path: '/api/matches/:roomId/chat',
      input: z.object({
        playerId: z.string(),
        message: z.string(),
      }),
      responses: {
        200: z.custom<typeof onlineMatches.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
};

export type MoveRequest = z.infer<typeof moveSchema>;
export type CreateGameRequest = z.infer<typeof createGameSchema>;

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
