import { classNames } from '@/commonUtils/classNames';
import './Banner.scss';

const VARIANT_MODIFIER = {
  error: 'dc-banner--error',
  success: 'dc-banner--success',
  warning: 'dc-banner--warning',
  plain: 'dc-banner--plain',
};

export default function Banner({ variant = 'plain', className = '', children }) {
  if (!children) return null;

  return <p className={classNames('dc-banner', VARIANT_MODIFIER[variant], className)}>{children}</p>;
}
