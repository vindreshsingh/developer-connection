import Avatar from '@/components/Avatar/Avatar';
import Button from '@/components/Button/Button';
import './RequestCard.scss';

export default function RequestCard({ person, actions, statusBadge }) {
  return (
    <div className="dc-request-card">
      <Avatar
        photoUrl={person.photoUrl}
        initials={person.initials}
        size="lg"
      />
      <div className="dc-request-card-info">
        <p className="dc-request-card-name">{person.fullName}</p>
        {person.bio && <p className="dc-request-card-bio">{person.bio}</p>}
      </div>

      {actions && (
        <div className="dc-request-card-actions">
          {actions.map(({ label, onClick, variant = 'outline' }) => (
            <Button key={label} variant={variant} onClick={onClick}>
              {label}
            </Button>
          ))}
        </div>
      )}

      {statusBadge && (
        <span className={`dc-request-card-status dc-request-card-status--${statusBadge}`}>
          {statusBadge}
        </span>
      )}
    </div>
  );
}
