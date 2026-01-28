import { z } from 'zod';
import { games, moveSchema } from './schema';

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

export const api = {
  games: {
    create: {
      method: 'POST' as const,
      path: '/api/games',
      input: z.object({}),
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
  },
};

export type MoveRequest = z.infer<typeof moveSchema>;

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
