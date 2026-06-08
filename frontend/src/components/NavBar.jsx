import { NavLink, useNavigate } from 'react-router-dom';
import { useGetMyProfileQuery, useLogoutMutation } from '../store/api';

const links = [
  { to: '/', label: 'Discover' },
  { to: '/requests', label: 'Requests' },
  { to: '/connections', label: 'Connections' },
  { to: '/profile', label: 'Profile' },
];

export default function NavBar() {
  const { data: user } = useGetMyProfileQuery();
  const [logout] = useLogoutMutation();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-200">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <span className="font-extrabold text-xl text-purple-600">DevConnect</span>
        <div className="flex items-center gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  isActive ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
          <button
            onClick={handleLogout}
            className="ml-2 px-3 py-1.5 rounded-full text-sm font-medium text-gray-500 hover:bg-gray-100"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
