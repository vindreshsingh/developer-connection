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
import { classNames } from '@/commonUtils/classNames';

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
    <div
      className={classNames(
        'relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-[#1a1a2e]',
        isLocal && 'outline outline-2 outline-[rgba(139,92,246,0.5)]',
      )}
    >
      {/* Video element — hidden via CSS when camera is off */}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        playsInline
        // Mirror local camera so it feels natural
        style={isLocal ? { transform: 'scaleX(-1)' } : undefined}
        muted={isLocal} // never echo local audio
      />

      {/* Avatar shown when camera is off or track not yet available */}
      {(isCameraOff || !videoTrack) && (
        <div
          className="relative z-[1] flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-violet-800 text-[1.75rem] font-bold text-white"
          aria-hidden="true"
        >
          {initial}
        </div>
      )}

      {/* Name + mute badge */}
      <div className="absolute inset-x-0 bottom-0 z-[2] flex items-center gap-[0.4rem] bg-[linear-gradient(transparent,rgba(0,0,0,0.55))] px-[0.6rem] py-[0.4rem]">
        <span className="overflow-hidden text-[0.78rem] font-medium text-white text-ellipsis whitespace-nowrap [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
          {name}{isLocal ? ' (you)' : ''}
        </span>
        {isMuted && (
          <span className="flex-shrink-0 text-xs" aria-label="Microphone muted">
            🔇
          </span>
        )}
      </div>
    </div>
  );
}
