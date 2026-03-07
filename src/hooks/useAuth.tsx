import {
  useState,
  useEffect,
  createContext,
  useContext,
  ReactNode,
  useCallback,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const updateAuthState = useCallback((newSession: Session | null) => {
    setSession(newSession);
    setUser(newSession?.user ?? null);
    setLoading(false);
  }, []);

  const refreshSession = useCallback(async () => {
  try {
    const {
      data: { session: currentSession },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.warn("Auth session corrupted. Resetting.");

      // Remove all Supabase auth keys safely
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("sb-")) {
          localStorage.removeItem(key);
        }
      });

      updateAuthState(null);
    } else {
      updateAuthState(currentSession);
    }
  } catch {
    updateAuthState(null);
  }
}, [updateAuthState]);

  // INITIAL AUTH LOAD + AUTH LISTENER
  useEffect(() => {
    refreshSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession: Session | null) => {
        console.log(`[Auth Event]: ${event}`);

        if (
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "USER_UPDATED"
        ) {
          updateAuthState(currentSession);
        }

        if (event === "SIGNED_OUT") {
          localStorage.clear();
          sessionStorage.clear();
          updateAuthState(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshSession, updateAuthState]);

  // AUTO LOGOUT AFTER INACTIVITY (15 MINUTES)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const TIMEOUT_IN_MS = 15 * 60 * 1000;

    const handleAutoLogout = () => {
      console.log("Auto logout triggered due to inactivity.");
      signOut();
    };

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);

      if (session) {
        timeoutId = setTimeout(handleAutoLogout, TIMEOUT_IN_MS);
      }
    };

    const activityEvents = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    if (session) {
      resetTimer();

      activityEvents.forEach((event) =>
        window.addEventListener(event, resetTimer)
      );
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);

      activityEvents.forEach((event) =>
        window.removeEventListener(event, resetTimer)
      );
    };
  }, [session]);

  const signIn = async (email: string, password: string) => {
  try {
    const cleanEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) throw error;

    if (data.session) {
      updateAuthState(data.session);
    }

    return { error: null };
  } catch (error: any) {
    console.error("Login Error:", error.message);
    return { error };
  }
};

  const signUp = async (
    email: string,
    password: string,
    displayName: string
  ) => {
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
  };

  const signOut = async () => {
    setLoading(true);

    try {
      await supabase.auth.signOut();
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      updateAuthState(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signUp,
        signIn,
        signOut,
        refreshSession,
      }}
    >
      {children}
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
