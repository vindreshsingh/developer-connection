import request from 'supertest';
import app from '../app.js';
import User from '../models/user.js';
import { hashPassword } from '../utils/sanitization.js';

const credentials = { email: 'profile.dev@example.com', password: 'password123' };

const createAuthenticatedUser = async () => {
  const user = await new User({
    firstName: 'Profile',
    lastName: 'Dev',
    email: credentials.email,
    password: await hashPassword(credentials.password),
    isEmailVerified: true,
  }).save();

  return { user, cookie: `token=${user.getJWT()}` };
};

describe('PATCH /profile', () => {
  it('persists techStack, experience, and coverImageUrl', async () => {
    const { cookie } = await createAuthenticatedUser();

    const update = {
      techStack: ['Node.js', 'React', 'MongoDB'],
      experience: [
        {
          title: 'Backend Engineer',
          company: 'DevConnect',
          startDate: '2023-01-01',
          endDate: null,
          description: 'Building the API',
        },
      ],
      coverImageUrl: 'https://example.com/cover.png',
    };

    const res = await request(app).patch('/profile').set('Cookie', cookie).send(update);

    expect(res.status).toBe(200);
    expect(res.body.user.techStack).toEqual(update.techStack);
    expect(res.body.user.coverImageUrl).toBe(update.coverImageUrl);
    expect(res.body.user.experience).toHaveLength(1);
    expect(res.body.user.experience[0]).toMatchObject({
      title: 'Backend Engineer',
      company: 'DevConnect',
    });
  });

  it('still rejects disallowed fields', async () => {
    const { cookie } = await createAuthenticatedUser();

    const res = await request(app).patch('/profile').set('Cookie', cookie).send({ email: 'new@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid fields/);
  });
});
