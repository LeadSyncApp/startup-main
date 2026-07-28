import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
  ReactNode,
} from "react";
import { apiClient } from "../../api/client";

/* =====================================================
   TENANCY INTERFACES
===================================================== */
export type Role = "OWNER" | "MANAGER" | "STAFF";

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  role: Role;
  companyId: string;
  isAvailable?: boolean;
  staffId?: string;
  permissionOverrides?: string[] | null;
}

export interface Company {
  id: string;
  name: string;
  businessType?: "RETAIL" | "RESTAURANT" | "SERVICES";
  currencySymbol?: string;
  currencyCode?: string;
  gstin?: string;
  upiId?: string;
  scale?: "HOME_GROWN" | "SME_RETAIL";
  telegramConnected?: boolean;
  telegramBotUsername?: string;
}

interface AuthContextValue {
  user: User | null;
  company: Company | null;
  companyId: string | null;
  token: string | null;
  isLoading: boolean;
  isPendingOnboarding: boolean;
  pendingToken: string | null;

  isOwner: boolean;
  isAdmin: boolean;
  isAgent: boolean;
  isManager?: boolean;
  isStaff?: boolean;

  login: (user: User, company: Company, token: string) => void;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  updateCompany: (companyData: Partial<Company>) => void;
  setPendingOnboarding: (token: string) => void;
  completeOnboarding: (user: User, company: Company) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPendingOnboarding, setIsPendingOnboarding] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);

  const login = useCallback((userData: User, companyData: Company, authToken: string) => {
    localStorage.setItem("token", authToken);
    localStorage.setItem("access_token", authToken);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("company", JSON.stringify(companyData));

    setToken(authToken);
    setUser(userData);
    setCompany(companyData);
    setIsPendingOnboarding(false);
    setPendingToken(null);
  }, []);

  const setPendingOnboarding = useCallback((fragmentToken: string) => {
    setPendingToken(fragmentToken);
    setIsPendingOnboarding(true);
  }, []);

  const completeOnboarding = useCallback((userData: User, companyData: Company) => {
    if (pendingToken) {
      login(userData, companyData, pendingToken);
    }
  }, [pendingToken, login]);

  // Handle Google OAuth callback — token arrives in URL fragment (#token=...)
  useEffect(() => {
    const handleGoogleCallback = async () => {
      try {
        const hash = window.location.hash;
        if (!hash.startsWith("#token=")) return;

        const fragmentToken = hash.substring(7);
        if (!fragmentToken) return;

        // Check if welcome=true (new signup needs steps 2 & 3)
        const searchParams = new URLSearchParams(window.location.search);
        const isWelcome = searchParams.get("welcome") === "true";
        const authError = searchParams.get("error");

        if (authError === "NO_ACCOUNT") {
          // Google account doesn't exist — hard navigate to login so React Router resolves pathname correctly
          window.location.href = "/login?error=NO_ACCOUNT";
          return;
        }

        if (isWelcome) {
          // Store token and show wizard steps 2 & 3
          setPendingOnboarding(fragmentToken);
          setIsLoading(false);
          return;
        }

        // Existing user - fetch full user data from backend
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${fragmentToken}` },
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.message || "Failed to fetch user data";
          window.location.href = `/login?error=google_callback_failed&message=${encodeURIComponent(errMsg)}`;
          return;
        }

        const { user, company } = await res.json();
        login(user, company, fragmentToken);

        // Clean URL
        window.history.replaceState({}, document.title, "/");
      } catch (error) {
        console.error("Google callback handling failed:", error);
        window.location.href = "/login?error=google_callback_failed";
      }
    };

    handleGoogleCallback();
  }, [login]);

  // Restore authenticated credentials from standard caches safely + sync fresh permissions from /me
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = localStorage.getItem("token") || localStorage.getItem("access_token");
        const storedUser = localStorage.getItem("user");
        const storedCompany = localStorage.getItem("company");

        if (storedToken && storedUser && storedCompany) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          setCompany(JSON.parse(storedCompany));

          // Fetch fresh user profile & permissions from backend to stay in sync
          try {
            const res = await fetch("/api/auth/me", {
              headers: { Authorization: `Bearer ${storedToken}` },
            });
            if (res.ok) {
              const data = await res.json();
              if (data.user) {
                setUser(data.user);
                localStorage.setItem("user", JSON.stringify(data.user));
              }
              if (data.company) {
                setCompany(data.company);
                localStorage.setItem("company", JSON.stringify(data.company));
              }
            }
          } catch {
            // Ignore offline/network refresh failure, fallback to cached state
          }
        }
      } catch (error) {
        console.error("❌ Critical auth synchronization failure:", error);
        localStorage.clear();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    localStorage.removeItem("company");

    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("leadsync_")) {
        localStorage.removeItem(key);
      }
    });

    setToken(null);
    setUser(null);
    setCompany(null);
    setIsPendingOnboarding(false);
    setPendingToken(null);
  };

  const updateUser = (userData: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...userData };
      localStorage.setItem("user", JSON.stringify(updated));
      return updated;
    });
  };

  const updateCompany = (companyData: Partial<Company>) => {
    setCompany((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...companyData };
      localStorage.setItem("company", JSON.stringify(updated));
      return updated;
    });
  };

  // Heartbeat loop - keep connection status sync active
  useEffect(() => {
    if (!token || !user) return;

    const dispatchHeartbeat = async () => {
      try {
        await apiClient.post("/users/heartbeat");
      } catch {
        // silent
      }
    };

    dispatchHeartbeat();
    const interval = setInterval(dispatchHeartbeat, 30000);
    return () => clearInterval(interval);
  }, [token, user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        companyId: company?.id ?? null,
        token,
        isLoading,
        isPendingOnboarding,
        pendingToken,

        isOwner: user?.role === "OWNER",
        isAdmin: user?.role === "MANAGER",
        isAgent: user?.role === "STAFF",
        isManager: user?.role === "MANAGER",
        isStaff: user?.role === "STAFF",

        login,
        logout,
        updateUser,
        updateCompany,
        setPendingOnboarding,
        completeOnboarding,
      }}
    >
      {!isLoading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be called inside AuthProvider");
  }
  return context;
}