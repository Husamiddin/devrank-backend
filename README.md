# DevRank UZ Backend 3.0

Real PostgreSQL-backed API for DevRank UZ.

## What is included
- Real registration/login with JWT
- Persistent PostgreSQL data
- Real leaderboard with SSE live updates
- Real score / level / rank recalculation
- Challenge catalogue for Web, AI, Cyber Security, UI/UX
- Quiz + code challenge submissions
- JavaScript/TypeScript/Python/C++/C# editor support in the API contract
- Real Gemini code review; if `GEMINI_API_KEY` is missing or Gemini fails, the API returns an explicit error instead of inventing fallback AI feedback.
- Project portfolio CRUD + up to 5 project images
- Profile editing + skills
- Real messages / notifications
- IT news and events from database
- Upload persistence on disk across server restarts
- Rate-limit protection without the old accidental request loop

## Setup
1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `JWT_SECRET` and `GEMINI_API_KEY`.
2. `npm install`
3. `npx prisma@7.9.1 db push`
4. `npx prisma@7.9.1 generate`
5. `npx prisma@7.9.1 db seed`
6. `npm run dev`

The seed creates challenge/skill records only. It creates **no users, no fake leaderboard entries, no news and no events**. Therefore the leaderboard is empty until real users register, and news/events are empty until real database content is published.

Challenge code evaluation is intentionally static/safe on the API server; it does not execute arbitrary submitted code with OS access. Test checks are challenge-specific static checks plus Gemini review.
