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
npm run dev    # start with nodemon (auto-reload)
npm start      # start normally
```

### API overview

- `POST /auth/signup` — create an account
- `POST /auth/login` — log in, sets an httpOnly JWT cookie
- `POST /auth/logout` — clear the auth cookie
- `POST /auth/forgot-password` — request a password reset email
- Profile and connection request routes — see [`backend/src/routes/profile.js`](backend/src/routes/profile.js) and [`backend/src/routes/connection.js`](backend/src/routes/connection.js)
