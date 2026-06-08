import { createContext } from 'react';

// Single source of truth for "who is logged in" — see AuthContext.jsx for the
// provider that populates this and useAuth.js for the consumer hook.
export const AuthContext = createContext(null);
