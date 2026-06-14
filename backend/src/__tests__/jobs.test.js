/**
 * Tests for Phase 9 Tasks A2/B2 — Jobs & Applications REST API.
 *
 * Covers:
 *   - POST   /jobs                                  (validation, creation)
 *   - GET    /jobs                                  (filters, blocked-user exclusion, skillMatchScore)
 *   - GET    /jobs/applications/mine                (scoped to logged-in user)
 *   - GET    /jobs/:jobId                           (404, skillMatchScore, myApplication)
 *   - PATCH  /jobs/:jobId                           (author-only update)
 *   - DELETE /jobs/:jobId                           (author-only soft-delete)
 *   - POST   /jobs/:jobId/apply                     (validation, notification)
 *   - GET    /jobs/:jobId/applications              (poster-only, skillMatchScore)
 *   - PATCH  /jobs/:jobId/applications/:id          (poster-only, notification)
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';
import User from '../models/user.js';
import JobPosting from '../models/jobPosting.js';
import JobApplication from '../models/jobApplication.js';
import Notification from '../models/notification.js';
import { hashPassword } from '../utils/sanitization.js';

const createUser = async (overrides = {}) => {
  const user = await new User({
    firstName: 'Test',
    lastName: 'User',
    email: `${Math.random().toString(36).slice(2)}@example.com`,
    password: await hashPassword('password123'),
    isEmailVerified: true,
    ...overrides,
  }).save();

  return { user, cookie: `token=${user.getJWT()}` };
};

const createJob = async (postedById, overrides = {}) =>
  JobPosting.create({
    postedBy: postedById,
    title: 'Backend Engineer',
    description: 'Build APIs.',
    type: 'full-time',
    ...overrides,
  });

// ── POST /jobs ─────────────────────────────────────────────────────────────────

describe('POST /jobs', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).post('/jobs').send({ title: 'X', description: 'Y', type: 'full-time' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when title is missing', async () => {
    const { cookie } = await createUser();

    const res = await request(app)
      .post('/jobs')
      .set('Cookie', cookie)
      .send({ description: 'Y', type: 'full-time' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when description is missing', async () => {
    const { cookie } = await createUser();

    const res = await request(app)
      .post('/jobs')
      .set('Cookie', cookie)
      .send({ title: 'X', type: 'full-time' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid job type', async () => {
    const { cookie } = await createUser();

    const res = await request(app)
      .post('/jobs')
      .set('Cookie', cookie)
      .send({ title: 'X', description: 'Y', type: 'not-a-type' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid location mode', async () => {
    const { cookie } = await createUser();

    const res = await request(app)
      .post('/jobs')
      .set('Cookie', cookie)
      .send({ title: 'X', description: 'Y', type: 'full-time', locationMode: 'space' });

    expect(res.status).toBe(400);
  });

  it('creates a job posting with defaults and populates postedBy', async () => {
    const { cookie } = await createUser({ firstName: 'Jane', lastName: 'Doe' });

    const res = await request(app)
      .post('/jobs')
      .set('Cookie', cookie)
      .send({
        title: 'Backend Engineer',
        description: 'Build APIs.',
        type: 'full-time',
        requiredSkills: ['Node.js', 'MongoDB', 'node.js'],
      });

    expect(res.status).toBe(201);
    expect(res.body.job.title).toBe('Backend Engineer');
    expect(res.body.job.locationMode).toBe('remote');
    expect(res.body.job.status).toBe('open');
    expect(res.body.job.requiredSkills).toEqual(['node.js', 'mongodb']);
    expect(res.body.job.postedBy.firstName).toBe('Jane');
  });
});

// ── GET /jobs ──────────────────────────────────────────────────────────────────

describe('GET /jobs', () => {
  it('returns open postings with pagination shape', async () => {
    const { user: poster } = await createUser();
    const { cookie } = await createUser();

    await createJob(poster._id);
    await createJob(poster._id, { status: 'closed' });
    await createJob(poster._id, { deletedAt: new Date() });

    const res = await request(app).get('/jobs').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toMatchObject({ page: 1, pageSize: 20, total: 1, totalPages: 1 });
  });

  it('excludes postings from blocked users', async () => {
    const { user: poster } = await createUser();
    const { cookie } = await createUser({ blockedUsers: [poster._id] });

    await createJob(poster._id);

    const res = await request(app).get('/jobs').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('filters by job type', async () => {
    const { user: poster } = await createUser();
    const { cookie } = await createUser();

    await createJob(poster._id, { type: 'full-time' });
    await createJob(poster._id, { type: 'internship' });

    const res = await request(app).get('/jobs?type=internship').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].type).toBe('internship');
  });

  it('filters by required skills', async () => {
    const { user: poster } = await createUser();
    const { cookie } = await createUser();

    await createJob(poster._id, { requiredSkills: ['react'] });
    await createJob(poster._id, { requiredSkills: ['python'] });

    const res = await request(app).get('/jobs?skills=react').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].requiredSkills).toEqual(['react']);
  });

  it('computes skillMatchScore based on the viewer skills and techStack', async () => {
    const { user: poster } = await createUser();
    const { cookie } = await createUser({ skills: ['React'], techStack: ['Node.js'] });

    await createJob(poster._id, { requiredSkills: ['react', 'node.js', 'graphql'] });

    const res = await request(app).get('/jobs').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data[0].skillMatchScore).toBe(67);
  });
});

// ── GET /jobs/applications/mine ───────────────────────────────────────────────

describe('GET /jobs/applications/mine', () => {
  it('returns only the logged-in user own applications', async () => {
    const { user: poster } = await createUser();
    const { user: applicant, cookie } = await createUser();
    const { user: otherApplicant, cookie: otherCookie } = await createUser();

    const job = await createJob(poster._id);
    await JobApplication.create({ jobId: job._id, applicantId: applicant._id });
    await JobApplication.create({ jobId: job._id, applicantId: otherApplicant._id });

    const res = await request(app).get('/jobs/applications/mine').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].applicantId.toString()).toBe(applicant._id.toString());
    expect(res.body.data[0].jobId.title).toBe('Backend Engineer');

    void otherCookie;
  });
});

// ── GET /jobs/:jobId ───────────────────────────────────────────────────────────

describe('GET /jobs/:jobId', () => {
  it('returns 404 for a missing job posting', async () => {
    const { cookie } = await createUser();

    const res = await request(app).get('/jobs/000000000000000000000000').set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('returns 404 for a soft-deleted job posting', async () => {
    const { user: poster, cookie } = await createUser();
    const job = await createJob(poster._id, { deletedAt: new Date() });

    const res = await request(app).get(`/jobs/${job._id}`).set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('returns myApplication: null for a non-owner who has not applied', async () => {
    const { user: poster } = await createUser();
    const { cookie } = await createUser();

    const job = await createJob(poster._id);

    const res = await request(app).get(`/jobs/${job._id}`).set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.job.myApplication).toBeNull();
    expect(res.body.job.skillMatchScore).toBe(0);
  });

  it('returns myApplication: { _id, status } for a non-owner who has applied', async () => {
    const { user: poster } = await createUser();
    const { user: applicant, cookie } = await createUser();

    const job = await createJob(poster._id);
    const application = await JobApplication.create({ jobId: job._id, applicantId: applicant._id });

    const res = await request(app).get(`/jobs/${job._id}`).set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.job.myApplication).toMatchObject({
      _id: application._id.toString(),
      status: 'pending',
    });
  });

  it('does not include myApplication for the posting owner', async () => {
    const { user: poster, cookie } = await createUser();
    const job = await createJob(poster._id);

    const res = await request(app).get(`/jobs/${job._id}`).set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.job.myApplication).toBeUndefined();
  });
});

// ── PATCH /jobs/:jobId ─────────────────────────────────────────────────────────

describe('PATCH /jobs/:jobId', () => {
  it('returns 403 for a non-author', async () => {
    const { user: poster } = await createUser();
    const { cookie } = await createUser();

    const job = await createJob(poster._id);

    const res = await request(app).patch(`/jobs/${job._id}`).set('Cookie', cookie).send({ title: 'New Title' });
    expect(res.status).toBe(403);
  });

  it('returns 400 for an invalid status', async () => {
    const { user: poster, cookie } = await createUser();
    const job = await createJob(poster._id);

    const res = await request(app).patch(`/jobs/${job._id}`).set('Cookie', cookie).send({ status: 'archived' });
    expect(res.status).toBe(400);
  });

  it('allows the author to update fields', async () => {
    const { user: poster, cookie } = await createUser();
    const job = await createJob(poster._id);

    const res = await request(app)
      .patch(`/jobs/${job._id}`)
      .set('Cookie', cookie)
      .send({ title: 'Senior Backend Engineer', status: 'closed' });

    expect(res.status).toBe(200);
    expect(res.body.job.title).toBe('Senior Backend Engineer');
    expect(res.body.job.status).toBe('closed');
  });
});

// ── DELETE /jobs/:jobId ────────────────────────────────────────────────────────

describe('DELETE /jobs/:jobId', () => {
  it('returns 403 for a non-author', async () => {
    const { user: poster } = await createUser();
    const { cookie } = await createUser();

    const job = await createJob(poster._id);

    const res = await request(app).delete(`/jobs/${job._id}`).set('Cookie', cookie);
    expect(res.status).toBe(403);
  });

  it('soft-deletes the posting for its author', async () => {
    const { user: poster, cookie } = await createUser();
    const job = await createJob(poster._id);

    const res = await request(app).delete(`/jobs/${job._id}`).set('Cookie', cookie);
    expect(res.status).toBe(200);

    const getRes = await request(app).get(`/jobs/${job._id}`).set('Cookie', cookie);
    expect(getRes.status).toBe(404);
  });
});

// ── POST /jobs/:jobId/apply ───────────────────────────────────────────────────

describe('POST /jobs/:jobId/apply', () => {
  it('returns 400 when applying to your own job posting', async () => {
    const { user: poster, cookie } = await createUser();
    const job = await createJob(poster._id);

    const res = await request(app).post(`/jobs/${job._id}/apply`).set('Cookie', cookie).send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when the job posting is closed', async () => {
    const { user: poster } = await createUser();
    const { cookie } = await createUser();

    const job = await createJob(poster._id, { status: 'closed' });

    const res = await request(app).post(`/jobs/${job._id}/apply`).set('Cookie', cookie).send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when the cover note exceeds 1000 characters', async () => {
    const { user: poster } = await createUser();
    const { cookie } = await createUser();

    const job = await createJob(poster._id);

    const res = await request(app)
      .post(`/jobs/${job._id}/apply`)
      .set('Cookie', cookie)
      .send({ coverNote: 'a'.repeat(1001) });

    expect(res.status).toBe(400);
  });

  it('creates an application, increments applicationCount, and notifies the poster', async () => {
    const { user: poster } = await createUser();
    const { cookie } = await createUser();

    const job = await createJob(poster._id);

    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    app.set('io', { to });

    const res = await request(app)
      .post(`/jobs/${job._id}/apply`)
      .set('Cookie', cookie)
      .send({ coverNote: 'I would love to join.' });

    expect(res.status).toBe(201);
    expect(res.body.application.status).toBe('pending');

    const updatedJob = await JobPosting.findById(job._id);
    expect(updatedJob.applicationCount).toBe(1);

    const notifications = await Notification.find({ recipientId: poster._id, type: 'job_application' });
    expect(notifications).toHaveLength(1);

    expect(to).toHaveBeenCalledWith(`user:${poster._id}`);
    expect(emit).toHaveBeenCalledWith('notification:new', expect.anything());

    app.set('io', undefined);
  });

  it('returns 409 when applying twice to the same job posting', async () => {
    const { user: poster } = await createUser();
    const { cookie } = await createUser();

    const job = await createJob(poster._id);

    await request(app).post(`/jobs/${job._id}/apply`).set('Cookie', cookie).send({});
    const res = await request(app).post(`/jobs/${job._id}/apply`).set('Cookie', cookie).send({});

    expect(res.status).toBe(409);
  });
});

// ── GET /jobs/:jobId/applications ─────────────────────────────────────────────

describe('GET /jobs/:jobId/applications', () => {
  it('returns 403 for a non-poster', async () => {
    const { user: poster } = await createUser();
    const { user: applicant, cookie: applicantCookie } = await createUser();
    const { cookie: otherCookie } = await createUser();

    const job = await createJob(poster._id);
    await JobApplication.create({ jobId: job._id, applicantId: applicant._id });

    const res = await request(app).get(`/jobs/${job._id}/applications`).set('Cookie', otherCookie);
    expect(res.status).toBe(403);

    void applicantCookie;
  });

  it('returns applicants with skillMatchScore for the poster', async () => {
    const { user: poster, cookie } = await createUser();
    const { user: applicant } = await createUser({ skills: ['react'] });

    const job = await createJob(poster._id, { requiredSkills: ['react', 'node.js'] });
    await JobApplication.create({ jobId: job._id, applicantId: applicant._id });

    const res = await request(app).get(`/jobs/${job._id}/applications`).set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].applicantId.firstName).toBe('Test');
    expect(res.body.data[0].skillMatchScore).toBe(50);
  });
});

// ── PATCH /jobs/:jobId/applications/:applicationId ────────────────────────────

describe('PATCH /jobs/:jobId/applications/:applicationId', () => {
  it('returns 403 for a non-poster', async () => {
    const { user: poster } = await createUser();
    const { user: applicant } = await createUser();
    const { cookie: otherCookie } = await createUser();

    const job = await createJob(poster._id);
    const application = await JobApplication.create({ jobId: job._id, applicantId: applicant._id });

    const res = await request(app)
      .patch(`/jobs/${job._id}/applications/${application._id}`)
      .set('Cookie', otherCookie)
      .send({ status: 'shortlisted' });

    expect(res.status).toBe(403);
  });

  it('returns 400 for an invalid status', async () => {
    const { user: poster, cookie } = await createUser();
    const { user: applicant } = await createUser();

    const job = await createJob(poster._id);
    const application = await JobApplication.create({ jobId: job._id, applicantId: applicant._id });

    const res = await request(app)
      .patch(`/jobs/${job._id}/applications/${application._id}`)
      .set('Cookie', cookie)
      .send({ status: 'archived' });

    expect(res.status).toBe(400);
  });

  it('updates the application status and notifies the applicant', async () => {
    const { user: poster, cookie } = await createUser();
    const { user: applicant } = await createUser();

    const job = await createJob(poster._id);
    const application = await JobApplication.create({ jobId: job._id, applicantId: applicant._id });

    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    app.set('io', { to });

    const res = await request(app)
      .patch(`/jobs/${job._id}/applications/${application._id}`)
      .set('Cookie', cookie)
      .send({ status: 'shortlisted' });

    expect(res.status).toBe(200);
    expect(res.body.application.status).toBe('shortlisted');

    const notifications = await Notification.find({ recipientId: applicant._id, type: 'job_application_status' });
    expect(notifications).toHaveLength(1);

    expect(to).toHaveBeenCalledWith(`user:${applicant._id}`);
    expect(emit).toHaveBeenCalledWith('notification:new', expect.anything());

    app.set('io', undefined);
  });
});
