// Maps the verification status machine to the visual variant + CTA the view needs.
export const parseVerificationView = (status, message) => ({
  status,
  message,
  showLoginCta: status !== 'loading',
  ctaLabel: status === 'success' ? 'Go to Login' : 'Back to Login',
});
