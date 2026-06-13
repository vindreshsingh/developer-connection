import 'dotenv/config';
import http from 'http';
import connectDB from './config/database.js';
import app from './app.js';
import { initSockets } from './sockets/index.js';

const PORT = process.env.PORT || 3008;

const httpServer = http.createServer(app);
// Socket.IO attaches to the SAME HTTP server — no second server, no second
// auth system (it reuses the existing JWT-cookie auth). See RFC architecture.
const { io } = initSockets(httpServer);
// Attach io to app so REST route handlers can emit socket events
// (e.g. call_incoming notification) without a second import chain.
app.set('io', io);

connectDB().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
