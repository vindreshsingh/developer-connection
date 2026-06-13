import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Avatar from '@/components/Avatar/Avatar';
import Button from '@/components/Button/Button';
import Tag from '@/components/Tag/Tag';
import GitHubCard from '@/widgets/GitHubCard/GitHubCard';
import { useGetOrCreateConversationMutation } from '@/hooks/chat/chatApi';
import { getApiErrorMessage } from '@/commonUtils/apiError';
import './ConnectionCard.scss';

export default function ConnectionCard({ connection }) {
  const navigate = useNavigate();
  const [getOrCreateConversation, { isLoading }] = useGetOrCreateConversationMutation();
  const [error, setError] = useState('');

  const handleMessage = async () => {
    setError('');
    try {
      const { data: conversation } = await getOrCreateConversation(connection._id).unwrap();
      navigate('/messages', { state: { conversationId: conversation._id } });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not start chat'));
    }
  };

  return (
    <div className="dc-connection-card">
      <Link to={`/users/${connection._id}`} className="dc-connection-card-header">
        <Avatar
          photoUrl={connection.photoUrl}
          initials={connection.initials}
          size="lg"
        />
        <p className="dc-connection-card-name">{connection.fullName}</p>
      </Link>
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

      {/* Phase 4: GitHub / LinkedIn enrichment if synced */}
      <GitHubCard github={connection.github} linkedin={connection.linkedin} />

      <Button
        variant="outline"
        className="dc-connection-card-message-btn"
        disabled={isLoading}
        onClick={handleMessage}
      >
        {isLoading ? 'Starting chat…' : 'Message'}
      </Button>
      {error && <p className="dc-connection-card-error">{error}</p>}
    </div>
  );
}
