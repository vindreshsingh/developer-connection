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
  { to: '/interview-prep', label: 'Interview Prep' },
  { to: '/profile', label: 'Profile' },
  { to: '/billing', label: 'Billing' },
];

export default function NavBar() {
  const { user } = useCurrentUser();
  const { logout } = useLogout();

  if (!user) return null;

  return (
    <nav className="dc-nav-bar">
      <div className="dc-nav-bar-inner">
        <span className="dc-nav-bar-brand">DevConnect</span>
        <div className="dc-nav-bar-links">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end}>
              {link.label}
            </NavLink>
          ))}
          <Button variant="ghost" className="ml-2" onClick={logout}>
            Logout
          </Button>
        </div>
      </div>
    </nav>
  );
}
