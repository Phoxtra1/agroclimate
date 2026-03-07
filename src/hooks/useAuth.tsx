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

  // Memoized session updater to prevent unnecessary re-renders
  const updateAuthState = useCallback((newSession: Session | null) => {
    setSession(newSession);
    setUser(newSession?.user ?? null);
    setLoading(false);
  }, []);

  const refreshSession = useCallback(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    updateAuthState(currentSession);
  }, [updateAuthState]);

  useEffect(() => {
    // 1. Initial Load: Check session once
    refreshSession();

    // 2. Event Listener: Handle all auth changes (Sign In, Token Refresh, Sign Out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession) => {
        console.log(`[Auth Event]: ${event}`);
        
        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          updateAuthState(currentSession);
        } else if (event === 'SIGNED_OUT') {
          updateAuthState(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [updateAuthState, refreshSession]);

  const signIn = async (email: string, password: string) => {
    try {
      // Security refine: Clean input to prevent "Invalid Credentials" from hidden spaces/casing
      const cleanEmail = email.trim().toLowerCase();
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (error) throw error;

      updateAuthState(data.session);
      return { error: null };
    } catch (error: any) {
      console.error("Login Error:", error.message);
      return { error };
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { display_name: displayName },
          // Ensure correct redirect after verification
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
      // Force clear local storage just in case security update caused orphans
      localStorage.removeItem('supabase.auth.token'); 
    } finally {
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
