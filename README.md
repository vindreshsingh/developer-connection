# Developer Connection

A platform for developers to connect with each other — sign up, manage profiles, and send/receive connection requests.

> **Note:** The backend has been extracted into its own microservices stack —
> [developer-connection-microservices](https://github.com/vindreshsingh/developer-connection-microservices)
> (API gateway + per-domain services). This repository now contains the
> **frontend** (plus development docs and infrastructure).

## Project structure

- [`frontend/`](frontend) — React + Vite single-page app (RTK Query, Tailwind)
- [`ai-agents/`](ai-agents) — AI agent configs, skills, and references used during development
- [`docs/`](docs) — specs, RFCs, and the [monolith → microservices migration](docs/migration/monolith-to-microservices.md)
- [`infra/`](infra) — Terraform for AWS infrastructure

## Frontend

### Tech stack

- React with Vite
- Redux Toolkit + RTK Query for data fetching
- Tailwind CSS

### Setup

```bash
cd frontend
npm install
```

Create a `.env` file in `frontend/` (see [`.env.example`](frontend/.env.example)):

```
VITE_API_URL=http://localhost:4000   # the microservices API gateway
VITE_LIVEKIT_URL=ws://localhost:7880
VITE_SENTRY_DSN=
```

### Running

```bash
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # production build
npm run lint     # lint
```

The app talks to the API gateway at `VITE_API_URL`; run the backend from the
[microservices repo](https://github.com/vindreshsingh/developer-connection-microservices)
(`docker compose up` brings up the gateway, services, Redis, and MongoDB).
