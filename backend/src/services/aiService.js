import Anthropic from '@anthropic-ai/sdk';
import { PUBLIC_PROFILE_FIELDS } from '../constants/profileFields.js';

let client;

const getClient = () => {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
};

// claude-sonnet-4-6: lower call volume than match insights, response
// quality matters more (Phase 6 RFC Stack Decision).
export const PROFILE_FEEDBACK_MODEL = process.env.AI_PROFILE_FEEDBACK_MODEL || 'claude-sonnet-4-6';

// claude-haiku-4-5: higher call volume (one per feed card), cheaper/faster
// model is sufficient for a short "why connect" blurb (Phase 6 RFC Stack Decision).
export const MATCH_INSIGHT_MODEL = process.env.AI_MATCH_INSIGHT_MODEL || 'claude-haiku-4-5';

const formatExperience = (experience = []) => {
  if (!experience.length) return 'None listed';
  return experience
    .map((e) => {
      const start = e.startDate ? new Date(e.startDate).toISOString().slice(0, 10) : '?';
      const end = e.endDate ? new Date(e.endDate).toISOString().slice(0, 10) : 'present';
      return `- ${e.title} at ${e.company} (${start} to ${end}): ${e.description || ''}`.trim();
    })
    .join('\n');
};

const buildProfileFeedbackPrompt = (profile) =>
  `Review this developer's profile and give concrete, actionable feedback to make it more ` +
  `attractive to potential connections and collaborators. Point out what's strong and what's ` +
  `missing or vague. Keep it under 200 words.\n\n` +
  `Bio: ${profile.bio || '(empty)'}\n` +
  `Skills: ${(profile.skills || []).join(', ') || '(none listed)'}\n` +
  `Tech stack: ${(profile.techStack || []).join(', ') || '(none listed)'}\n` +
  `Experience:\n${formatExperience(profile.experience)}`;

export const getProfileFeedback = async (profile) => {
  const message = await getClient().messages.create({
    model: PROFILE_FEEDBACK_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: buildProfileFeedbackPrompt(profile) }],
  });

  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
};

// Match-insight prompts must only ever reference fields already exposed via
// PUBLIC_PROFILE_FIELDS (Phase 6 RFC Open Question #4) — applied to both the
// viewer and the target so the viewer's private fields never reach the model.
const formatPublicProfile = (user) => {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return (
    `Name: ${name}\n` +
    `Bio: ${user.bio || '(empty)'}\n` +
    `Skills: ${(user.skills || []).join(', ') || '(none listed)'}`
  );
};

const buildMatchInsightPrompt = (viewer, target) =>
  `Two developers are considering connecting on a developer-networking platform. ` +
  `Write a short, friendly "why you two should connect" insight (2-3 sentences) ` +
  `highlighting shared or complementary skills. Be specific and avoid generic ` +
  `statements.\n\n` +
  `Developer A (you):\n${formatPublicProfile(viewer)}\n\n` +
  `Developer B (potential connection):\n${formatPublicProfile(target)}`;

export const getMatchInsight = async (viewer, target) => {
  const message = await getClient().messages.create({
    model: MATCH_INSIGHT_MODEL,
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: buildMatchInsightPrompt(
          PUBLIC_PROFILE_FIELDS.reduce((acc, field) => ({ ...acc, [field]: viewer[field] }), {}),
          PUBLIC_PROFILE_FIELDS.reduce((acc, field) => ({ ...acc, [field]: target[field] }), {})
        ),
      },
    ],
  });

  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
};
