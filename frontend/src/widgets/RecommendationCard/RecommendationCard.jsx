import { Link } from 'react-router-dom';
import Button from '@/components/Button/Button';
import './RecommendationCard.scss';

export default function RecommendationCard({ recommendation, onDismiss, dismissing }) {
  const { user, reason } = recommendation;

  return (
    <div className="dc-recommendation-card">
      <img
        className="dc-recommendation-card-photo"
        src={user.photoUrl || '/default-avatar.png'}
        alt={`${user.firstName} ${user.lastName ?? ''}`}
      />

      <div className="dc-recommendation-card-body">
        <Link to={`/users/${user._id}`} className="dc-recommendation-card-name">
          {user.firstName} {user.lastName}
        </Link>

        {user.skills?.length > 0 && (
          <div className="dc-recommendation-card-skills">
            {user.skills.slice(0, 5).map((skill) => (
              <span key={skill} className="dc-recommendation-card-skill">
                {skill}
              </span>
            ))}
          </div>
        )}

        <p className="dc-recommendation-card-reason">{reason}</p>
      </div>

      <div className="dc-recommendation-card-actions">
        <Link to={`/users/${user._id}`}>
          <Button variant="outline">View profile</Button>
        </Link>
        <Button variant="ghost" onClick={() => onDismiss(user._id)} disabled={dismissing}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
