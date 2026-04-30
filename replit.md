# True Echo VR (TEVR) Platform

## Overview

Full-stack enterprise VR remote assistance platform. Enables admins to open live WebRTC video sessions with field technicians wearing Meta Quest headsets.

## Architecture

pnpm workspace monorepo using TypeScript. Key packages:

| Package | Path | Role |
|---|---|---|
| `api-server` | `artifacts/api-server` | Express 5 + Socket.io REST API + WebRTC signaling |
| `tevr-platform` | `artifacts/tevr-platform` | React + Vite frontend |
| `api-spec` | `lib/api-spec` | OpenAPI spec + Orval codegen config |
| `api-client-react` | `lib/api-client-react` | Generated TanStack Query hooks |
| `api-zod` | `lib/api-zod` | Generated Zod validation schemas |
| `db` | `lib/db` | Drizzle ORM schema + PostgreSQL client |

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Real-time**: Socket.io (WebRTC signaling)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Frontend routing**: Wouter
- **Data fetching**: TanStack Query
- **UI**: shadcn/ui components, Tailwind CSS v4
- **Theme**: Dark control room — `--background: 222 47% 7%`, JetBrains Mono + Inter

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec (then fix `lib/api-zod/src/index.ts` to be single-line `export * from "./generated/api";`)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Database Schema

Tables: `customers`, `headsets`, `sessions`, `messages`

Seeded with: 5 customers, 10 headsets (mix of online/offline/busy)

## Frontend Routes

| Path | Page | Role |
|---|---|---|
| `/` | Login (role picker) | All |
| `/admin` | Admin Home | Client Admin |
| `/admin/troubleshoot` | Headset Selector | Client Admin |
| `/admin/session/:sessionId` | Live Session (WebRTC + chat) | Client Admin |
| `/admin/settings` | Account Settings (Point-to menu editor) | Client Admin |
| `/tech` | Tech Portal | Client Tech |
| `/tech/session?roomCode=&sessionId=` | Tech Live Stream | Client Tech |
| `/tevr` | TEVR Ops Dashboard | TEVR Internal |

## WebRTC / Socket.io Events

- `join-room` — join a room by roomCode + role
- `peer-joined` — notified when a peer enters the room
- `room-peers` — list of current room peers
- `offer` / `answer` / `ice-candidate` — WebRTC negotiation
- `chat-message` — text chat
- `point-to` — admin instructs headset to highlight a named object

## Customer Settings (Point-to Menu)

- `customers.pointToObjects` jsonb column stores `Array<{ label: string; children?: { label: string }[] }>` (one level of nesting).
- Endpoint `PUT /api/customers/{customerId}/point-to-objects` replaces the menu (validation: 1-80 char labels, max 50 items / 50 children).
- `/admin/settings` page edits the menu for the first customer (full multi-tenant scoping deferred — see follow-up tasks).
- `/admin/session` renders the menu as `<select>` with `<optgroup>` blocks for submenus.

## Unity / Quest Integration

Scripts are in `unity-integration/`:
- `TEVRStreamingManager.cs` — main WebRTC + signaling manager
- `TEVRSessionUI.cs` — example UI controller for Quest
- `README.md` — Unity setup guide

## Important Notes

- `lib/api-zod/src/index.ts` must only contain `export * from "./generated/api";` — do not restore old stale exports
- API server runs on port 8080, paths: `/api` and `/socket.io`
- Frontend runs on `$PORT` (24459 in dev), path: `/`
- Socket.io is co-hosted on the API server and accessed via `window.location.origin` with path `/socket.io/`
