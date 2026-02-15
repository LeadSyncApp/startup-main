import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

export type Role = "OWNER" | "AGENT";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyId: string;
}

export interface Company {
  id: string;
  name: string;
}

interface AuthContextValue {
  user: User | null;
  company: Company | null;
  companyId: string | null;
  token: string | null;
  isLoading: boolean;
  login: (user: User, company: Company, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ Restore auth state safely on app load
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem("token");
      const storedUser = localStorage.getItem("user");
      const storedCompany = localStorage.getItem("company");

      if (storedToken && storedUser && storedCompany) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setCompany(JSON.parse(storedCompany));
      }
    } catch (error) {
      console.error("❌ Failed to restore auth state:", error);
      localStorage.clear(); // reset corrupted storage
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ✅ Login
  const login = (userData: User, companyData: Company, authToken: string) => {
    localStorage.setItem("token", authToken);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("company", JSON.stringify(companyData));

    setToken(authToken);
    setUser(userData);
    setCompany(companyData);
  };

  // ✅ Logout
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("company");

    setToken(null);
    setUser(null);
    setCompany(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        companyId: company?.id ?? null,
        token,
        isLoading,
        login,
        logout,
      }}
    >
      {!isLoading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
