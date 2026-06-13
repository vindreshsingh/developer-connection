/**
 * GitHubCard — displays GitHub enrichment data on a public profile.
 *
 * Shows: username link, top languages (pill badges), top repos (name + stars),
 * and contribution count.
 *
 * Only renders when `github` prop has a `username` (i.e. user has synced).
 *
 * @param {{ github: object, linkedin: object }} props
 */

import './GitHubCard.scss';

// ── Helpers ───────────────────────────────────────────────────────────────────

function StarIcon() {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GitHubCard({ github, linkedin }) {
  const hasGitHub  = github?.username;
  const hasLinkedIn = linkedin?.headline || linkedin?.company;

  if (!hasGitHub && !hasLinkedIn) return null;

  return (
    <div className="dc-github-card">
      {/* ── GitHub section ─────────────────────────────────────────────── */}
      {hasGitHub && (
        <div className="dc-github-card-section">
          <div className="dc-github-card-header">
            <span className="dc-github-card-icon">🐙</span>
            <a
              href={github.profileUrl ?? `https://github.com/${github.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="dc-github-card-username"
            >
              @{github.username}
            </a>
            {github.contributionsLastYear != null && (
              <span className="dc-github-card-contributions">
                ~{github.contributionsLastYear} contributions
              </span>
            )}
          </div>

          {/* Top languages */}
          {github.topLanguages?.length > 0 && (
            <div className="dc-github-card-langs">
              {github.topLanguages.map((lang) => (
                <span key={lang} className="dc-github-card-lang-pill">
                  {lang}
                </span>
              ))}
            </div>
          )}

          {/* Top repos */}
          {github.topRepos?.length > 0 && (
            <ul className="dc-github-card-repos">
              {github.topRepos.map((repo) => (
                <li key={repo.name} className="dc-github-card-repo">
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="dc-github-card-repo-name"
                  >
                    {repo.name}
                  </a>
                  {repo.language && (
                    <span className="dc-github-card-repo-lang">{repo.language}</span>
                  )}
                  <span className="dc-github-card-repo-stars">
                    <StarIcon />
                    {repo.stars?.toLocaleString() ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── LinkedIn section ───────────────────────────────────────────── */}
      {hasLinkedIn && (
        <div className="dc-github-card-section dc-github-card-section--linkedin">
          <div className="dc-github-card-header">
            <span className="dc-github-card-icon">💼</span>
            {linkedin.profileUrl ? (
              <a
                href={linkedin.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="dc-github-card-username"
              >
                LinkedIn profile
              </a>
            ) : (
              <span className="dc-github-card-username">LinkedIn</span>
            )}
          </div>

          {linkedin.headline && (
            <p className="dc-github-card-headline">{linkedin.headline}</p>
          )}

          {(linkedin.jobTitle || linkedin.company) && (
            <p className="dc-github-card-position">
              {[linkedin.jobTitle, linkedin.company].filter(Boolean).join(' at ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
