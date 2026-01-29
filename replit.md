# Unfair Chess

## Overview

Unfair Chess is a web-based chess game where humans play against AI opponents who don't follow standard chess rules. The human player must follow normal chess rules, but the AI can make illegal moves (teleport pieces, move through others, etc.) - creating an intentionally "unfair" but entertaining experience. Players can choose from various AI personalities (ChatGPT, Claude, DeepSeek, Gemini, Grok, LLaMA), each with unique trash-talk styles and commentary.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Chess UI**: react-chessboard for board rendering, chess.js for move validation
- **Animations**: Framer Motion for smooth transitions
- **Build Tool**: Vite with custom plugins for Replit integration

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Design**: RESTful endpoints under `/api/` prefix
- **AI Integration**: OpenAI SDK connecting to OpenRouter for multi-model access
- **Development**: Vite dev server with HMR proxied through Express

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts` (shared between frontend/backend)
- **Migrations**: Drizzle Kit with `db:push` command
- **Connection**: Connection pool via `pg` package

### Key Design Patterns
- **Monorepo Structure**: Client code in `/client`, server in `/server`, shared types in `/shared`
- **Type Safety**: Zod schemas for API validation, shared between client and server
- **Path Aliases**: `@/` for client sources, `@shared/` for shared modules

## External Dependencies

### AI Services
- **OpenRouter API**: Accessed via OpenAI SDK with custom base URL
  - Environment variables: `AI_INTEGRATIONS_OPENROUTER_BASE_URL`, `AI_INTEGRATIONS_OPENROUTER_API_KEY`
  - Used for generating AI chess moves and personality-driven commentary

### Database
- **PostgreSQL**: Required for game state persistence
  - Environment variable: `DATABASE_URL`
  - Tables: `games` (stores FEN, turn, history, AI comments, game status)

### Frontend Libraries
- **shadcn/ui**: Pre-built accessible components (Radix UI primitives)
- **react-chessboard**: Chess board visualization
- **chess.js**: Chess move validation and game state management

### Build & Development
- **Vite**: Frontend bundling with React plugin
- **esbuild**: Server-side bundling for production
- **Drizzle Kit**: Database schema management