# Developer Connection — Frontend

A Tinder-style web app for developers to discover and connect with each other, built with React + Vite.

## Tech stack

- React 19 + Vite (JSX)
- React Router for navigation
- Redux Toolkit Query for data fetching, caching, and cache invalidation
- Tailwind CSS v4 for styling
- Framer Motion for the swipe-card interactions

## Setup

```bash
npm install
```

Create a `.env` file with:

```
VITE_API_URL=http://localhost:3008
```

## Running

```bash
npm run dev      # start dev server (http://localhost:5173)
npm run build    # production build
```

The backend (in `../backend`) must be running and reachable at `VITE_API_URL`, with CORS configured to allow this origin and `credentials: true` (cookie-based auth).

## Structure

- `src/store/` — Redux store and RTK Query API slice (`api.js`) with all endpoints and cache tags
- `src/pages/` — route-level views (Login, Signup, Feed, Requests, Connections, Profile)
- `src/components/` — shared UI (NavBar, SwipeCard)
