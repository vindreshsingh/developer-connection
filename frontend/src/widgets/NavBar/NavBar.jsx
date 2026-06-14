import { useState } from 'react';
import NavLink from '@/components/NavLink/NavLink';
import Button from '@/components/Button/Button';
import NotificationBell from '@/widgets/NotificationBell/NotificationBell';
import { useCurrentUser } from '@/hooks/auth/useCurrentUser';
import { useLogout } from '@/hooks/auth/useLogout';
import { classNames } from '@/commonUtils/classNames';

const LINKS = [
  { to: '/', label: 'Discover', end: true },
  { to: '/posts', label: 'Feed' },
  { to: '/jobs', label: 'Jobs' },
  { to: '/requests', label: 'Requests' },
  { to: '/connections', label: 'Connections' },
  { to: '/messages', label: 'Messages' },
  { to: '/groups', label: 'Groups' },
  { to: '/calls', label: 'Calls' },
  { to: '/ai-assistant', label: 'AI Assistant' },
  { to: '/profile', label: 'Profile' },
];

export default function NavBar() {
  const { user } = useCurrentUser();
  const { logout } = useLogout();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (!user) return null;

  const closeMenu = () => setIsMenuOpen(false);
  const pricingLink = { to: '/pricing', label: user.isPremium ? 'Premium' : 'Go Premium' };

  return (
    <nav className="sticky top-0 z-20 border-b border-gray-200 bg-white/85 backdrop-blur-[10px]">
      <div className="relative mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <span className="bg-gradient-to-br from-purple-600 to-pink-500 bg-clip-text text-xl font-extrabold text-transparent">DevConnect</span>

        <button
          type="button"
          className="flex h-9 w-9 flex-col items-center justify-center gap-[0.3125rem] rounded-lg border-none bg-transparent transition-colors duration-150 ease hover:bg-gray-100 md:hidden"
          aria-label="Toggle navigation menu"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <span
            className={classNames(
              'block h-0.5 w-5 rounded-full bg-gray-600 transition-[transform_0.25s_ease,opacity_0.2s_ease]',
              isMenuOpen && 'translate-y-[7px] rotate-45',
            )}
          />
          <span
            className={classNames(
              'block h-0.5 w-5 rounded-full bg-gray-600 transition-[transform_0.25s_ease,opacity_0.2s_ease]',
              isMenuOpen && 'opacity-0',
            )}
          />
          <span
            className={classNames(
              'block h-0.5 w-5 rounded-full bg-gray-600 transition-[transform_0.25s_ease,opacity_0.2s_ease]',
              isMenuOpen && '-translate-y-[7px] -rotate-45',
            )}
          />
        </button>

        <div
          className={classNames(
            'absolute left-0 right-0 top-full flex origin-top flex-col items-stretch gap-0.5 border-b border-gray-200 bg-white/98 px-4 pt-2 pb-4 shadow-[0_12px_24px_-16px_rgba(17,24,39,0.25)] transition-[opacity_0.18s_ease,transform_0.18s_ease,visibility_0.18s] md:static md:flex md:flex-row md:items-center md:gap-1 md:border-b-0 md:bg-transparent md:px-0 md:py-0 md:shadow-none md:visible md:pointer-events-auto md:scale-y-100 md:opacity-100',
            isMenuOpen
              ? 'visible pointer-events-auto scale-y-100 opacity-100'
              : 'invisible pointer-events-none scale-y-95 opacity-0',
          )}
        >
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} onClick={closeMenu} className="py-2.5 text-center md:py-1.5 md:text-left">
              {link.label}
            </NavLink>
          ))}
          <NavLink
            to={pricingLink.to}
            onClick={closeMenu}
            className="py-2.5 text-center md:py-1.5 md:text-left !bg-gradient-to-br !from-purple-600 !to-pink-500 !text-white font-semibold hover:!opacity-90"
          >
            {pricingLink.label}
          </NavLink>
          <NotificationBell />
          <Button
            variant="ghost"
            className="ml-0 w-full md:ml-2 md:w-auto"
            onClick={() => {
              closeMenu();
              logout();
            }}
          >
            Logout
          </Button>
        </div>
      </div>
    </nav>
  );
}
