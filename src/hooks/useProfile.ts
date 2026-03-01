import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, phone, region, district, community, farm_size, preferred_language, farmer_type, drone_ownership, drone_type")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setProfile(data);
      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  return { profile, loading };
}
