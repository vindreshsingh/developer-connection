import Avatar from '@/components/Avatar/Avatar';
import {
  useGetBlockedUsersQuery,
  useUnblockUserMutation,
} from '@/hooks/moderation/moderationApi';

export default function BlockedUsers() {
  const { data, isLoading } = useGetBlockedUsersQuery();
  const [unblockUser, { isLoading: isUnblocking }] = useUnblockUserMutation();

  const blockedUsers = data?.data || [];

  if (isLoading || blockedUsers.length === 0) return null;

  return (
    <section className="mt-8 border-t border-gray-200 pt-6">
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Blocked Users</h2>
      <p className="mb-4 text-[0.8125rem] text-gray-500">
        These users can&apos;t see your profile or message you.
      </p>

      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {blockedUsers.map((user) => {
          const fullName = `${user.firstName} ${user.lastName ?? ''}`.trim();
          const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();

          return (
            <li key={user._id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-[#fafafa] px-4 py-2.5 transition-colors duration-150 ease hover:bg-gray-100">
              <Avatar photoUrl={user.photoUrl} initials={initials} size="sm" />
              <span className="flex-1 text-[0.9375rem] font-medium text-gray-900">{fullName}</span>
              <button
                type="button"
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-[0.8125rem] font-medium text-gray-700 transition-[opacity,background-color] duration-150 ease hover:enabled:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
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
