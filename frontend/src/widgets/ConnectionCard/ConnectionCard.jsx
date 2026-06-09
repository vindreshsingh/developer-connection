import Avatar from '@/components/Avatar/Avatar';
import Tag from '@/components/Tag/Tag';
import './ConnectionCard.scss';

export default function ConnectionCard({ connection }) {
  return (
    <div className="dc-connection-card">
      <div className="dc-connection-card-header">
        <Avatar
          photoUrl={connection.photoUrl}
          initials={connection.initials}
          size="lg"
        />
        <p className="dc-connection-card-name">{connection.fullName}</p>
      </div>
      {connection.bio && (
        <p className="dc-connection-card-bio">{connection.bio}</p>
      )}
      {connection.topSkills.length > 0 && (
        <div className="dc-connection-card-skills">
          {connection.topSkills.map((skill) => (
            <Tag key={skill}>{skill}</Tag>
          ))}
        </div>
      )}
    </div>
  );
}
