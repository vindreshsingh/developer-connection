import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Avatar from '@/components/Avatar/Avatar';
import Button from '@/components/Button/Button';
import Tag from '@/components/Tag/Tag';
import GitHubCard from '@/widgets/GitHubCard/GitHubCard';
import { useGetOrCreateConversationMutation } from '@/hooks/chat/chatApi';
import { getApiErrorMessage } from '@/commonUtils/apiError';

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
    <div className="text-left rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-[transform,box-shadow] duration-200 ease hover:-translate-y-[3px] hover:shadow-[0_12px_24px_-12px_rgba(147,51,234,0.35)]">
      <Link to={`/users/${connection._id}`} className="group mb-2 flex items-center gap-3 text-inherit no-underline">
        <Avatar
          photoUrl={connection.photoUrl}
          initials={connection.initials}
          size="lg"
        />
        <p className="font-semibold text-gray-900 group-hover:underline">{connection.fullName}</p>
      </Link>
      {connection.bio && (
        <p className="line-clamp-2 overflow-hidden text-sm text-gray-500">{connection.bio}</p>
      )}
      {connection.topSkills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {connection.topSkills.map((skill) => (
            <Tag key={skill}>{skill}</Tag>
          ))}
        </div>
      )}

      {/* Phase 4: GitHub / LinkedIn enrichment if synced */}
      <GitHubCard github={connection.github} linkedin={connection.linkedin} />

      <Button
        variant="outline"
        className="mt-3 w-full"
        disabled={isLoading}
        onClick={handleMessage}
      >
        {isLoading ? 'Starting chat…' : 'Message'}
      </Button>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
