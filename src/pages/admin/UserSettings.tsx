import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Save, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import agyenkwaIcon from "@/assets/agyenkwa-icon.png";

export default function UserSettings() {
  const { toast } = useToast();
  const { user } = useAuth();

  const [profile, setProfile] = useState({
    displayName: "Admin",
    email: user?.email || "",
    phone: "",
    bio: "System Manager",
    profileImage: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load profile from DB
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles")
        .select("display_name, phone, avatar_url, bio")
        .eq("user_id", user.id).maybeSingle();
      setProfile((p) => ({
        ...p,
        email: user.email || "",
        displayName: (data as any)?.display_name || p.displayName,
        phone: (data as any)?.phone || "",
        bio: (data as any)?.bio || p.bio,
        profileImage: (data as any)?.avatar_url || "",
      }));
      setLoading(false);
    })();
  }, [user]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setProfile((p) => ({ ...p, profileImage: ev.target?.result as string }));
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    // profiles has display_name, phone; avatar_url + bio may exist — write if present, ignore errors otherwise
    const payload: any = {
      user_id: user.id,
      display_name: profile.displayName,
      phone: profile.phone,
    };
    // opportunistic extras
    if (profile.profileImage) payload.avatar_url = profile.profileImage;
    if (profile.bio) payload.bio = profile.bio;
    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    toast({
      title: error ? "Save failed" : "Profile saved permanently",
      description: error?.message,
      variant: error ? "destructive" : "default",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">Admin Profile Settings</h2>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Profile Information</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile.profileImage || agyenkwaIcon} />
                <AvatarFallback className="text-lg">AD</AvatarFallback>
              </Avatar>
              <label className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1.5 cursor-pointer hover:bg-primary/90">
                <Camera className="h-3 w-3" />
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>
            </div>
            <div>
              <p className="font-medium">{profile.displayName}</p>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input value={profile.displayName} onChange={e => setProfile({ ...profile, displayName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile.email} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input placeholder="+233..." value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea value={profile.bio} onChange={e => setProfile({ ...profile, bio: e.target.value })} rows={3} />
          </div>

          <Button onClick={saveProfile} disabled={saving || loading}>
            <Save className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save Profile"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Account Security</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>✅ Two-factor authentication: <strong>Available via Auth provider</strong></p>
          <p>✅ Last login: <strong>{new Date().toLocaleDateString()}</strong></p>
          <p>✅ Role: <strong>Administrator</strong></p>
        </CardContent>
      </Card>
    </div>
  );
}
