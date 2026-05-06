import { MarketplaceLayout } from "@/components/market/MarketplaceLayout";
import { OrderListing } from "@/components/market/Orders";
export default function MarketplaceOrderListing() {
  return <MarketplaceLayout requireAuth><h1 className="text-xl font-bold mb-3">Order Listing</h1><OrderListing requireAuthForChat allowOwnerActions /></MarketplaceLayout>;
}
