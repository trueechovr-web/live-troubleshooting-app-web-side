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

## Client Admin Routing

Multi-client routing with `/:customerId` in all admin sub-routes:

| Route | Component |
|---|---|
| `/admin` | `ClientList` — lists all TEVR customers as clickable cards |
| `/admin/:customerId` | `AdminHome` — per-client admin portal |
| `/admin/:customerId/troubleshoot` | `AdminTroubleshoot` |
| `/admin/:customerId/session/:sessionId` | `AdminSession` |
| `/admin/:customerId/settings` | `AdminSettings` |
| `/admin/:customerId/settings/point-to-objects` | `AdminPointToObjects` |
| `/admin/:customerId/settings/qr-dictionary` | `AdminQrDictionary` |
| `/admin/:customerId/settings/qr-dictionary/:locationId` | `AdminQrLocation` |
| `/admin/:customerId/session-history` | `AdminSessionHistory` |
| `/tevr/:customerId/session-history` | `AdminSessionHistory` |

All admin pages use `useParams<{ customerId }>()` from wouter and `useGetCustomer(customerId)` (not `useListCustomers()[0]`). The TEVR dashboard (`/tevr`) customer rows are also clickable and navigate to `/admin/:customerId`.

## Database Schema

Tables: `customers`, `headsets`, `sessions`, `messages`, `locations`, `qr_codes`, `qr_dictionary`, `point_to_events`

- `locations` — named physical sites per customer
- `qr_codes` — spatial calibration data (position x/y/z, rotation x/y/z/w) per location, pushed by Meta Quest headsets
- `qr_dictionary` — company-wide QR value → name mapping per customer
- `point_to_events` — persisted log of point-to object events per session (objectName, timestamp)
- `sessions.transcript` — full transcript text built from appended chunks (when Session History enabled)
- `sessions.summary` — AI-generated summary created async when session ends (when Session History enabled)
- `customers.sessionHistoryEnabled` — boolean premium feature flag per customer

Seeded with: 5 customers, 10 headsets (mix of online/offline/busy)

## Frontend Routes

| Path | Page | Role |
|---|---|---|
| `/` | Login (role picker) | All |
| `/admin` | Admin Home | Client Admin |
| `/admin/troubleshoot` | Headset Selector | Client Admin |
| `/admin/session/:sessionId` | Live Session (WebRTC + chat) | Client Admin |
| `/admin/settings` | Account Settings hub (tile grid) | Client Admin |
| `/admin/settings/point-to-objects` | Point-to Object Menu editor | Client Admin |
| `/admin/settings/qr-dictionary` | QR Code Dictionary (name dict + locations) | Client Admin |
| `/admin/settings/qr-dictionary/:locationId` | Location calibration detail | Client Admin |
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

## Customer Settings

### Point-to Menu
- `customers.pointToObjects` jsonb column stores `Array<{ label: string; children?: { label: string }[] }>` (one level of nesting).
- Endpoint `PUT /api/customers/{customerId}/point-to-objects` replaces the menu (validation: 1-80 char labels, max 50 items / 50 children).
- `/admin/settings/point-to-objects` page edits the menu for the first customer.
- `/admin/session` renders the menu as `<select>` with `<optgroup>` blocks for submenus.

### QR Code Dictionary
- **Name dictionary**: `qr_dictionary` table — company-wide `qrValue → name` mapping. Editable in `/admin/settings/qr-dictionary`. Changes saved with batch Save/Discard (same pattern as Point-to Menu).
- **Locations**: `locations` table — named physical sites per customer. Each location has its own calibrated QR code set in `qr_codes`.
- **Calibration flow**: Unity app → user selects location → taps Start Calibration → scans QR codes → taps Stop Calibration → Unity calls `PUT /api/locations/{locationId}/qr-codes` with `{ headsetId, qrCodes: [{qrValue, position, rotation}] }` — atomically replaces existing data.
- **Headset app-start sync**: `GET /api/headsets/{headsetId}/startup-data?locationId=…` — returns merged spatial QR data (with names resolved from dictionary) plus the full name dictionary. Called by Unity when the app starts.

### Session History (Premium Feature)
- `customers.sessionHistoryEnabled` boolean toggled by TEVR admins in `/tevr/:id/settings` → Premium Features section
- When enabled: admin-session page starts dual-stream Deepgram transcription (admin mic + headset audio) using raw WebSocket to `wss://api.deepgram.com/v1/listen` (requires `VITE_DEEPGRAM_API_KEY` env var)
- Each transcript chunk is POSTed to `POST /api/sessions/:id/transcript-chunk` which appends to `sessions.transcript`
- When session ends (DELETE /api/sessions/:id), AI summary generated via OpenAI fire-and-forget (requires `OPENAI_API_KEY` env var); written to `sessions.summary`
- Session History page (`/tevr/:id/session-history` or `/admin/:id/session-history`) shows completed sessions with AI summaries
- Session History card appears on admin home only when `sessionHistoryEnabled` is true

### API routes
- `PUT /api/customers/{id}/feature-flags` — toggle sessionHistoryEnabled
- `GET /api/customers/{id}/session-history` — returns [] when feature disabled or no sessions
- `POST /api/sessions/{id}/transcript-chunk` — append transcript chunk { speaker, text }
- `GET/POST /api/customers/{id}/locations` — list / create locations
- `DELETE /api/customers/{id}/locations/{locationId}` — delete location + cascade QR codes
- `GET /api/locations/{id}/qr-codes` — get calibration data
- `PUT /api/locations/{id}/qr-codes` — import calibration (atomic replace)
- `DELETE /api/locations/{id}/qr-codes` — clear calibration
- `GET/POST /api/customers/{id}/qr-dictionary` — list / create entries
- `PUT/DELETE /api/customers/{id}/qr-dictionary/{entryId}` — update / delete entries
- `GET /api/headsets/{id}/startup-data?locationId=…` — headset app-start sync

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
