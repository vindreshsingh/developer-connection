import { Link } from 'react-router-dom';
import Button from '@/components/Button/Button';

export default function RecommendationCard({ recommendation, onDismiss, dismissing }) {
  const { user, reason } = recommendation;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-[transform,box-shadow] duration-200 ease hover:-translate-y-[3px] hover:shadow-[0_12px_24px_-12px_rgba(147,51,234,0.35)] sm:flex-row">
      <img
        className="h-16 w-16 flex-shrink-0 rounded-full bg-gray-100 object-cover"
        src={user.photoUrl || '/default-avatar.png'}
        alt={`${user.firstName} ${user.lastName ?? ''}`}
      />

      <div className="min-w-0 flex-1">
        <Link to={`/users/${user._id}`} className="block text-base font-bold text-gray-900 no-underline hover:text-purple-600">
          {user.firstName} {user.lastName}
        </Link>

        {user.skills?.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {user.skills.slice(0, 5).map((skill) => (
              <span key={skill} className="rounded-full bg-purple-600/[0.08] px-2 py-0.5 text-[0.7rem] font-semibold text-purple-600">
                {skill}
              </span>
            ))}
          </div>
        )}

        <p className="mt-2.5 text-sm leading-[1.4] text-gray-500">{reason}</p>
      </div>

      <div className="flex flex-shrink-0 flex-row justify-center gap-2 sm:flex-col">
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
