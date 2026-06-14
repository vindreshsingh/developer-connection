import { classNames } from '@/commonUtils/classNames';

const VARIANT_CLASSES = {
  primary:
    'bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 disabled:hover:shadow-none hover:not-disabled:shadow-[0_8px_16px_-8px_rgba(147,51,234,0.5)]',
  outline: 'border border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-1.5 text-sm',
  ghost: 'text-gray-500 hover:bg-gray-100 px-3 py-1.5 text-sm',
};

export default function Button({ variant = 'primary', className = '', children, ...rest }) {
  return (
    <button
      className={classNames(
        'rounded-lg font-semibold transition-[opacity,background-color,transform,box-shadow] duration-150 ease active:not-disabled:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60',
        VARIANT_CLASSES[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
