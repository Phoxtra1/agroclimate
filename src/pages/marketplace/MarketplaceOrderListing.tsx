import { MarketplaceLayout } from "@/components/market/MarketplaceLayout";
import { OrderListing } from "@/components/market/Orders";
export default function MarketplaceOrderListing() {
  return <MarketplaceLayout><h1 className="text-xl font-bold mb-3">Order Listing</h1><OrderListing /></MarketplaceLayout>;
}
