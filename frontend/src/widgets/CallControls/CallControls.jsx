import { classNames } from '@/commonUtils/classNames';

/**
 * Reusable call controls bar — used by both the 1:1 CallOverlay and the
 * GroupCallOverlay. Renders mute, camera, screen-share, and end-call buttons.
 *
 * @param {{
 *   isMuted:         boolean,
 *   isCameraOff:     boolean,
 *   isScreenSharing: boolean,
 *   onToggleMute:    () => void,
 *   onToggleCamera:  () => void,
 *   onScreenShare:   () => void,
 *   onEndCall:       () => void,
 *   disabled?:       boolean,
 * }} props
 */
export default function CallControls({
  isMuted,
  isCameraOff,
  isScreenSharing,
  onToggleMute,
  onToggleCamera,
  onScreenShare,
  onEndCall,
  disabled = false,
}) {
  return (
    <div className="flex items-center justify-center gap-4 rounded-full bg-black/60 px-6 py-4" role="toolbar" aria-label="Call controls">
      {/* Mute */}
      <button
        type="button"
        className={classNames(
          'flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-full border-none bg-white/15 text-[1.4rem] transition-[background-color,transform] duration-150 hover:enabled:scale-[1.08] hover:enabled:bg-white/28 disabled:cursor-not-allowed disabled:opacity-40',
          isMuted && 'bg-white/35 outline outline-2 outline-offset-2 outline-white/60',
        )}
        onClick={onToggleMute}
        disabled={disabled}
        aria-pressed={isMuted}
        aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? '🔇' : '🎤'}
      </button>

      {/* Camera */}
      <button
        type="button"
        className={classNames(
          'flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-full border-none bg-white/15 text-[1.4rem] transition-[background-color,transform] duration-150 hover:enabled:scale-[1.08] hover:enabled:bg-white/28 disabled:cursor-not-allowed disabled:opacity-40',
          isCameraOff && 'bg-white/35 outline outline-2 outline-offset-2 outline-white/60',
        )}
        onClick={onToggleCamera}
        disabled={disabled}
        aria-pressed={isCameraOff}
        aria-label={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
        title={isCameraOff ? 'Camera on' : 'Camera off'}
      >
        {isCameraOff ? '📷' : '📹'}
      </button>

      {/* Screen share — hidden on mobile where getDisplayMedia is unavailable */}
      <button
        type="button"
        className={classNames(
          'hidden h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-full border-none bg-white/15 text-[1.4rem] transition-[background-color,transform] duration-150 hover:enabled:scale-[1.08] hover:enabled:bg-white/28 disabled:cursor-not-allowed disabled:opacity-40 [@media(min-width:481px)]:flex',
          isScreenSharing && 'bg-white/35 outline outline-2 outline-offset-2 outline-white/60',
        )}
        onClick={onScreenShare}
        disabled={disabled}
        aria-pressed={isScreenSharing}
        aria-label={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
        title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
      >
        🖥️
      </button>

      {/* End call */}
      <button
        type="button"
        className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-full border-none bg-red-600 text-[1.4rem] transition-[background-color,transform] duration-150 hover:enabled:scale-[1.08] hover:enabled:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
        onClick={onEndCall}
        disabled={disabled}
        aria-label="End call"
        title="End call"
      >
        📵
      </button>
    </div>
  );
}
