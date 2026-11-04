import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { auth } from "./firebase";
import { api } from "./api";
export type Session = {
  uid: string;
  email: string | null;
  admin: boolean;
  project: string;
};
type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string;
  refresh: () => void;
};
const Context = createContext<AuthState>({
  user: null,
  session: null,
  loading: true,
  error: "",
  refresh: () => {},
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<AuthState, "refresh">>({
    user: null,
    session: null,
    loading: true,
    error: "",
  });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!auth) {
      setState({
        user: null,
        session: null,
        loading: false,
        error: "Chưa có cấu hình Firebase cho web admin.",
      });
      return;
    }
    let epoch = 0,
      disposed = false;
    const off = onIdTokenChanged(auth, async (user) => {
      const current = ++epoch;
      setState({ user, session: null, loading: !!user, error: "" });
      if (!user) return;
      try {
        const session = await api<Session>("/v1/session");
        if (!disposed && epoch === current)
          setState({ user, session, loading: false, error: "" });
      } catch (e) {
        if (!disposed && epoch === current)
          setState({
            user,
            session: null,
            loading: false,
            error: (e as Error).message,
          });
      }
    });
    return () => {
      disposed = true;
      epoch++;
      off();
    };
  }, [version]);
  return (
    <Context.Provider
      value={{ ...state, refresh: () => setVersion((v) => v + 1) }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
