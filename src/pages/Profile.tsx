import { ArrowLeft, MapPin, Phone, Globe, Wheat } from "lucide-react";
import { Link } from "react-router-dom";

export default function Profile() {
  return (
    <div className="pb-20 max-w-lg mx-auto">
      <header className="px-4 pt-6 pb-4 flex items-center gap-3">
        <Link to="/" className="p-2 -ml-2 rounded-lg hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">My Profile</h1>
      </header>

      <div className="px-4 space-y-5">
        {/* Avatar & name */}
        <div className="bg-card rounded-xl p-5 shadow-sm text-center">
          <div className="h-16 w-16 rounded-full bg-primary mx-auto flex items-center justify-center text-primary-foreground text-xl font-bold">
            KA
          </div>
          <h2 className="font-bold mt-3">Kwame Asante</h2>
          <p className="text-sm text-muted-foreground">Farmer</p>
        </div>

        {/* Details */}
        <div className="bg-card rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="text-sm font-medium">Ashanti Region, Kumasi, Ghana</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="text-sm font-medium">+233 24 XXX XXXX</p>
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

        <button className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity">
          Edit Profile
        </button>
      </div>
    </div>
  );
}
