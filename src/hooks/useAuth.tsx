import {
  useState,
  useEffect,
  createContext,
  useContext,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ error: any }>; // ✅ ADD THIS
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);

const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateAuthState = useCallback((nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    setLoading(false);
  }, []);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session: currentSession },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("getSession error:", error.message);
        updateAuthState(null);
        return;
      }

      updateAuthState(currentSession ?? null);
    } catch (error) {
      console.error("refreshSession failed:", error);
      updateAuthState(null);
    }
  }, [updateAuthState]);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("signOut error:", error.message);
      }
    } finally {
      // Ensure UI updates immediately even if auth event is delayed
      updateAuthState(null);
    }
  }, [updateAuthState]);

  const resetIdleTimer = useCallback(() => {
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }

    if (!session) return;

    idleTimeoutRef.current = setTimeout(() => {
      void signOut();
    }, IDLE_TIMEOUT_MS);
  }, [session, signOut]);

  useEffect(() => {
    // 1) Attach listener first so SIGNED_IN updates immediately
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, currentSession) => {
        console.log("[Auth event]:", event);

  // 🔥 CRITICAL FIX
  if (event === "PASSWORD_RECOVERY") {
    console.log("Redirecting to reset password page...");
    window.location.href = "/reset-password";
    return;
  }

  updateAuthState(currentSession ?? null);
});

    // 2) Restore session on refresh
    void refreshSession();

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshSession, updateAuthState]);

  useEffect(() => {
    if (!session) {
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }
      return;
    }

    const handleActivity = () => resetIdleTimer();

    resetIdleTimer();
    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });

    return () => {
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = null;
      }
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
    };
  }, [session, resetIdleTimer]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        const cleanEmail = email.trim().toLowerCase();

        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) throw error;

        // Immediate UI update after successful sign-in
        updateAuthState(data.session ?? null);

        return { error: null };
      } catch (error: any) {
        console.error("Login error:", error?.message ?? error);
        return { error };
      }
    },
    [updateAuthState]
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      try {
        const cleanEmail = email.trim().toLowerCase();

        const { error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) throw error;
        return { error: null };
      } catch (error: any) {
        return { error };
      }
    },
    []
  );

  const forgotPassword = useCallback(async (email: string) => {
  try {
    const cleanEmail = email.trim().toLowerCase();

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;

    return { error: null };
  } catch (error: any) {
    console.error("Forgot password error:", error?.message ?? error);
    return { error };
  }
}, []);
  
  return (
    <AuthContext.Provider
      value={{ user, session, loading, signUp, signIn, signOut, refreshSession, forgotPassword, }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
