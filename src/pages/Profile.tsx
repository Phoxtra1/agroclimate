import { MapPin, Phone, Globe, Wheat, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export default function Profile() {
  const { user, signOut } = useAuth();
  const initials = user?.email?.slice(0, 2).toUpperCase() || "AG";

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-6">My Profile</h1>

      <div className="space-y-5">
        <div className="bg-card rounded-xl p-5 shadow-sm text-center">
          <div className="h-16 w-16 rounded-full bg-primary mx-auto flex items-center justify-center text-primary-foreground text-xl font-bold">
            {initials}
          </div>
          <h2 className="font-bold mt-3">{user?.user_metadata?.display_name || user?.email}</h2>
          <p className="text-sm text-muted-foreground">Farmer</p>
        </div>

        <div className="bg-card rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="text-sm font-medium">Ashanti Region, Ghana</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Language</p>
              <p className="text-sm font-medium">English</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Wheat className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Crops</p>
              <p className="text-sm font-medium">🌽 Maize · 🌾 Rice · 🥔 Cassava</p>
            </div>
          </div>
        </div>

        <Button className="w-full">Edit Profile</Button>
      </div>
    </div>
  );
}
