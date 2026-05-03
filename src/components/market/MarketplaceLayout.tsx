import { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Store, Home, ListPlus, Package, LogIn, LogOut, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import aminevaLogo from "@/assets/amineva-logo.png";

export function MarketplaceLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${
      isActive ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:text-foreground hover:bg-accent"
    }`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card sticky top-0 z-30">
        <div className="container mx-auto px-3 py-2 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 mr-2">
            <img src={aminevaLogo} alt="" className="h-8 w-8 rounded-full" />
            <div className="leading-tight">
              <div className="font-bold text-sm flex items-center gap-1"><Store className="h-3.5 w-3.5 text-primary" /> Market Link</div>
              <div className="text-[10px] text-muted-foreground">Powered by AgroClimate</div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-2">
            <NavLink to="/marketplace" end className={linkCls}><Home className="h-4 w-4" />Home</NavLink>
            <NavLink to="/marketplace/supply" className={linkCls}><Package className="h-4 w-4" />Supply Listings</NavLink>
            <NavLink to="/marketplace/orders" className={linkCls}><ListPlus className="h-4 w-4" />Place Order</NavLink>
            <NavLink to="/marketplace/order-listing" className={linkCls}><Package className="h-4 w-4" />Order Listing</NavLink>
            {user && <NavLink to="/marketplace/inbox" className={linkCls}>Messages</NavLink>}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}><ArrowLeft className="h-3.5 w-3.5 mr-1" />Home</Button>
            {user ? (
              <Button variant="outline" size="sm" onClick={() => { signOut(); navigate("/marketplace"); }}>
                <LogOut className="h-3.5 w-3.5 mr-1" /> Sign out
              </Button>
            ) : (
              <Button size="sm" onClick={() => navigate("/marketplace/auth")}><LogIn className="h-3.5 w-3.5 mr-1" />Sign in</Button>
            )}
          </div>
        </div>
        <div className="md:hidden border-t flex overflow-x-auto">
          <NavLink to="/marketplace" end className={linkCls}>Home</NavLink>
          <NavLink to="/marketplace/supply" className={linkCls}>Supply</NavLink>
          <NavLink to="/marketplace/orders" className={linkCls}>Place Order</NavLink>
          <NavLink to="/marketplace/order-listing" className={linkCls}>Orders</NavLink>
          {user && <NavLink to="/marketplace/inbox" className={linkCls}>Messages</NavLink>}
        </div>
      </header>
      <main className="flex-1 container mx-auto px-3 py-4">{children}</main>
      <footer className="border-t py-3 text-center text-[11px] text-muted-foreground">
        Market Link · A public agricultural trade access point of AgroClimate.
      </footer>
    </div>
  );
}
