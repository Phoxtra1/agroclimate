import { useState } from "react";
import { MarketplaceLayout } from "@/components/market/MarketplaceLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// Lightweight buyer onboarding — does NOT route into farmer dashboard.
export default function MarketplaceAuth() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) {
      toast.error(error.message || "Login failed");
    }
    else navigate("/marketplace");
  };

  const onRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { display_name: name, user_kind: "buyer" },
          emailRedirectTo: `${window.location.origin}/marketplace`,
        },
      });
      if (error) throw error;
      // Best-effort: assign buyer role if session is immediately available
      if (data.user) {
        await supabase.from("user_roles" as any).insert({ user_id: data.user.id, role: "buyer" } as any);
      }
      toast.success("Account created. Check email if verification required, then sign in.");
    } catch (err: any) {
      toast.error(err.message || "Sign-up failed");
    } finally { setBusy(false); }
  };

  return (
    <MarketplaceLayout>
      <Card className="max-w-md mx-auto">
        <CardHeader><CardTitle>Buyer Access</CardTitle><CardDescription>Sign in or create a free buyer account to contact suppliers and post orders.</CardDescription></CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2 mb-3">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="register">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={onLogin} className="space-y-2">
                <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <Button type="submit" disabled={busy} className="w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}</Button>
              </form>
            </TabsContent>
            <TabsContent value="register">
              <form onSubmit={onRegister} className="space-y-2">
                <Input placeholder="Buyer / company name" value={name} onChange={(e) => setName(e.target.value)} required />
                <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <Input type="password" placeholder="Password (min 6)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                <Button type="submit" disabled={busy} className="w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create buyer account"}</Button>
                <p className="text-[11px] text-muted-foreground text-center">Buyers stay inside Market Link — no farmer dashboard required.</p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </MarketplaceLayout>
  );
}
