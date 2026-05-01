import { useState, useEffect } from "react";
import { MapPin, Phone, Globe, Sprout, LogOut, Plane, User as UserIcon, Edit2, Save, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { APP_VERSION_LABEL, WHATS_NEW } from "@/config/version";

interface ProfileData {
  display_name: string | null;
  phone: string | null;
  region: string | null;
  district: string | null;
  community: string | null;
  farm_size: string | null;
  preferred_language: string | null;
  farmer_type: string | null;
  drone_ownership: boolean | null;
  drone_type: string | null;
}

export default function Profile() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, phone, region, district, community, farm_size, preferred_language, farmer_type, drone_ownership, drone_type")
      .eq("user_id", user!.id)
      .maybeSingle();
    if (data) {
      setProfile(data);
      setEditData(data);
    }
    setLoading(false);
  };

  const saveProfile = async () => {
    if (!editData) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: editData.display_name,
        phone: editData.phone,
        region: editData.region,
        district: editData.district,
        community: editData.community,
        farm_size: editData.farm_size,
        preferred_language: editData.preferred_language,
        farmer_type: editData.farmer_type,
        drone_ownership: editData.drone_ownership,
        drone_type: editData.drone_type,
      })
      .eq("user_id", user!.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setProfile(editData);
      setEditing(false);
      toast({ title: "Profile updated" });
    }
  };

  const initials = (profile?.display_name || user?.email || "AG").slice(0, 2).toUpperCase();
  const farmerTypeLabels: Record<string, string> = {
    smallholder: "Smallholder Farmer",
    commercial: "Commercial Farmer",
    cooperative: "Cooperative Member",
    surveyor: "Land Surveyor",
    forestry: "Forestry Agent",
    extension: "Extension Officer",
  };

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-6">My Profile</h1>

      <div className="space-y-5">
        <div className="bg-card rounded-xl p-5 shadow-sm text-center">
          <div className="h-16 w-16 rounded-full bg-primary mx-auto flex items-center justify-center text-primary-foreground text-xl font-bold">
            {initials}
          </div>
          <h2 className="font-bold mt-3">{profile?.display_name || user?.email}</h2>
          <Badge variant="outline" className="mt-1">
            {farmerTypeLabels[profile?.farmer_type || "smallholder"] || "Farmer"}
          </Badge>
          {profile?.drone_ownership && (
            <Badge className="mt-1 ml-2 bg-accent text-accent-foreground">
              <Plane className="h-3 w-3 mr-1" /> Drone Ready
            </Badge>
          )}
        </div>

        {!editing ? (
          <div className="bg-card rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="text-sm font-medium">
                  {[profile?.community, profile?.district, profile?.region].filter(Boolean).join(", ") || "Not set"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Contact</p>
                <p className="text-sm font-medium">{user?.email} {profile?.phone ? `| ${profile.phone}` : ""}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Language</p>
                <p className="text-sm font-medium">{profile?.preferred_language || "English"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Sprout className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Farm Size</p>
                <p className="text-sm font-medium">{profile?.farm_size || "Not specified"}</p>
              </div>
            </div>
            {profile?.drone_ownership && profile.drone_type && (
              <div className="flex items-center gap-3">
                <Plane className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Drone</p>
                  <p className="text-sm font-medium">{profile.drone_type}</p>
                </div>
              </div>
            )}
            <Button className="w-full" onClick={() => setEditing(true)}>
              <Edit2 className="h-4 w-4 mr-2" /> Edit Profile
            </Button>
          </div>
        ) : (
          <div className="bg-card rounded-xl p-5 shadow-sm space-y-3">
            <Input
              placeholder="Display Name"
              value={editData?.display_name || ""}
              onChange={(e) => setEditData({ ...editData!, display_name: e.target.value })}
            />
            <Input
              placeholder="Phone"
              value={editData?.phone || ""}
              onChange={(e) => setEditData({ ...editData!, phone: e.target.value })}
            />
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Community" value={editData?.community || ""} onChange={(e) => setEditData({ ...editData!, community: e.target.value })} />
              <Input placeholder="District" value={editData?.district || ""} onChange={(e) => setEditData({ ...editData!, district: e.target.value })} />
              <Input placeholder="Region" value={editData?.region || ""} onChange={(e) => setEditData({ ...editData!, region: e.target.value })} />
            </div>
            <Input
              placeholder="Farm Size (e.g. 2 acres)"
              value={editData?.farm_size || ""}
              onChange={(e) => setEditData({ ...editData!, farm_size: e.target.value })}
            />
            <Select value={editData?.farmer_type || "smallholder"} onValueChange={(v) => setEditData({ ...editData!, farmer_type: v })}>
              <SelectTrigger><SelectValue placeholder="Farmer Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="smallholder">Smallholder Farmer</SelectItem>
                <SelectItem value="commercial">Commercial Farmer</SelectItem>
                <SelectItem value="cooperative">Cooperative Member</SelectItem>
                <SelectItem value="surveyor">Land Surveyor</SelectItem>
                <SelectItem value="forestry">Forestry Agent</SelectItem>
                <SelectItem value="extension">Extension Officer</SelectItem>
              </SelectContent>
            </Select>
            <Select value={editData?.preferred_language || "en"} onValueChange={(v) => setEditData({ ...editData!, preferred_language: v })}>
              <SelectTrigger><SelectValue placeholder="Language" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="tw">Twi</SelectItem>
                <SelectItem value="ha">Hausa</SelectItem>
                <SelectItem value="ee">Ewe</SelectItem>
                <SelectItem value="dag">Dagbani</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button onClick={saveProfile} className="flex-1"><Save className="h-4 w-4 mr-2" /> Save</Button>
              <Button variant="outline" onClick={() => { setEditing(false); setEditData(profile); }}><X className="h-4 w-4" /></Button>
            </div>
          </div>
        )}

        <Button variant="outline" className="w-full" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" /> Sign Out
        </Button>
      </div>
    </div>
  );
}
