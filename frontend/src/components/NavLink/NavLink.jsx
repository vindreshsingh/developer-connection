import { NavLink as RouterNavLink } from 'react-router-dom';
import { classNames } from '@/commonUtils/classNames';
import './NavLink.scss';

export default function NavLink({ to, end, children }) {
  return (
    <RouterNavLink
      to={to}
      end={end}
      className={({ isActive }) => classNames('dc-nav-link', isActive && 'dc-nav-link--active')}
    >
      {children}
    </RouterNavLink>
  );
}
