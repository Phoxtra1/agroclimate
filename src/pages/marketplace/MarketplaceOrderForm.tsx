import { MarketplaceLayout } from "@/components/market/MarketplaceLayout";
import { PlaceOrderForm } from "@/components/market/Orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export default function MarketplaceOrderForm() {
  return (
    <MarketplaceLayout>
      <Card className="max-w-3xl mx-auto">
        <CardHeader><CardTitle>Place Order</CardTitle></CardHeader>
        <CardContent><PlaceOrderForm /></CardContent>
      </Card>
    </MarketplaceLayout>
  );
}
