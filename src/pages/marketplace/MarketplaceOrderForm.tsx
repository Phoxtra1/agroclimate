import { MarketplaceLayout } from "@/components/market/MarketplaceLayout";
import { PlaceOrderForm, OrderListing } from "@/components/market/Orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export default function MarketplaceOrderForm() {
  return (
    <MarketplaceLayout requireAuth>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Place Order</CardTitle></CardHeader>
          <CardContent><PlaceOrderForm /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Your Orders — edit or delete</CardTitle></CardHeader>
          <CardContent><OrderListing scope="mine" /></CardContent>
        </Card>
      </div>
    </MarketplaceLayout>
  );
}
