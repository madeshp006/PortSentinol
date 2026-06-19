import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  company: string;
  createdAt: string;
}

interface AuthState {
  token: string | null;
  user: { id: string; email: string } | null;
  profile: UserProfile | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  setSession: (
    session: { access_token: string; refresh_token?: string },
    user: { id: string; email: string },
    profile?: UserProfile
  ) => void;
  setProfile: (p: UserProfile) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "ps_token";
const USER_KEY = "ps_user";
const PROFILE_KEY = "ps_profile";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    user: null,
    profile: null,
    loading: true,
  });

  useEffect(() => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const userRaw = localStorage.getItem(USER_KEY);
      const profileRaw = localStorage.getItem(PROFILE_KEY);

      setState({
        token: token || null,
        user: userRaw ? JSON.parse(userRaw) : null,
        profile: profileRaw ? JSON.parse(profileRaw) : null,
        loading: false,
      });
    } catch {
      setState({ token: null, user: null, profile: null, loading: false });
    }
  }, []);

  const setSession = (
    session: { access_token: string; refresh_token?: string },
    user: { id: string; email: string },
    profile?: UserProfile
  ) => {
    localStorage.setItem(TOKEN_KEY, session.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (profile) {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(PROFILE_KEY);
    }

    setState({
      token: session.access_token,
      user,
      profile: profile ?? null,
      loading: false,
    });
  };

  const setProfile = (profile: UserProfile) => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    setState((s) => ({ ...s, profile }));
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(PROFILE_KEY);
    setState({ token: null, user: null, profile: null, loading: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, setSession, setProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
