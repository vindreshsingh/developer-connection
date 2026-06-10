import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
process.env.EMAIL_USER = process.env.EMAIL_USER || 'test@example.com';
process.env.EMAIL_PASS = process.env.EMAIL_PASS || 'test-pass';
process.env.SKIP_EMAIL_VERIFICATION = 'false';
// 64-char hex key required by AES-256-GCM encryption util
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a'.repeat(64);
// OAuth provider test credentials
process.env.GITHUB_CLIENT_ID     = process.env.GITHUB_CLIENT_ID     || 'gh-test-client-id';
process.env.GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'gh-test-client-secret';
process.env.GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || 'google-test-client-id';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'google-test-client-secret';
process.env.LINKEDIN_CLIENT_ID     = process.env.LINKEDIN_CLIENT_ID     || 'li-test-client-id';
process.env.LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || 'li-test-client-secret';
process.env.OAUTH_CALLBACK_BASE_URL = process.env.OAUTH_CALLBACK_BASE_URL || 'http://localhost:3008';

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterEach(async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
});
