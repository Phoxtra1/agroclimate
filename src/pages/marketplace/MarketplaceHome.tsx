import { MarketplaceLayout } from "@/components/market/MarketplaceLayout";
import { SupplyList } from "@/components/market/SupplyList";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight, Sprout, ShoppingBag } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function MarketplaceHome() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) {
    // Strict gate — buyers must register / sign in before browsing the marketplace.
    return <Navigate to="/marketplace/auth" replace />;
  }

  return (
    <MarketplaceLayout requireAuth>
      <section className="text-center py-6">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Connect with African farmers, directly.</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto text-sm md:text-base">
          Discover verified supply and post your demand while keeping trade coordination visible and fair.
        </p>
        <div className="flex justify-center gap-2 mt-4 flex-wrap">
          {/* All CTAs stay inside /marketplace — buyers never land in /dashboard. */}
          <Link to="/marketplace/supply"><Button>Browse Supply <ArrowRight className="h-4 w-4 ml-1" /></Button></Link>
          <Link to="/marketplace/orders"><Button variant="outline">Place an Order</Button></Link>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {[
          { icon: ShoppingBag, title: "Supply Listings", desc: "Real-time produce from verified farmers across regions." },
          { icon: Sprout, title: "Place Order", desc: "Post buyer demand — farmers respond directly." },
        ].map((c) => (
          <Card key={c.title}><CardContent className="pt-5">
            <c.icon className="h-6 w-6 text-primary mb-2" />
            <h3 className="font-semibold">{c.title}</h3>
            <p className="text-xs text-muted-foreground">{c.desc}</p>
          </CardContent></Card>
        ))}
      </section>

      <section className="mb-3">
        <h2 className="text-lg font-bold mb-2">Latest supply</h2>
        <SupplyList requireAuthForChat />
      </section>
    </MarketplaceLayout>
  );
}
