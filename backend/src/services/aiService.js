import Anthropic from '@anthropic-ai/sdk';

let client;

const getClient = () => {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
};

// claude-sonnet-4-6: lower call volume than match insights, response
// quality matters more (Phase 6 RFC Stack Decision).
export const PROFILE_FEEDBACK_MODEL = process.env.AI_PROFILE_FEEDBACK_MODEL || 'claude-sonnet-4-6';

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
