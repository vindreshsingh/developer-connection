import express from 'express';

const app = express();
const PORT = 3008;

app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ message: 'Developer News Feed API' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
