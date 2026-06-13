/**
 * LinkedAccounts widget — "Connected Accounts" section on the Profile edit page.
 *
 * Shows GitHub, Google, LinkedIn connection status.
 * Connect → server-side OAuth redirect.
 * Disconnect → calls the relevant delete mutation.
 * GitHub Sync → POST /profile/github/sync.
 */

import {
  useGetLinkedAccountsQuery,
  useSyncGithubMutation,
  useDisconnectGithubMutation,
  useSyncLinkedinMutation,
  useDisconnectLinkedinMutation,
  oauthLoginUrl,
} from '@/hooks/auth/oauthApi';
import { classNames } from '@/commonUtils/classNames';

const PROVIDERS = [
  { id: 'github',   label: 'GitHub',   icon: '🐙', canSync: true  },
  { id: 'google',   label: 'Google',   icon: '🔵', canSync: false },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼', canSync: true  },
];

export default function LinkedAccounts() {
  const { data: linked = [], isLoading } = useGetLinkedAccountsQuery();

  const [syncGithub,        { isLoading: syncingGh }]  = useSyncGithubMutation();
  const [disconnectGithub,  { isLoading: discGh }]     = useDisconnectGithubMutation();
  const [syncLinkedin,      { isLoading: syncingLi }]  = useSyncLinkedinMutation();
  const [disconnectLinkedin, { isLoading: discLi }]    = useDisconnectLinkedinMutation();

  const isConnected = (id) => linked.some((p) => p.provider === id);

  const handleDisconnect = async (providerId) => {
    if (providerId === 'github')   await disconnectGithub();
    if (providerId === 'linkedin') await disconnectLinkedin();
  };

  const handleSync = async (providerId) => {
    if (providerId === 'github')   await syncGithub();
    if (providerId === 'linkedin') await syncLinkedin();
  };

  if (isLoading) return null;

  const btnBase = 'rounded-md border border-transparent px-3 py-1.5 text-[0.8125rem] font-medium transition-opacity duration-150 disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <section className="mt-8 border-t border-gray-200 pt-6">
      <h2 className="mb-1 text-lg font-semibold text-gray-900">Connected Accounts</h2>
      <p className="mb-4 text-[0.8125rem] text-gray-500">
        Link your developer accounts to enrich your profile.
      </p>

      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {PROVIDERS.map(({ id, label, icon, canSync }) => {
          const connected = isConnected(id);
          const linkedAt  = linked.find((p) => p.provider === id)?.linkedAt;
          const isSyncing = id === 'github' ? syncingGh   : syncingLi;
          const isDiscing = id === 'github' ? discGh      : discLi;

          return (
            <li key={id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-[#fafafa] px-4 py-3">
              <span className="w-7 flex-shrink-0 text-center text-xl">{icon}</span>

              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[0.9375rem] font-medium text-gray-900">{label}</span>
                {connected && linkedAt && (
                  <span className="mt-0.5 text-xs text-gray-400">
                    Linked {new Date(linkedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div className="flex flex-shrink-0 gap-2">
                {connected ? (
                  <>
                    {canSync && (
                      <button
                        className={classNames(btnBase, 'border-gray-300 bg-white text-gray-700 enabled:hover:bg-gray-50')}
                        onClick={() => handleSync(id)}
                        disabled={isSyncing}
                      >
                        {isSyncing ? 'Syncing…' : 'Sync'}
                      </button>
                    )}
                    <button
                      className={classNames(btnBase, 'border-red-300 bg-white text-red-500 enabled:hover:bg-red-50')}
                      onClick={() => handleDisconnect(id)}
                      disabled={isDiscing}
                    >
                      {isDiscing ? 'Disconnecting…' : 'Disconnect'}
                    </button>
                  </>
                ) : (
                  // Full-page redirect to server-side OAuth — use <a> not a button
                  <a
                    href={oauthLoginUrl(id)}
                    className={classNames(btnBase, 'bg-blue-600 text-white hover:bg-blue-700')}
                  >
                    Connect
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
