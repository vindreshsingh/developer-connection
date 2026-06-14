import { classNames } from '@/commonUtils/classNames';

const VARIANT_MODIFIER = {
  success: 'text-green-600',
  error: 'text-red-500',
};

export default function StatusMessage({ variant, children }) {
  if (!children) return null;

  return <p className={classNames('mb-4 font-medium', VARIANT_MODIFIER[variant])}>{children}</p>;
}
