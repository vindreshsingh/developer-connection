/**
 * LiveKitService — thin wrapper around livekit-server-sdk token generation.
 *
 * Env vars required:
 *   LIVEKIT_API_KEY     — LiveKit server API key
 *   LIVEKIT_API_SECRET  — LiveKit server API secret
 *
 * Room naming convention:  call:<callId>
 * Token TTL:               1 hour
 * Grants:                  roomJoin + canPublish + canSubscribe
 */

import { AccessToken } from 'livekit-server-sdk';

const TOKEN_TTL = '1h'; // 3600 seconds

/**
 * Generate a short-lived LiveKit room token for a participant.
 *
 * @param {object} options
 * @param {string} options.callId   — MongoDB _id of the CallSession
 * @param {string} options.userId   — participant identity (used as LiveKit identity)
 * @param {string} [options.displayName] — optional participant display name
 * @returns {Promise<string>}       JWT token string
 */
export async function generateRoomToken({ callId, userId, displayName }) {
  const apiKey    = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set in the environment.');
  }

  const roomName = `call:${callId}`;

  const at = new AccessToken(apiKey, apiSecret, {
    identity: userId,
    name:     displayName ?? userId,
    ttl:      TOKEN_TTL,
  });

  at.addGrant({
    roomJoin:     true,
    room:         roomName,
    canPublish:   true,
    canSubscribe: true,
  });

  return at.toJwt();
}
