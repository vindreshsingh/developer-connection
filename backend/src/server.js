import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import connectDB from './config/database.js';
import authRouter from './routes/auth.js';
import profileRouter from './routes/profile.js';
import connectionRouter from './routes/connection.js';

const app = express();
const PORT = process.env.PORT || 3008;

app.use(express.json());
app.use(cookieParser());

app.use('/auth', authRouter);
app.use('/profile', profileRouter);
app.use('/request', connectionRouter);

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

export default app;
