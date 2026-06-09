import { classNames } from '@/commonUtils/classNames';
import './Button.scss';

const VARIANT_CLASSES = {
  primary: 'bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5',
  outline: 'border border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-1.5 text-sm',
  ghost: 'text-gray-500 hover:bg-gray-100 px-3 py-1.5 text-sm',
};

export default function Button({ variant = 'primary', className = '', children, ...rest }) {
  return (
    <button className={classNames('dc-button', VARIANT_CLASSES[variant], className)} {...rest}>
      {children}
    </button>
  );
}
