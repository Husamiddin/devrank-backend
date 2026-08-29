# Windows quick start

## Backend
```bat
cd devrank-backend
copy .env.example .env
npm install
npx prisma@7.9.1 db push
npx prisma@7.9.1 generate
npx prisma@7.9.1 db seed
npm run dev
```

Open `http://localhost:5000`.

## Gemini
Put your own Gemini API key into `.env`:
```env
GEMINI_API_KEY=AQ.Ab8RN6Ltp89-yM68h8DqfD2M-6OIIW5odMfrjn69ph35tgPmXQ
GEMINI_MODEL=gemini-2.5-flash
```
Never commit that key to GitHub.

## Old local demo users
The seed does not add fake developers. If the existing PostgreSQL database still contains the old demo accounts from an earlier version, run:
```bat
npm run prisma:cleanup-demo
```
Only the hard-coded old demo addresses are removed by that command.

## Important
Do not use `prisma migrate reset` if you need to keep existing user data.
`prisma db push` is the intended first sync for this clean package.
