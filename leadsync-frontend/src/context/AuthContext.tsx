import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { api } from "../lib/api";

/* =====================================================
   ROLE TYPES
===================================================== */
export type Role = "OWNER" | "ADMIN" | "AGENT";

/* =====================================================
   USER + COMPANY TYPES
===================================================== */
export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  companyId: string;
  isAvailable?: boolean;
  staffId?: string;
}

export interface Company {
  id: string;
  name: string;
  botBusinessType?: string;
}

/* =====================================================
   CONTEXT TYPE
===================================================== */
interface AuthContextValue {
  user: User | null;
  company: Company | null;
  companyId: string | null;
  token: string | null;
  isLoading: boolean;

  // Role Helpers
  isOwner: boolean;
  isAdmin: boolean;
  isAgent: boolean;

  login: (user: User, company: Company, token: string) => void;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/* =====================================================
   PROVIDER
===================================================== */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /* ================= RESTORE SESSION ================= */
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
      localStorage.clear();
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* ================= LOGIN ================= */
  const login = (
    userData: User,
    companyData: Company,
    authToken: string
  ) => {
    localStorage.setItem("token", authToken);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("company", JSON.stringify(companyData));

    setToken(authToken);
    setUser(userData);
    setCompany(companyData);
  };

  /* ================= LOGOUT ================= */
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("company");

    // Clear application specific cache
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("leadsync_")) {
        localStorage.removeItem(key);
      }
    });

    setToken(null);
    setUser(null);
    setCompany(null);
  };

  const updateUser = (userData: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...userData };
      localStorage.setItem("user", JSON.stringify(updated));
      return updated;
    });
  };

  /* ================= HEARTBEAT (Online presence) ================= */
  useEffect(() => {
    if (!token || !user) return;
    
    const sendHeartbeat = async () => {
      try {
        await api.post("/users/heartbeat");
      } catch (err) {
        // Fail silently
      }
    };
    
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000); // every 30s
    
    return () => {
      clearInterval(interval);
    };
  }, [token, user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        companyId: company?.id ?? null,
        token,
        isLoading,

        // ✅ Role helpers
        isOwner: user?.role === "OWNER",
        isAdmin: user?.role === "ADMIN",
        isAgent: user?.role === "AGENT",

        login,
        logout,
        updateUser,
      }}
    >
      {!isLoading && children}
    </AuthContext.Provider>
  );
}

/* =====================================================
   HOOK
===================================================== */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
