# Digital Barangay — Backend API

Backend API for the Digital Barangay full-stack application: resident + admin roles, JWT authentication, document requests with status history, officials, notices, and community concerns.

## Live deployment

**Frontend / Live Demo:** https://arjayb.github.io/Digital-Barangay-App/

**Backend API:** https://digital-barangay-backend.onrender.com/

Health check: `https://digital-barangay-backend.onrender.com/api/health`

## Stack

- Node.js + Express
- PostgreSQL via Neon
- Prisma ORM
- JWT authentication
- bcrypt password hashing
- Cloudinary for uploaded files
- Render deployment

## Architecture

```text
Resident / Admin Browser
          |
          v
   GitHub Pages frontend
          |
          v
   Render Express API
          |
       Prisma ORM
          |
          v
      Neon PostgreSQL

File uploads -> Cloudinary
```

## API overview

| Area | Base path | Auth |
|---|---|---|
| Auth | `/api/auth` | register/login public; `/me` requires token |
| Profile | `/api/users` | authenticated |
| Document requests | `/api/requests` | resident/admin |
| Officials | `/api/officials` | public |
| Notices | `/api/notices` | public |
| Concerns | `/api/concerns` | resident/admin |
| Admin | `/api/admin/*` | admin only |

## Local setup

```bash
npm install
cp .env.example .env
npm run db:push
npm run dev
```

Required environment variables include `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, and the Cloudinary credentials used when uploads are enabled.

## Creating an admin

Admins are created with the seed script rather than public self-registration:

```bash
ADMIN_NAME="Your Name" ADMIN_EMAIL="you@example.com" ADMIN_PASSWORD="yourpassword" npm run seed:admin
```

## Deployment

The production API runs on Render and uses Neon PostgreSQL. The frontend is deployed separately through GitHub Pages and communicates with this API over HTTPS. `CORS_ORIGIN` must match the deployed GitHub Pages origin.

## Companion frontend

The public application and resident/admin interfaces live in the companion repository:

https://github.com/arjayb/Digital-Barangay-App
