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

import { classNames } from '@/commonUtils/classNames';

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
    <div className="mt-4 overflow-hidden rounded-[0.625rem] border border-gray-200 bg-white opacity-0 [animation:dc-fade-in-up_0.45s_ease_forwards] [animation-delay:0.1s]">
      {/* ── GitHub section ─────────────────────────────────────────────── */}
      {hasGitHub && (
        <div className="px-4 py-3.5 [&+&]:border-t [&+&]:border-gray-200">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-base">🐙</span>
            <a
              href={github.profileUrl ?? `https://github.com/${github.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[0.9375rem] font-semibold text-[#2563eb] no-underline hover:underline"
            >
              @{github.username}
            </a>
            {github.contributionsLastYear != null && (
              <span className="ml-auto text-xs text-gray-500">
                ~{github.contributionsLastYear} contributions
              </span>
            )}
          </div>

          {/* Top languages */}
          {github.topLanguages?.length > 0 && (
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {github.topLanguages.map((lang) => (
                <span key={lang} className="rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-2 py-0.5 text-xs font-medium text-[#2563eb]">
                  {lang}
                </span>
              ))}
            </div>
          )}

          {/* Top repos */}
          {github.topRepos?.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {github.topRepos.map((repo) => (
                <li key={repo.name} className="flex items-center gap-2 text-[0.8125rem]">
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[#2563eb] no-underline hover:underline"
                  >
                    {repo.name}
                  </a>
                  {repo.language && (
                    <span className="text-xs text-gray-500 before:content-['·_']">{repo.language}</span>
                  )}
                  <span className="ml-auto flex items-center gap-1 text-xs text-gray-400">
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
        <div
          className={classNames(
            'px-4 py-3.5 [&+&]:border-t [&+&]:border-gray-200',
            'bg-[#f8fbff]',
          )}
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-base">💼</span>
            {linkedin.profileUrl ? (
              <a
                href={linkedin.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[0.9375rem] font-semibold text-[#2563eb] no-underline hover:underline"
              >
                LinkedIn profile
              </a>
            ) : (
              <span className="text-[0.9375rem] font-semibold text-[#2563eb]">LinkedIn</span>
            )}
          </div>

          {linkedin.headline && (
            <p className="m-0 mb-1 text-sm font-medium text-gray-700">{linkedin.headline}</p>
          )}

          {(linkedin.jobTitle || linkedin.company) && (
            <p className="m-0 text-[0.8125rem] text-gray-500">
              {[linkedin.jobTitle, linkedin.company].filter(Boolean).join(' at ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
