import { NavLink as RouterNavLink } from 'react-router-dom';
import { classNames } from '@/commonUtils/classNames';

export default function NavLink({ to, end, children, onClick, className }) {
  return (
    <RouterNavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        classNames(
          'rounded-full px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors',
          isActive ? 'bg-purple-600 text-white hover:bg-purple-600' : 'hover:bg-gray-100',
          className,
        )
      }
    >
      {children}
    </RouterNavLink>
  );
}
