import { useState } from 'react';
import NavLink from '@/components/NavLink/NavLink';
import Button from '@/components/Button/Button';
import { useCurrentUser } from '@/hooks/auth/useCurrentUser';
import { useLogout } from '@/hooks/auth/useLogout';
import './NavBar.scss';

const LINKS = [
  { to: '/', label: 'Discover', end: true },
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
    <nav className="dc-nav-bar">
      <div className="dc-nav-bar-inner">
        <span className="dc-nav-bar-brand">DevConnect</span>

        <button
          type="button"
          className={`dc-nav-bar-toggle ${isMenuOpen ? 'dc-nav-bar-toggle--open' : ''}`}
          aria-label="Toggle navigation menu"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        <div className={`dc-nav-bar-links ${isMenuOpen ? 'dc-nav-bar-links--open' : ''}`}>
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} onClick={closeMenu}>
              {link.label}
            </NavLink>
          ))}
          <NavLink to={pricingLink.to} onClick={closeMenu} className="dc-nav-bar-premium-link">
            {pricingLink.label}
          </NavLink>
          <Button
            variant="ghost"
            className="dc-nav-bar-logout"
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
