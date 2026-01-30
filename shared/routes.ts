import { z } from 'zod';
import { games, moveSchema, sessionStats } from './schema';

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
  mode: z.enum(["ai", "chaos"]),
  botId: z.string().optional(),
  player1Name: z.string().optional(),
  player2Name: z.string().optional(),
});

export const rpsSchema = z.object({
  winner: z.enum(["player1", "player2"]),
});

export const statsUpdateSchema = z.object({
  winner: z.string(),
  mode: z.enum(["ai", "chaos"]),
  botId: z.string().optional(),
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
    rps: {
      method: 'POST' as const,
      path: '/api/games/:id/rps',
      input: rpsSchema,
      responses: {
        200: z.custom<typeof games.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  stats: {
    get: {
      method: 'GET' as const,
      path: '/api/stats',
      responses: {
        200: z.custom<typeof sessionStats.$inferSelect>(),
      },
    },
    update: {
      method: 'POST' as const,
      path: '/api/stats',
      input: statsUpdateSchema,
      responses: {
        200: z.custom<typeof sessionStats.$inferSelect>(),
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
