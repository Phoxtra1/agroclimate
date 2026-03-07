import { useState, useEffect, createContext, useContext, ReactNode, useCallback, useRef } from "react";
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateAuthState = useCallback((newSession: Session | null) => {
    setSession(newSession);
    setUser(newSession?.user ?? null);
    setLoading(false);
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      if (error) {
        console.warn("Auth session error, resetting state.", error.message);
        updateAuthState(null);
      } else {
        updateAuthState(currentSession);
      }
    } catch {
      updateAuthState(null);
    }
  }, [updateAuthState]);

  // ── Auth state listener ──
  useEffect(() => {
    // 1. Set up the listener FIRST (per Supabase docs)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, currentSession) => {
        console.log(`[Auth Event]: ${_event}`);
        updateAuthState(currentSession);
      }
    );

    // 2. Then check for existing session
    refreshSession();

    return () => subscription.unsubscribe();
  }, [updateAuthState, refreshSession]);

  // ── Auto-logout after 15 min idle (separate, top-level useEffect) ──
  useEffect(() => {
    const TIMEOUT_MS = 15 * 60 * 1000;

    const handleAutoLogout = async () => {
      console.log("Auto-logout: idle for 15 minutes.");
      await supabase.auth.signOut();
    };

    const resetTimer = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (session) {
        timeoutRef.current = setTimeout(handleAutoLogout, TIMEOUT_MS);
      }
    };

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];

    if (session) {
      resetTimer();
      events.forEach((e) => window.addEventListener(e, resetTimer));
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [session]);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      // No manual state update needed — onAuthStateChange handles it
      return { error: null };
    } catch (error: any) {
      console.error("Login Error:", error.message);
      return { error };
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
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
    try {
      await supabase.auth.signOut();
      // onAuthStateChange will set state to null
    } catch (e) {
      console.error("Sign out error", e);
      updateAuthState(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
