import { classNames } from '@/commonUtils/classNames';
import './CallControls.scss';

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
    <div className="dc-call-controls" role="toolbar" aria-label="Call controls">
      {/* Mute */}
      <button
        type="button"
        className={classNames('dc-call-ctrl-btn', isMuted && 'dc-call-ctrl-btn--active')}
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
        className={classNames('dc-call-ctrl-btn', isCameraOff && 'dc-call-ctrl-btn--active')}
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
        className={classNames('dc-call-ctrl-btn dc-call-ctrl-btn--screen', isScreenSharing && 'dc-call-ctrl-btn--active')}
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
        className="dc-call-ctrl-btn dc-call-ctrl-btn--end"
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
