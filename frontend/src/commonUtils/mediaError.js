/**
 * Maps a getUserMedia / LiveKit media-acquisition error to a clear,
 * user-facing message. Browsers surface permission denial as a cryptic
 * "The request is not allowed by the user agent..." (NotAllowedError);
 * this translates the common DOMException names into actionable guidance.
 */
export const getMediaErrorMessage = (err) => {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera/microphone access is blocked. Allow it for this site in your browser (and your OS Privacy settings), then try again.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera or microphone was found. Connect a device and try again.';
    case 'NotReadableError':
      return 'Your camera/microphone is in use by another app. Close it and try again.';
    default:
      return err?.message || 'Could not access your camera or microphone.';
  }
};
