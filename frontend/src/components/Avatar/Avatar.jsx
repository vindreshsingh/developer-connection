import { classNames } from '@/commonUtils/classNames';

const SIZE_CLASSES = {
  sm: 'w-12 h-12 text-base',
  lg: 'w-20 h-20 text-2xl',
};

export default function Avatar({ user, photoUrl, initials, size = 'sm', className = '' }) {
  const sizeClass = SIZE_CLASSES[size];
  const resolvedPhotoUrl = user?.photoUrl ?? photoUrl;
  const resolvedInitials = initials ?? `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`;

  if (resolvedPhotoUrl) {
    return (
      <img
        src={resolvedPhotoUrl}
        alt={user?.firstName || resolvedInitials || 'avatar'}
        className={classNames('flex-shrink-0 rounded-full object-cover', sizeClass, className)}
      />
    );
  }

  return (
    <div
      className={classNames(
        'flex flex-shrink-0 items-center justify-center rounded-full bg-violet-100 font-bold text-purple-600',
        sizeClass,
        className,
      )}
    >
      {resolvedInitials}
    </div>
  );
}
