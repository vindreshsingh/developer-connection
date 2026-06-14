import { useParams, Link } from 'react-router-dom';
import { useGetUserProfileQuery } from '@/hooks/profile/profileApi';
import Avatar from '@/components/Avatar/Avatar';
import Tag from '@/components/Tag/Tag';
import GitHubCard from '@/widgets/GitHubCard/GitHubCard';
import { parseUser, parseUserError } from './parser';

export default function UserProfileContainer() {
  const { userId } = useParams();
  const { data, isFetching, error } = useGetUserProfileQuery(userId);

  const user = parseUser(data);

  if (isFetching) return <p className="mx-auto my-8 max-w-[36rem] px-4 text-sm">Loading profile…</p>;
  if (error) return <p className="mx-auto my-8 max-w-[36rem] px-4 text-sm text-red-500">{parseUserError(error)}</p>;
  if (!user) return null;

  return (
    <div className="mx-auto max-w-[36rem] px-3 py-5 opacity-0 [animation:dc-fade-in-up_0.45s_ease_forwards] sm:px-4 sm:py-8">
      <Link to="/connections" className="mb-4 inline-block text-sm text-gray-500 no-underline hover:text-gray-700">
        ← Back to connections
      </Link>

      <div className="mb-4 flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <Avatar photoUrl={user.photoUrl} initials={user.initials} size="lg" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{user.fullName}</h1>
          {(user.age || user.gender) && (
            <p className="mt-1 text-sm text-gray-500 capitalize">
              {[user.age, user.gender].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      {user.bio && <p className="mb-4 text-[0.9375rem] text-gray-700">{user.bio}</p>}

      {user.skills.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {user.skills.map((skill) => (
            <Tag key={skill}>{skill}</Tag>
          ))}
        </div>
      )}

      <GitHubCard github={user.github} linkedin={user.linkedin} />
    </div>
  );
}
