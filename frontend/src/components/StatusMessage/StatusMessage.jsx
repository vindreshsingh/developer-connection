import { classNames } from '@/commonUtils/classNames';
import './StatusMessage.scss';

const VARIANT_MODIFIER = {
  success: 'dc-status-message--success',
  error: 'dc-status-message--error',
};

export default function StatusMessage({ variant, children }) {
  if (!children) return null;

  return <p className={classNames('dc-status-message', VARIANT_MODIFIER[variant])}>{children}</p>;
}
