# Digital Barangay — Backend API

Backend for the Digital Barangay full-stack app (Version 1 scope): resident + admin roles, JWT auth, document requests with status history, officials directory, notices, and concern reports.

## Stack

Node.js, Express, PostgreSQL via [Neon](https://neon.tech) (free, no credit card), Prisma ORM, JWT auth, bcrypt password hashing.

## Setup

```bash
npm install              # also runs `prisma generate` automatically
cp .env.example .env      # then fill in your own values
npm run db:push           # creates the tables on your Neon database
npm run dev                # nodemon, auto-restarts on changes
# or
npm start
```

`.env` values needed:

- `DATABASE_URL` — your Neon Postgres connection string
- `JWT_SECRET` — any long random string
- `CORS_ORIGIN` — your GitHub Pages URL (e.g. `https://your-username.github.io`)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — from your free Cloudinary dashboard, needed for document/photo uploads on requests and concerns

## Creating your first admin

There's no self-registration path for admins (residents can't grant themselves that role). Once `DATABASE_URL` is set in `.env` and `npm run db:push` has run, run:

```bash
ADMIN_NAME="Your Name" ADMIN_EMAIL="you@example.com" ADMIN_PASSWORD="yourpassword" npm run seed:admin
```

This creates the account (or promotes an existing user with that email to admin if one already exists). Log in with those credentials via `POST /api/auth/login`.

## File uploads

Requests (`POST /api/requests`) and concerns (`POST /api/concerns`) both accept up to 5 and 3 files respectively under the multipart field name `attachments`. Files go straight to Cloudinary — nothing is written to Render's disk, so uploads survive redeploys.

## API overview

| Area | Base path | Auth |
|---|---|---|
| Auth | `/api/auth` | public (register/login), token required for `/me` |
| Profile | `/api/users` | resident/admin (any logged-in user) |
| Document requests | `/api/requests` | resident/admin |
| Officials directory | `/api/officials` | public |
| Notices | `/api/notices` | public |
| Concerns | `/api/concerns` | resident/admin |
| Admin | `/api/admin/*` | admin only |

Full endpoint list is in `digital-barangay-backend-requirements.md` from the planning step.

## Deploying (free)

1. Push this folder to its own GitHub repo (or a `/server` folder in your existing repo).
2. Create a free Neon project (neon.tech), grab the connection string as `DATABASE_URL`.
3. Run `npm run db:push` locally once against that `DATABASE_URL` to create the tables.
4. On Render: New → Web Service → connect the repo → build command `npm install`, start command `npm start` → add the env vars from `.env.example` in the Render dashboard.
5. Point your GitHub Pages frontend's fetch calls at the Render URL, and set `CORS_ORIGIN` to your Pages URL.

## Notes

- To promote a resident to admin later (instead of the seed script), use `PATCH /api/admin/users/:id` as an existing admin.
