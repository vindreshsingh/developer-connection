import { jest } from '@jest/globals';

const uploadImageBuffer = jest.fn();

jest.unstable_mockModule('../utils/cloudinary.js', () => ({
  uploadImageBuffer,
  default: {},
}));

const { default: request } = await import('supertest');
const { default: app } = await import('../app.js');
const { default: User } = await import('../models/user.js');
const { hashPassword } = await import('../utils/sanitization.js');

const credentials = { email: 'image.upload@example.com', password: 'password123' };

const createAuthenticatedUser = async () => {
  const user = await new User({
    firstName: 'Image',
    lastName: 'Uploader',
    email: credentials.email,
    password: await hashPassword(credentials.password),
    isEmailVerified: true,
  }).save();

  return `token=${user.getJWT()}`;
};

describe('POST /profile/photo and /profile/cover', () => {
  beforeEach(() => {
    uploadImageBuffer.mockReset();
  });

  it('uploads a profile photo and persists the returned URL', async () => {
    uploadImageBuffer.mockResolvedValue({ secure_url: 'https://res.cloudinary.com/demo/photo.png' });
    const cookie = await createAuthenticatedUser();

    const res = await request(app)
      .post('/profile/photo')
      .set('Cookie', cookie)
      .attach('image', Buffer.from('fake-image-bytes'), { filename: 'avatar.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.user.photoUrl).toBe('https://res.cloudinary.com/demo/photo.png');
    expect(uploadImageBuffer).toHaveBeenCalledTimes(1);
  });

  it('uploads a cover image and persists the returned URL', async () => {
    uploadImageBuffer.mockResolvedValue({ secure_url: 'https://res.cloudinary.com/demo/cover.png' });
    const cookie = await createAuthenticatedUser();

    const res = await request(app)
      .post('/profile/cover')
      .set('Cookie', cookie)
      .attach('image', Buffer.from('fake-image-bytes'), { filename: 'cover.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.user.coverImageUrl).toBe('https://res.cloudinary.com/demo/cover.png');
  });

  it('rejects non-image files with 400', async () => {
    const cookie = await createAuthenticatedUser();

    const res = await request(app)
      .post('/profile/photo')
      .set('Cookie', cookie)
      .attach('image', Buffer.from('not-an-image'), { filename: 'resume.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Only image files are allowed/);
    expect(uploadImageBuffer).not.toHaveBeenCalled();
  });

  it('rejects requests with no file attached', async () => {
    const cookie = await createAuthenticatedUser();

    const res = await request(app).post('/profile/photo').set('Cookie', cookie);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No image file provided/);
  });
});
