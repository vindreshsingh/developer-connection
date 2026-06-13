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
import './LinkedAccounts.scss';

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

  return (
    <section className="dc-linked-accounts">
      <h2 className="dc-linked-accounts-heading">Connected Accounts</h2>
      <p className="dc-linked-accounts-sub">
        Link your developer accounts to enrich your profile.
      </p>

      <ul className="dc-linked-accounts-list">
        {PROVIDERS.map(({ id, label, icon, canSync }) => {
          const connected = isConnected(id);
          const linkedAt  = linked.find((p) => p.provider === id)?.linkedAt;
          const isSyncing = id === 'github' ? syncingGh   : syncingLi;
          const isDiscing = id === 'github' ? discGh      : discLi;

          return (
            <li key={id} className="dc-linked-accounts-item">
              <span className="dc-linked-accounts-icon">{icon}</span>

              <div className="dc-linked-accounts-info">
                <span className="dc-linked-accounts-name">{label}</span>
                {connected && linkedAt && (
                  <span className="dc-linked-accounts-date">
                    Linked {new Date(linkedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div className="dc-linked-accounts-actions">
                {connected ? (
                  <>
                    {canSync && (
                      <button
                        className="dc-linked-accounts-btn dc-linked-accounts-btn--sync"
                        onClick={() => handleSync(id)}
                        disabled={isSyncing}
                      >
                        {isSyncing ? 'Syncing…' : 'Sync'}
                      </button>
                    )}
                    <button
                      className="dc-linked-accounts-btn dc-linked-accounts-btn--disconnect"
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
                    className="dc-linked-accounts-btn dc-linked-accounts-btn--connect"
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
