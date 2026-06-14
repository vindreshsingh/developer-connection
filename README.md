# Developer Connection

A platform for developers to connect with each other — sign up, manage profiles, and send/receive connection requests.

## Project structure

- [`backend/`](backend) — Express + MongoDB REST API (auth, profiles, connections)
- [`ai-agents/`](ai-agents) — AI agent configs, skills, and references used during development

## Backend

### Tech stack

- Node.js (ESM) with Express 5
- MongoDB via Mongoose
- JWT-based auth with httpOnly cookies, bcrypt password hashing
- Nodemailer for transactional emails (password reset)

### Setup

```bash
cd backend
npm install
```

Create a `.env` file in `backend/` with:

```
PORT=
DB_CONNECTION_SECRET=
JWT_SECRET=
FRONTEND_URL=
EMAIL_USER=
EMAIL_PASS=
```

### Running

```bash
npm run dev    # start API with nodemon (auto-reload)
npm start      # start API normally
npm run worker # start the BullMQ worker (requires REDIS_URL)
```

### Scalability (Phase 10)

Redis powers caching, distributed rate-limiting, the Socket.IO adapter, the
presence registry, and an event-driven job queue (BullMQ). It's **optional** —
without `REDIS_URL` the app runs as a single-instance monolith with in-memory
fallbacks and inline job execution.

```bash
docker compose up -d            # local Redis on :6379
# then add REDIS_URL=redis://localhost:6379 to backend/.env
npm run worker:dev              # drain queues (email, …) in a worker process
```

See [`docs/specs/phase10-scalability-rfc.md`](docs/specs/phase10-scalability-rfc.md)
for the architecture and AWS topology (ALB → API tasks → Redis → worker).

### API overview

- `POST /auth/signup` — create an account
- `POST /auth/login` — log in, sets an httpOnly JWT cookie
- `POST /auth/logout` — clear the auth cookie
- `POST /auth/forgot-password` — request a password reset email
- Profile and connection request routes — see [`backend/src/routes/profile.js`](backend/src/routes/profile.js) and [`backend/src/routes/connection.js`](backend/src/routes/connection.js)
