# Intern Meal Credits Leaderboard Bot

A Telegram bot for HMGICS interns to run a monthly challenge:
the winner is the intern with the **lowest remaining meal credits** at month-end.

## Tech Stack

- Node.js + TypeScript
- Telegram Bot API via `grammy`
- PostgreSQL
- Prisma ORM
- OCR using `tesseract.js`

## Features Implemented

- Upload wallet screenshots directly in Telegram
- Privacy-first submission guidance: users are prompted to crop out payment QR codes
- OCR extraction of remaining balance from screenshot text
- Parser supports formats like:
  - `$123.45`
  - `123.45`
  - `Balance: $123.45`
  - `Remaining Credits: $123.45`
- One active balance per user per month (re-submission replaces latest monthly entry)
- Monthly leaderboard grouped by `(month, year)`
- Tie-breaker: lower balance wins, then earlier update timestamp
- `/me` shows user's latest current-month submission
- Manual fallback: if OCR confidence is low or parsing fails, user can enter balance manually
- Privacy-friendly: only Telegram `file_id` and OCR text are stored, no permanent local screenshot storage

## Bot Commands

- `/start` - intro and usage
- `/submit` - prompt user to upload screenshot
- `/leaderboard` - current month ranking
- `/me` - user's current month balance
- `/help` - available commands

## Project Structure

- `src/index.ts` - app entrypoint, starts bot and handles graceful shutdown
- `src/bot.ts` - Telegram command handlers, upload flow, OCR flow, manual fallback, leaderboard formatting
- `src/config/env.ts` - validates and exposes required environment variables
- `src/db/prisma.ts` - shared Prisma client
- `src/services/ocrService.ts` - OCR extraction from in-memory image buffer
- `src/services/submissionService.ts` - user/submission upsert and leaderboard queries
- `src/utils/balanceParser.ts` - OCR/manual balance parsing and validation logic
- `src/utils/date.ts` - month/year and timestamp formatting helpers
- `src/utils/telegram.ts` - display-name helper
- `src/types/session.ts` - grammY session shape for manual confirmation flow
- `prisma/schema.prisma` - database schema and indexes
- `tests/balanceParser.test.ts` - unit tests for parsing logic
- `.env.example` - required environment variable template

## Environment Variables

Copy `.env.example` to `.env` and fill values:

```bash
BOT_TOKEN=your_telegram_bot_token_here
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/meal_credits?schema=public
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Generate Prisma client:

```bash
npm run prisma:generate
```

3. Run DB migration:

```bash
npm run prisma:migrate -- --name init
```

4. Start development bot:

```bash
npm run dev
```

## Production Build

```bash
npm run build
npm start
```

## Deploy To Railway

1. Push this project to GitHub.
2. In Railway, create a new project and select **Deploy from GitHub repo**.
3. Add environment variables in Railway service settings:
   - `BOT_TOKEN`
   - `DATABASE_URL` (Supabase direct connection string with `sslmode=require`)
4. Railway will use `railway.json`:
   - Build command: `npm run build`
   - Start command: `npm run start:railway`
5. On deploy, Prisma migrations are applied via `prisma migrate deploy` before the bot starts.
6. After deployment completes, open Telegram and test:
   - `/start`
   - `/submit`
   - upload screenshot
   - `/leaderboard`

If deployment fails, check Railway logs for invalid env vars or database connectivity (`P1001`).

## Testing

Run parser tests:

```bash
npm test
```

## Database Models

### User

- `id`
- `telegramId` (unique)
- `username`
- `firstName`
- `lastName`
- `createdAt`
- `updatedAt`

### Submission

- `id`
- `userId`
- `month`
- `year`
- `balance` (0..250 validated in application logic)
- `screenshotFileId`
- `rawOcrText`
- `createdAt`
- `updatedAt`

Unique constraint: `userId + month + year` to enforce one active monthly record per user.

## Notes

- OCR is not always perfect; users can manually confirm by sending a numeric value when prompted.
- Users should upload a tight crop around the balance amount and exclude any payment QR code.
- Leaderboard output intentionally hides Telegram IDs and uses display name/username only.
