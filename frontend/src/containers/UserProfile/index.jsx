import { useParams, Link } from 'react-router-dom';
import { useGetUserProfileQuery } from '@/hooks/profile/profileApi';
import Avatar from '@/components/Avatar/Avatar';
import Tag from '@/components/Tag/Tag';
import GitHubCard from '@/widgets/GitHubCard/GitHubCard';
import { parseUser, parseUserError } from './parser';
import './UserProfile.scss';

export default function UserProfileContainer() {
  const { userId } = useParams();
  const { data, isFetching, error } = useGetUserProfileQuery(userId);

  const user = parseUser(data);

  if (isFetching) return <p className="dc-user-profile-loading">Loading profile…</p>;
  if (error) return <p className="dc-user-profile-error">{parseUserError(error)}</p>;
  if (!user) return null;

  return (
    <div className="dc-user-profile">
      <Link to="/connections" className="dc-user-profile-back">
        ← Back to connections
      </Link>

      <div className="dc-user-profile-header">
        <Avatar photoUrl={user.photoUrl} initials={user.initials} size="lg" />
        <div>
          <h1 className="dc-user-profile-name">{user.fullName}</h1>
          {(user.age || user.gender) && (
            <p className="dc-user-profile-meta">
              {[user.age, user.gender].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      {user.bio && <p className="dc-user-profile-bio">{user.bio}</p>}

      {user.skills.length > 0 && (
        <div className="dc-user-profile-skills">
          {user.skills.map((skill) => (
            <Tag key={skill}>{skill}</Tag>
          ))}
        </div>
      )}

      <GitHubCard github={user.github} linkedin={user.linkedin} />
    </div>
  );
}
