import Avatar from '@/components/Avatar/Avatar';
import {
  useGetBlockedUsersQuery,
  useUnblockUserMutation,
} from '@/hooks/moderation/moderationApi';
import './BlockedUsers.scss';

export default function BlockedUsers() {
  const { data, isLoading } = useGetBlockedUsersQuery();
  const [unblockUser, { isLoading: isUnblocking }] = useUnblockUserMutation();

  const blockedUsers = data?.data || [];

  if (isLoading || blockedUsers.length === 0) return null;

  return (
    <section className="dc-blocked-users">
      <h2 className="dc-blocked-users-heading">Blocked Users</h2>
      <p className="dc-blocked-users-sub">
        These users can&apos;t see your profile or message you.
      </p>

      <ul className="dc-blocked-users-list">
        {blockedUsers.map((user) => {
          const fullName = `${user.firstName} ${user.lastName ?? ''}`.trim();
          const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();

          return (
            <li key={user._id} className="dc-blocked-users-item">
              <Avatar photoUrl={user.photoUrl} initials={initials} size="sm" />
              <span className="dc-blocked-users-name">{fullName}</span>
              <button
                type="button"
                className="dc-blocked-users-unblock-btn"
                onClick={() => unblockUser(user._id)}
                disabled={isUnblocking}
              >
                Unblock
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
