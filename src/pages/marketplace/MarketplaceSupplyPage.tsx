import { MarketplaceLayout } from "@/components/market/MarketplaceLayout";
import { SupplyList } from "@/components/market/SupplyList";
export default function MarketplaceSupplyPage() {
  return <MarketplaceLayout requireAuth><h1 className="text-xl font-bold mb-3">Supply Listings</h1><SupplyList requireAuthForChat /></MarketplaceLayout>;
}
