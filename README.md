# FieldFlow

Field service management by Marcos Solutions. A portfolio project connecting service scheduling to technician execution, built with Next.js, React, TypeScript, Express and MySQL.

[Leia em português](README.pt-BR.md)

## Features

- Daily dashboard, date navigation, search and status filters.
- Customer registration and visit scheduling with technician, category and priority.
- Schedule conflict detection, including overlapping and enclosing appointments.
- Manager and technician views, with server-enforced authorization in API mode.
- Start visits, complete a four-step checklist, add notes and an optional photo, and finish service.
- Visit history and manager cancellation.
- Responsive CSS, native dialogs, accessible control names and visible keyboard focus.

## Run the browser demo

Use Node.js 24 and npm:

```sh
npm ci
npm run dev -- --port 3000
```

Open http://localhost:3000. The demo uses fictional records stored in this browser's localStorage. Profile switching is a UI demonstration, not authentication. Do not enter real customer information. Clearing site data resets the demo. The hosted preview currently has restricted access, so local setup is the public way to try the project.

## Run with the API and MySQL

With Docker and Docker Compose installed:

```sh
cp .env.example .env
# Replace every sample value in .env with a strong password.
docker compose up --build
```

Open http://localhost:3333. Docker builds the frontend with `NEXT_PUBLIC_API_URL=/api`; Express serves both the exported frontend and API on the same origin.

Initial local accounts: `marcos@fieldflow.local` (manager), `ana@fieldflow.local`, `lucas@fieldflow.local`, and `bruno@fieldflow.local` (technicians). They use the configured `SEED_PASSWORD` of at least 12 characters. These are development accounts, not a production account provisioning flow. Changing this environment value does not change passwords in an existing database.

## Design decisions

Business rules in `lib/domain.ts` are shared by the browser demo and API. The API determines permissions from the authenticated user, rather than trusting a role supplied by the browser. Passwords use scrypt with individual salts; bearer sessions expire after eight hours and are revoked on logout. Tokens live only in frontend memory, so refreshing requires another login. Server sessions are also in memory and are lost on restart.

For this single-team MVP, operational state is one JSON document in MySQL, with accounts in a separate table. Transactions lock the operational row using `SELECT ... FOR UPDATE` before checking and saving changes. This serializes writes to prevent simultaneous conflicting bookings, at the cost of scalability. A normalized relational model with technician-specific locking is a future improvement.

Scheduled times are Brasília wall-clock times. Visits must start and end on the same date. Optional JPEG/PNG photos are limited to 1 MB and stored inline. Production use needs dedicated image storage and processing, individual account management, password recovery, HTTPS, backups, migrations and shared sessions.

There is no multi-tenant support, real-time synchronization, rescheduling, customer editing or offline synchronization. Data refreshes after actions; another user's changes may not immediately appear on screen, while the server still validates conflicts.

## Verification

```sh
npm test
npm run build
npm run typecheck
```

The original implementation passed six automated tests, TypeScript checks and a production build. Tests cover scheduling conflicts, adjacent slots, invalid dates, role restrictions, cancellation, required completion fields, photo validation and a real HTTP API with a serialized in-memory repository. The API test also checks concurrent scheduling and logout revocation.

**Docker and real MySQL 8.4 integration passed on November 10, 2026.** [Verified GitHub Actions run](https://github.com/Santoszoi/fieldflow/actions/runs/42900315558).

The workflow builds the production container and starts the actual Compose stack. It verifies authentication, technician permissions, five concurrent bookings (one accepted and four rejected), rollback of invalid updates, visit completion, logout revocation and persistence after restarting both the application and MySQL. It also confirms that accounts survive the restart while old sessions are invalidated. The six existing tests passed in the same run.

The integration workflow runs for relevant changes on `main` and can also be triggered manually from Actions. It generates disposable passwords, masks them in logs, and removes only its isolated CI stack and volume. To run it locally against a disposable Compose stack, start the stack with the required database/seed environment variables, then use `FIELDFLOW_INTEGRATION=1 node scripts/test-mysql.mjs`. Keep `SEED_PASSWORD` exported in the shell. The script creates test records and restarts the containers; do not point it at an operational environment.

Browser checks covered the dashboard, conflict messages, technician visibility, checklist completion and persistence after reload. Responsive styles are implemented, but no physical mobile-device inspection was performed.

## Source map

| Path | Responsibility |
| --- | --- |
| `app/` | React UI and styles |
| `lib/domain.ts` | Shared business rules |
| `server/app.ts` | HTTP API and authentication |
| `server/index.ts` | MySQL persistence and transactions |
| `tests/` | Domain and HTTP tests |

## Next improvements

Normalize operational tables, expand database integration coverage, and move photos to dedicated object storage.
