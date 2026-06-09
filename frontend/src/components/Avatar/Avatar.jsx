import { classNames } from '@/commonUtils/classNames';
import './Avatar.scss';

const SIZE_CLASSES = {
  sm: 'w-12 h-12 text-base',
  lg: 'w-20 h-20 text-2xl',
};

export default function Avatar({ user, size = 'sm', className = '' }) {
  const sizeClass = SIZE_CLASSES[size];
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`;

  if (user?.photoUrl) {
    return (
      <img
        src={user.photoUrl}
        alt={user.firstName}
        className={classNames('dc-avatar', sizeClass, className)}
      />
    );
  }

  return (
    <div className={classNames('dc-avatar dc-avatar--placeholder', sizeClass, className)}>
      {initials}
    </div>
  );
}
