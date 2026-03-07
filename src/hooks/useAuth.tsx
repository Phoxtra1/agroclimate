import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";
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

  const updateAuthState = useCallback((newSession: Session | null) => {
    setSession(newSession);
    setUser(newSession?.user ?? null);
    setLoading(false);
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      if (error) {
        // UNIVERSAL FIX: If Chrome/Safari has a "ghost" session error, clear it
        console.warn("Auth sync issue detected, clearing stale storage.");
        localStorage.removeItem('supabase.auth.token');
        updateAuthState(null);
      } else {
        updateAuthState(currentSession);
      }
    } catch (e) {
      updateAuthState(null);
    }
  }, [updateAuthState]);

  useEffect(() => {
    // 1. Initial Load: Sequential check to prevent race conditions
    refreshSession();

    // 2. Event Listener: Handle all auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession) => {
        console.log(`[Universal Auth Event]: ${event}`);
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          updateAuthState(currentSession);
        } else if (event === 'SIGNED_OUT') {
          // Complete wipe to ensure non-default browsers don't hang
          localStorage.clear();
          sessionStorage.clear();
          updateAuthState(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [updateAuthState, refreshSession]);

  const signIn = async (email: string, password: string) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      
      // UNIVERSAL FIX: Clear local storage immediately before sign-in to ensure a fresh session
      localStorage.removeItem('supabase.auth.token');

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
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

  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({
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
