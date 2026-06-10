/**
 * ParticipantTile — renders a single participant's video in the group call grid.
 *
 * Receives a flat participant snapshot from `useGroupCall` which includes a
 * `videoTrack` reference (a LiveKit LocalVideoTrack or RemoteVideoTrack).
 * Attaches / detaches the track to the <video> element whenever it changes.
 *
 * @param {{
 *   participant: {
 *     identity:    string,
 *     name:        string,
 *     isLocal:     boolean,
 *     videoTrack:  object | null,   // LiveKit VideoTrack (has .attach / .detach)
 *     isMuted:     boolean,
 *     isCameraOff: boolean,
 *   }
 * }} props
 */

import { useEffect, useRef } from 'react';
import './ParticipantTile.scss';

export default function ParticipantTile({ participant }) {
  const {
    name,
    isLocal,
    videoTrack,
    isMuted,
    isCameraOff,
  } = participant;

  const videoRef = useRef(null);

  // Attach / detach the LiveKit video track whenever it changes.
  // A null videoTrack (camera off or not yet enabled) just shows the avatar.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoTrack) return undefined;

    videoTrack.attach(el);
    return () => {
      videoTrack.detach(el);
    };
  }, [videoTrack]);

  const initial = (name ?? '?').charAt(0).toUpperCase();

  return (
    <div className={`dc-participant-tile${isLocal ? ' dc-participant-tile--local' : ''}`}>
      {/* Video element — hidden via CSS when camera is off */}
      <video
        ref={videoRef}
        className="dc-participant-tile-video"
        autoPlay
        playsInline
        // Mirror local camera so it feels natural
        style={isLocal ? { transform: 'scaleX(-1)' } : undefined}
        muted={isLocal} // never echo local audio
      />

      {/* Avatar shown when camera is off or track not yet available */}
      {(isCameraOff || !videoTrack) && (
        <div className="dc-participant-tile-avatar" aria-hidden="true">
          {initial}
        </div>
      )}

      {/* Name + mute badge */}
      <div className="dc-participant-tile-footer">
        <span className="dc-participant-tile-name">
          {name}{isLocal ? ' (you)' : ''}
        </span>
        {isMuted && (
          <span className="dc-participant-tile-muted" aria-label="Microphone muted">
            🔇
          </span>
        )}
      </div>
    </div>
  );
}
