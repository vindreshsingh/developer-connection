import { classNames } from '@/commonUtils/classNames';

export default function Tag({ className = '', children }) {
  return (
    <span
      className={classNames(
        'inline-block rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-purple-700',
        className,
      )}
    >
      {children}
    </span>
  );
}
