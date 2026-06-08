import 'dotenv/config';
import connectDB from './config/database.js';
import app from './app.js';

const PORT = process.env.PORT || 3008;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
