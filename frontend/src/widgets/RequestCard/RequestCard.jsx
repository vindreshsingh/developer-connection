import Avatar from '@/components/Avatar/Avatar';
import Button from '@/components/Button/Button';
import { classNames } from '@/commonUtils/classNames';

const STATUS_STYLES = {
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  interested: 'bg-yellow-100 text-yellow-700',
};

export default function RequestCard({ person, actions, statusBadge }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-[transform,box-shadow] duration-200 ease hover:-translate-y-[3px] hover:shadow-[0_12px_24px_-12px_rgba(147,51,234,0.35)] sm:flex-nowrap">
      <Avatar
        photoUrl={person.photoUrl}
        initials={person.initials}
        size="lg"
      />
      <div className="flex-1 text-left">
        <p className="font-semibold text-gray-900">{person.fullName}</p>
        {person.bio && (
          <p className="overflow-hidden text-sm text-gray-500 [-webkit-box-orient:vertical] [display:-webkit-box] [-webkit-line-clamp:1]">
            {person.bio}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex gap-2">
          {actions.map(({ label, onClick, variant = 'outline' }) => (
            <Button key={label} variant={variant} onClick={onClick}>
              {label}
            </Button>
          ))}
        </div>
      )}

      {statusBadge && (
        <span
          className={classNames(
            'rounded-full px-2.5 py-[0.2rem] text-xs font-medium capitalize',
            STATUS_STYLES[statusBadge],
          )}
        >
          {statusBadge}
        </span>
      )}
    </div>
  );
}
