import { classNames } from '@/commonUtils/classNames';

const VARIANT_MODIFIER = {
  error: 'text-red-500',
  success: 'text-green-600',
  warning: 'text-center text-[#b45309] bg-[#fffbeb] border border-[#fde68a]',
  plain: 'text-gray-500',
};

export default function Banner({ variant = 'plain', className = '', children }) {
  if (!children) return null;

  return <p className={classNames('text-sm rounded-lg px-3 py-2', VARIANT_MODIFIER[variant], className)}>{children}</p>;
}
