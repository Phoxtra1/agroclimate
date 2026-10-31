import { useState, useEffect, useMemo, useCallback } from "react";
import { useInventory } from "@/hooks/useInventory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2, Package, Users, MapPin, Wheat, TrendingDown, DollarSign, TrendingUp, Loader2, Bot, MessageSquare, AlertTriangle, ShoppingCart, Filter, X, Coins, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { AgriCostCalculator } from "@/components/inventory/AgriCostCalculator";
import { OpenInSatelliteButton } from "@/components/satellite/OpenInSatelliteButton";

// ─── Comprehensive timezone → currency map ───
const USER_TZ = typeof window !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";

const TIMEZONE_CURRENCY_MAP: Record<string, { locale: string; currency: string }> = {
  // West Africa
  "Africa/Accra": { locale: "en-GH", currency: "GHS" },
  "Africa/Lagos": { locale: "en-NG", currency: "NGN" },
  "Africa/Abidjan": { locale: "fr-CI", currency: "XOF" },
  "Africa/Dakar": { locale: "fr-SN", currency: "XOF" },
  "Africa/Bamako": { locale: "fr-ML", currency: "XOF" },
  "Africa/Ouagadougou": { locale: "fr-BF", currency: "XOF" },
  "Africa/Niamey": { locale: "fr-NE", currency: "XOF" },
  "Africa/Lome": { locale: "fr-TG", currency: "XOF" },
  "Africa/Porto-Novo": { locale: "fr-BJ", currency: "XOF" },
  "Africa/Bissau": { locale: "pt-GW", currency: "XOF" },
  "Africa/Conakry": { locale: "fr-GN", currency: "GNF" },
  "Africa/Freetown": { locale: "en-SL", currency: "SLL" },
  "Africa/Monrovia": { locale: "en-LR", currency: "LRD" },
  "Africa/Banjul": { locale: "en-GM", currency: "GMD" },
  "Africa/Nouakchott": { locale: "ar-MR", currency: "MRU" },
  // Central Africa
  "Africa/Douala": { locale: "fr-CM", currency: "XAF" },
  "Africa/Libreville": { locale: "fr-GA", currency: "XAF" },
  "Africa/Brazzaville": { locale: "fr-CG", currency: "XAF" },
  "Africa/Kinshasa": { locale: "fr-CD", currency: "CDF" },
  "Africa/Lubumbashi": { locale: "fr-CD", currency: "CDF" },
  "Africa/Bangui": { locale: "fr-CF", currency: "XAF" },
  "Africa/Ndjamena": { locale: "fr-TD", currency: "XAF" },
  "Africa/Malabo": { locale: "es-GQ", currency: "XAF" },
  // East Africa
  "Africa/Nairobi": { locale: "en-KE", currency: "KES" },
  "Africa/Kampala": { locale: "en-UG", currency: "UGX" },
  "Africa/Dar_es_Salaam": { locale: "sw-TZ", currency: "TZS" },
  "Africa/Addis_Ababa": { locale: "am-ET", currency: "ETB" },
  "Africa/Kigali": { locale: "rw-RW", currency: "RWF" },
  "Africa/Bujumbura": { locale: "fr-BI", currency: "BIF" },
  "Africa/Mogadishu": { locale: "so-SO", currency: "SOS" },
  "Africa/Asmara": { locale: "ti-ER", currency: "ERN" },
  "Africa/Djibouti": { locale: "fr-DJ", currency: "DJF" },
  "Indian/Antananarivo": { locale: "mg-MG", currency: "MGA" },
  // Southern Africa
  "Africa/Johannesburg": { locale: "en-ZA", currency: "ZAR" },
  "Africa/Lusaka": { locale: "en-ZM", currency: "ZMW" },
  "Africa/Harare": { locale: "en-ZW", currency: "ZWL" },
  "Africa/Maputo": { locale: "pt-MZ", currency: "MZN" },
  "Africa/Blantyre": { locale: "en-MW", currency: "MWK" },
  "Africa/Gaborone": { locale: "en-BW", currency: "BWP" },
  "Africa/Windhoek": { locale: "en-NA", currency: "NAD" },
  "Africa/Maseru": { locale: "en-LS", currency: "LSL" },
  "Africa/Mbabane": { locale: "en-SZ", currency: "SZL" },
  "Indian/Mauritius": { locale: "en-MU", currency: "MUR" },
  // North Africa
  "Africa/Cairo": { locale: "ar-EG", currency: "EGP" },
  "Africa/Tunis": { locale: "ar-TN", currency: "TND" },
  "Africa/Algiers": { locale: "ar-DZ", currency: "DZD" },
  "Africa/Casablanca": { locale: "ar-MA", currency: "MAD" },
  "Africa/Tripoli": { locale: "ar-LY", currency: "LYD" },
  "Africa/Khartoum": { locale: "ar-SD", currency: "SDG" },
  // Asia
  "Asia/Kolkata": { locale: "en-IN", currency: "INR" },
  "Asia/Dhaka": { locale: "bn-BD", currency: "BDT" },
  "Asia/Karachi": { locale: "ur-PK", currency: "PKR" },
  "Asia/Colombo": { locale: "si-LK", currency: "LKR" },
  "Asia/Kathmandu": { locale: "ne-NP", currency: "NPR" },
  "Asia/Yangon": { locale: "my-MM", currency: "MMK" },
  "Asia/Bangkok": { locale: "th-TH", currency: "THB" },
  "Asia/Jakarta": { locale: "id-ID", currency: "IDR" },
  "Asia/Manila": { locale: "en-PH", currency: "PHP" },
  "Asia/Ho_Chi_Minh": { locale: "vi-VN", currency: "VND" },
  "Asia/Kuala_Lumpur": { locale: "ms-MY", currency: "MYR" },
  "Asia/Shanghai": { locale: "zh-CN", currency: "CNY" },
  "Asia/Tokyo": { locale: "ja-JP", currency: "JPY" },
  "Asia/Seoul": { locale: "ko-KR", currency: "KRW" },
  // Europe
  "Europe/London": { locale: "en-GB", currency: "GBP" },
  "Europe/Paris": { locale: "fr-FR", currency: "EUR" },
  "Europe/Berlin": { locale: "de-DE", currency: "EUR" },
  "Europe/Rome": { locale: "it-IT", currency: "EUR" },
  "Europe/Madrid": { locale: "es-ES", currency: "EUR" },
  // Americas
  "America/Sao_Paulo": { locale: "pt-BR", currency: "BRL" },
  "America/Mexico_City": { locale: "es-MX", currency: "MXN" },
  "America/Bogota": { locale: "es-CO", currency: "COP" },
  "America/Lima": { locale: "es-PE", currency: "PEN" },
  "America/Buenos_Aires": { locale: "es-AR", currency: "ARS" },
};

// Region-level fallback map (continent prefix → currency)
const REGION_FALLBACK: Record<string, { locale: string; currency: string }> = {
  "Africa": { locale: "en-US", currency: "USD" }, // only if no specific tz matches
  "Asia": { locale: "en-US", currency: "USD" },
  "Europe": { locale: "en-GB", currency: "EUR" },
  "America": { locale: "en-US", currency: "USD" },
  "Pacific": { locale: "en-AU", currency: "AUD" },
  "Indian": { locale: "en-IN", currency: "INR" },
};

function getLocaleCurrency(): { locale: string; currency: string } {
  // 1. Exact timezone match
  if (TIMEZONE_CURRENCY_MAP[USER_TZ]) return TIMEZONE_CURRENCY_MAP[USER_TZ];

  // 2. Region fallback from timezone continent
  const region = USER_TZ.split("/")[0];
  if (REGION_FALLBACK[region]) return REGION_FALLBACK[region];

  // 3. Try browser language to infer country
  const browserLang = typeof navigator !== "undefined" ? navigator.language : "en-US";
  const countryCode = browserLang.split("-")[1]?.toUpperCase();
  const COUNTRY_CURRENCY: Record<string, string> = {
    GH: "GHS", NG: "NGN", KE: "KES", ZA: "ZAR", UG: "UGX", TZ: "TZS",
    CM: "XAF", SN: "XOF", CI: "XOF", IN: "INR", GB: "GBP", BR: "BRL",
    PH: "PHP", PK: "PKR", EG: "EGP", ET: "ETB", RW: "RWF", ZM: "ZMW",
    MW: "MWK", MZ: "MZN", CD: "CDF", ZW: "ZWL", DE: "EUR", FR: "EUR",
  };
  if (countryCode && COUNTRY_CURRENCY[countryCode]) {
    return { locale: browserLang, currency: COUNTRY_CURRENCY[countryCode] };
  }

  // 4. Absolute fallback
  return { locale: browserLang, currency: "USD" };
}

const { locale: DEFAULT_LOCALE, currency: DEFAULT_CURRENCY } = getLocaleCurrency();

// ─── Currency changer: supported currencies with exchange rates relative to USD ───
const INVENTORY_CURRENCIES = [
  { code: "GHS", symbol: "₵", name: "Ghana Cedi", rate: 15.5 },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling", rate: 129.0 },
  { code: "XOF", symbol: "CFA", name: "CFA Franc", rate: 605.0 },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira", rate: 1580.0 },
  { code: "KRW", symbol: "₩", name: "Korean Won", rate: 1380.0 },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", rate: 3.67 },
  { code: "USD", symbol: "$", name: "US Dollar", rate: 1.0 },
  { code: "EUR", symbol: "€", name: "Euro", rate: 0.92 },
] as const;

// Build a rate map for quick lookup; base currency is the auto-detected one
function getConversionRate(fromCode: string, toCode: string): number {
  const fromRate = INVENTORY_CURRENCIES.find(c => c.code === fromCode)?.rate ?? 1;
  const toRate = INVENTORY_CURRENCIES.find(c => c.code === toCode)?.rate ?? 1;
  // Convert: amount in "from" → USD → "to"
  return toRate / fromRate;
}

// Dynamic currency formatter – used throughout the component
function makeFormatCurrency(currencyCode: string, locale: string) {
  return (amount: number) => {
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 2,
      }).format(amount);
    } catch {
      const sym = INVENTORY_CURRENCIES.find(c => c.code === currencyCode)?.symbol ?? currencyCode;
      return `${sym} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    }
  };
}

// Reusable Dialog for adding/editing records
function RecordDialog({ title, fields, onSave, trigger, initialData }: {
  title: string;
  fields: { name: string; label: string; type?: string; required?: boolean; placeholder?: string }[];
  onSave: (data: any) => void;
  trigger: React.ReactNode;
  initialData?: any;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(initialData || {});

  const handleOpen = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && initialData) setForm({ ...initialData });
    if (isOpen && !initialData) setForm({});
  }, [initialData]);

  const handleSave = () => {
    onSave(form);
    setOpen(false);
    setForm({});
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[425px]">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-4">
          {fields.map((f) => (
            <div key={f.name} className="grid gap-1.5">
              <Label htmlFor={f.name} className="text-xs font-semibold">{f.label}{f.required && " *"}</Label>
              <Input
                id={f.name}
                type={f.type || "text"}
                placeholder={f.placeholder || f.label}
                value={form[f.name] ?? ""}
                className="h-9"
                onChange={(e) => setForm((prev: any) => ({ ...prev, [f.name]: f.type === "number" ? Number(e.target.value) : e.target.value }))}
              />
            </div>
          ))}
          <Button onClick={handleSave} className="w-full mt-2">Save Record</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AgroInventory() {
  const [filterSeason, setFilterSeason] = useState<string>();
  const [filterCrop, setFilterCrop] = useState<string>();
  const [filterPlot, setFilterPlot] = useState<string>();

  // ─── Currency changer state ───
  const [selectedCurrency, setSelectedCurrency] = useState(
    INVENTORY_CURRENCIES.find(c => c.code === DEFAULT_CURRENCY) ?? INVENTORY_CURRENCIES[0]
  );
  const conversionRate = getConversionRate(DEFAULT_CURRENCY, selectedCurrency.code);
  const formatCurrency = useCallback(
    (amount: number) => makeFormatCurrency(selectedCurrency.code, DEFAULT_LOCALE)(amount * conversionRate),
    [selectedCurrency.code, conversionRate]
  );

  const {
    inventoryItems, laborRecords, landCosts, harvestRecords, harvestLosses, salesRecords,
    metrics, loading, addRecord, updateRecord, deleteRecord, seasons, crops, plots,
  } = useInventory(filterSeason, filterCrop, filterPlot);

  // Field configurations for each section
  const fieldConfigs = useMemo(() => ({
    inputs: [
      { name: "item_name", label: "Item Name", required: true, placeholder: "e.g. NPK Fertilizer" },
      { name: "item_type", label: "Type", required: true, placeholder: "e.g. Fertilizer, Seeds, Chemical" },
      { name: "quantity", label: "Quantity", type: "number", required: true },
      { name: "unit", label: "Unit", placeholder: "kg, liters, bags" },
      { name: "price_per_unit", label: `Price per Unit (${selectedCurrency.code})`, type: "number", required: true },
      { name: "crop_name", label: "Crop/Linked To" },
      { name: "season", label: "Season" },
      { name: "farm_plot", label: "Farm Plot" },
      { name: "notes", label: "Notes" },
    ],
    labor: [
      { name: "task_description", label: "Task", required: true, placeholder: "e.g. Weeding, Planting, Spraying" },
      { name: "worker_count", label: "Number of Workers", type: "number", required: true },
      { name: "days_worked", label: "Days Worked", type: "number", required: true },
      { name: "cost_per_day", label: `Cost per Day (${selectedCurrency.code})`, type: "number", required: true },
      { name: "crop_name", label: "Crop/Linked To" },
      { name: "season", label: "Season" },
      { name: "farm_plot", label: "Farm Plot" },
      { name: "notes", label: "Notes" },
    ],
    harvest: [
      { name: "crop_name", label: "Crop Name", required: true, placeholder: "e.g. Maize, Cassava, Tomatoes" },
      { name: "quantity", label: "Quantity Harvested", type: "number", required: true },
      { name: "unit", label: "Unit", placeholder: "kg, bags, crates" },
      { name: "harvest_date", label: "Harvest Date", type: "date" },
      { name: "quality_grade", label: "Quality Grade", placeholder: "A, B, C or Premium, Standard" },
      { name: "season", label: "Season" },
      { name: "farm_plot", label: "Farm Plot" },
      { name: "notes", label: "Notes" },
    ],
    loss: [
      { name: "crop_name", label: "Crop/Livestock", required: true, placeholder: "e.g. Maize, Chickens" },
      { name: "loss_reason", label: "Reason for Loss", required: true, placeholder: "e.g. Pest damage, Spoilage, Drought" },
      { name: "quantity_lost", label: "Quantity Lost", type: "number", required: true },
      { name: "unit", label: "Unit", placeholder: "kg, heads, bags" },
      { name: "season", label: "Season" },
      { name: "farm_plot", label: "Farm Plot" },
      { name: "notes", label: "Notes" },
    ],
    sales: [
      { name: "crop_name", label: "Product Sold", required: true, placeholder: "e.g. Maize, Eggs, Tomatoes" },
      { name: "quantity_sold", label: "Quantity Sold", type: "number", required: true },
      { name: "unit", label: "Unit", placeholder: "kg, bags, crates" },
      { name: "price_per_unit", label: `Price per Unit (${selectedCurrency.code})`, type: "number", required: true },
      { name: "buyer_name", label: "Buyer Name", placeholder: "e.g. Market Trader, Cooperative" },
      { name: "sale_date", label: "Sale Date", type: "date" },
      { name: "season", label: "Season" },
      { name: "farm_plot", label: "Farm Plot" },
      { name: "notes", label: "Notes" },
    ],
  }), [selectedCurrency.code]);

  // Dynamic cost/profit calculations
  const totals = useMemo(() => {
    const totalInputsCost = inventoryItems.reduce((sum, item) => sum + (item.quantity || 0) * (item.price_per_unit || 0), 0);
    const totalLaborCost = laborRecords.reduce((sum, r: any) => sum + (r.worker_count || 0) * (r.days_worked || 0) * (r.cost_per_day || 0), 0);
    const totalLandCost = landCosts?.reduce((sum: number, r: any) => sum + (r.cost_amount || 0), 0) ?? 0;
    const totalHarvestQty = harvestRecords.reduce((sum, r: any) => sum + (r.quantity || 0), 0);
    const totalLossQty = harvestLosses.reduce((sum, r: any) => sum + (r.quantity_lost || 0), 0);
    const totalRevenue = salesRecords.reduce((sum, r: any) => sum + (r.quantity_sold || 0) * (r.price_per_unit || 0), 0);
    const totalExpenses = totalInputsCost + totalLaborCost + totalLandCost;
    const netProfit = totalRevenue - totalExpenses;

    return { totalInputsCost, totalLaborCost, totalLandCost, totalHarvestQty, totalLossQty, totalRevenue, totalExpenses, netProfit };
  }, [inventoryItems, laborRecords, landCosts, harvestRecords, harvestLosses, salesRecords]);

  // Use local totals if metrics from hook are empty/zero, otherwise prefer hook metrics
  const displayMetrics = {
    totalInputsCost: metrics.totalInputsCost || totals.totalInputsCost,
    totalLaborCost: metrics.totalLaborCost || totals.totalLaborCost,
    totalLandCost: metrics.totalLandCost || totals.totalLandCost,
    totalHarvestQty: metrics.totalHarvestQty || totals.totalHarvestQty,
    totalLosses: totals.totalLossQty,
    totalRevenue: metrics.totalRevenue || totals.totalRevenue,
    netProfit: totals.netProfit,
    totalExpenses: totals.totalExpenses,
  };

  if (loading && inventoryItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-sm text-muted-foreground animate-pulse">Syncing farm records...</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">📦 Agro Inventory</h1>
          <p className="text-sm text-muted-foreground">Comprehensive farm input, labor, harvest, loss &amp; sales tracking</p>
          <Badge variant="outline" className="mt-1 text-[10px]">Currency: {selectedCurrency.symbol} {selectedCurrency.code}</Badge>
        </div>
        {filterPlot && (
          <OpenInSatelliteButton query={filterPlot} label={`Inventory farm plot reference · ${filterPlot}`} zoom={15}>
            Map selected plot
          </OpenInSatelliteButton>
        )}
      </div>

      {/* ─── Filter Bar ─── */}
      <Card className="border-border/50 bg-muted/30 shadow-none">
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Filter className="h-3.5 w-3.5" /> Filters:
            </div>
            <Select value={filterSeason || ""} onValueChange={(v) => setFilterSeason(v === "__all__" ? undefined : v)}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue placeholder="All Seasons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Seasons</SelectItem>
                {seasons.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCrop || ""} onValueChange={(v) => setFilterCrop(v === "__all__" ? undefined : v)}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue placeholder="All Crops" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Crops</SelectItem>
                {crops.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPlot || ""} onValueChange={(v) => setFilterPlot(v === "__all__" ? undefined : v)}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue placeholder="All Plots" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Plots</SelectItem>
                {plots.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            {/* ─── Currency Changer Dropdown ─── */}
            <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-border/50">
              <Coins className="h-3.5 w-3.5 text-muted-foreground" />
              <Select
                value={selectedCurrency.code}
                onValueChange={(v) => {
                  const found = INVENTORY_CURRENCIES.find(c => c.code === v);
                  if (found) setSelectedCurrency(found);
                }}
              >
                <SelectTrigger className="h-8 w-[130px] text-xs font-medium">
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  {INVENTORY_CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code} className="text-xs">
                      {c.symbol} {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(filterSeason || filterCrop || filterPlot) && (
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => { setFilterSeason(undefined); setFilterCrop(undefined); setFilterPlot(undefined); }}>
                <X className="h-3 w-3" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Overview Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <MetricCard icon={Package} label="Inputs" value={formatCurrency(displayMetrics.totalInputsCost)} color="text-blue-600" bg="bg-blue-50/50" />
        <MetricCard icon={Users} label="Labor" value={formatCurrency(displayMetrics.totalLaborCost)} color="text-indigo-600" bg="bg-indigo-50/50" />
        <MetricCard icon={MapPin} label="Land" value={formatCurrency(displayMetrics.totalLandCost)} color="text-violet-600" bg="bg-violet-50/50" />
        <MetricCard icon={Wheat} label="Harvest" value={`${displayMetrics.totalHarvestQty.toLocaleString()}`} color="text-primary" bg="bg-primary/10" />
        <MetricCard icon={AlertTriangle} label="Losses" value={`${displayMetrics.totalLosses.toLocaleString()}`} color="text-destructive" bg="bg-destructive/10" />
        <MetricCard icon={ShoppingCart} label="Revenue" value={formatCurrency(displayMetrics.totalRevenue)} color="text-emerald-600" bg="bg-emerald-50/50" />
        <MetricCard icon={DollarSign} label="Expenses" value={formatCurrency(displayMetrics.totalExpenses)} color="text-orange-600" bg="bg-orange-50/50" />
        <MetricCard icon={TrendingUp} label="Net Profit" value={formatCurrency(displayMetrics.netProfit)} color={displayMetrics.netProfit >= 0 ? "text-emerald-700" : "text-destructive"} bg={displayMetrics.netProfit >= 0 ? "bg-emerald-50" : "bg-destructive/10"} />
      </div>

      {/* Season Summary Card */}
      <Card className="border-dashed border-primary/30 bg-primary/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Season Summary</p>
              <p className="text-[11px] text-muted-foreground">
                Total costs: {formatCurrency(displayMetrics.totalExpenses)} | Losses: {displayMetrics.totalLosses.toLocaleString()} units | Revenue: {formatCurrency(displayMetrics.totalRevenue)} | <strong className={displayMetrics.netProfit >= 0 ? "text-emerald-600" : "text-destructive"}>Profit: {formatCurrency(displayMetrics.netProfit)}</strong>
              </p>
            </div>
            <Link to="/produce-safety">
              <Button size="sm" className="shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Verify Batch
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

        {/* Tabs */}
        <Tabs defaultValue="inputs" className="space-y-4">
          <TabsList className="bg-muted/50 p-1 flex-wrap h-auto gap-1">
            <TabsTrigger value="inputs" className="text-xs px-4">Inputs</TabsTrigger>
            <TabsTrigger value="labor" className="text-xs px-4">Labor</TabsTrigger>
            <TabsTrigger value="harvest" className="text-xs px-4">Harvest</TabsTrigger>
            <TabsTrigger value="loss" className="text-xs px-4">Losses</TabsTrigger>
            <TabsTrigger value="sales" className="text-xs px-4">Sales</TabsTrigger>
            <TabsTrigger value="cost-scenarios" className="text-xs px-4">Cost Scenarios</TabsTrigger>
          </TabsList>

          {/* ===== COST SCENARIOS TAB ===== */}
          <TabsContent value="cost-scenarios" className="space-y-4">
            <AgriCostCalculator currencyCode={selectedCurrency.code} />
          </TabsContent>

        {/* ===== INPUTS TAB (unchanged logic) ===== */}
        <TabsContent value="inputs" className="space-y-4">
          <SectionCard title="Input Inventory" badge={`${inventoryItems.length}`}
            addDialog={<RecordDialog title="Add Input" fields={fieldConfigs.inputs} onSave={(data) => addRecord("inventory_items", data)} trigger={<Button size="sm" className="h-8"><Plus className="h-4 w-4 mr-1" /> New Input</Button>} />}
          >
            <div className="rounded-md border">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-[200px]">Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Total Cost</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventoryItems.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="font-medium p-3">
                        <div>{item.item_name}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">{item.item_type}</div>
                      </TableCell>
                      <TableCell className="p-3">{item.quantity} {item.unit}</TableCell>
                      <TableCell className="p-3 font-semibold">{formatCurrency(item.quantity * item.price_per_unit)}</TableCell>
                      <TableCell className="text-right p-3">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteRecord("inventory_items", item.id)}>
                          <Trash2 className="h-4 w-4 text-destructive/70" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {inventoryItems.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No input records yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            <div className="px-4 py-3 border-t bg-muted/20 text-sm font-semibold flex justify-between">
              <span>Total Input Cost</span>
              <span>{formatCurrency(totals.totalInputsCost)}</span>
            </div>
          </SectionCard>
        </TabsContent>

        {/* ===== LABOR TAB ===== */}
        <TabsContent value="labor" className="space-y-4">
          <SectionCard title="Labor Records" badge={`${laborRecords.length}`}
            addDialog={<RecordDialog title="Add Labor Record" fields={fieldConfigs.labor} onSave={(data) => addRecord("labor_records", data)} trigger={<Button size="sm" className="h-8"><Plus className="h-4 w-4 mr-1" /> New Labor</Button>} />}
          >
            <div className="rounded-md border">
              <Table>
                <TableHeader className="bg-muted/30">
                   <TableRow>
                     <TableHead className="w-[180px]">Task</TableHead>
                     <TableHead>Workers</TableHead>
                     <TableHead>Days</TableHead>
                     <TableHead>Cost/Day</TableHead>
                     <TableHead>Total</TableHead>
                     <TableHead className="text-right">Action</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {laborRecords.map((r: any) => (
                     <TableRow key={r.id} className="hover:bg-muted/20 transition-colors">
                       <TableCell className="font-medium p-3">
                         <div>{r.task_description}</div>
                       </TableCell>
                       <TableCell className="p-3">{r.worker_count}</TableCell>
                       <TableCell className="p-3">{r.days_worked}</TableCell>
                       <TableCell className="p-3">{formatCurrency(r.cost_per_day || 0)}</TableCell>
                       <TableCell className="p-3 font-semibold">{formatCurrency((r.worker_count || 0) * (r.days_worked || 0) * (r.cost_per_day || 0))}</TableCell>
                      <TableCell className="text-right p-3">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteRecord("labor_records", r.id)}>
                          <Trash2 className="h-4 w-4 text-destructive/70" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {laborRecords.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No labor records yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            <div className="px-4 py-3 border-t bg-muted/20 text-sm font-semibold flex justify-between">
              <span>Total Labor Cost</span>
              <span>{formatCurrency(totals.totalLaborCost)}</span>
            </div>
          </SectionCard>
        </TabsContent>

        {/* ===== HARVEST TAB ===== */}
        <TabsContent value="harvest" className="space-y-4">
          <SectionCard title="Harvest Records" badge={`${harvestRecords.length}`}
            addDialog={<RecordDialog title="Add Harvest Record" fields={fieldConfigs.harvest} onSave={(data) => addRecord("harvest_records", data)} trigger={<Button size="sm" className="h-8"><Plus className="h-4 w-4 mr-1" /> New Harvest</Button>} />}
          >
            <div className="rounded-md border">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-[180px]">Crop</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {harvestRecords.map((r: any) => (
                    <TableRow key={r.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="font-medium p-3">{r.crop_name}</TableCell>
                      <TableCell className="p-3">{r.quantity} {r.unit}</TableCell>
                      <TableCell className="p-3"><Badge variant="outline" className="text-[10px]">{r.quality_grade || "N/A"}</Badge></TableCell>
                      <TableCell className="p-3 text-muted-foreground text-xs">{r.harvest_date || "N/A"}</TableCell>
                      <TableCell className="text-right p-3">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteRecord("harvest_records", r.id)}>
                          <Trash2 className="h-4 w-4 text-destructive/70" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {harvestRecords.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No harvest records yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            <div className="px-4 py-3 border-t bg-muted/20 text-sm font-semibold flex justify-between">
              <span>Total Harvest Quantity</span>
              <span>{totals.totalHarvestQty.toLocaleString()} units</span>
            </div>
          </SectionCard>
        </TabsContent>

        {/* ===== LOSS TAB ===== */}
        <TabsContent value="loss" className="space-y-4">
          <SectionCard title="Loss / Damage Records" badge={`${harvestLosses.length}`}
            addDialog={<RecordDialog title="Add Loss Record" fields={fieldConfigs.loss} onSave={(data) => addRecord("harvest_losses", data)} trigger={<Button size="sm" className="h-8"><Plus className="h-4 w-4 mr-1" /> Record Loss</Button>} />}
          >
            <div className="rounded-md border">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                     <TableHead className="w-[200px]">Crop</TableHead>
                     <TableHead>Reason</TableHead>
                     <TableHead>Qty Lost</TableHead>
                     <TableHead className="text-right">Action</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {harvestLosses.map((r: any) => (
                     <TableRow key={r.id} className="hover:bg-muted/20 transition-colors">
                       <TableCell className="font-medium p-3">{r.crop_name}</TableCell>
                       <TableCell className="p-3"><Badge variant="destructive" className="text-[10px]">{r.loss_reason || "Unknown"}</Badge></TableCell>
                       <TableCell className="p-3">{r.quantity_lost} {r.unit}</TableCell>
                      <TableCell className="text-right p-3">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteRecord("harvest_losses", r.id)}>
                          <Trash2 className="h-4 w-4 text-destructive/70" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {harvestLosses.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No loss records yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            <div className="px-4 py-3 border-t bg-destructive/10 text-sm font-semibold flex justify-between">
              <span>Total Quantity Lost</span>
              <span className="text-destructive">{totals.totalLossQty.toLocaleString()} units</span>
            </div>
          </SectionCard>
        </TabsContent>

        {/* ===== SALES TAB ===== */}
        <TabsContent value="sales" className="space-y-4">
          <SectionCard title="Sales Records" badge={`${salesRecords.length}`}
            addDialog={<RecordDialog title="Add Sale Record" fields={fieldConfigs.sales} onSave={(data) => addRecord("sales_records", data)} trigger={<Button size="sm" className="h-8"><Plus className="h-4 w-4 mr-1" /> New Sale</Button>} />}
          >
            <div className="rounded-md border">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-[180px]">Product</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesRecords.map((r: any) => (
                    <TableRow key={r.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="font-medium p-3">{r.crop_name}</TableCell>
                      <TableCell className="p-3">{r.quantity_sold} {r.unit}</TableCell>
                      <TableCell className="p-3">{formatCurrency(r.price_per_unit || 0)}</TableCell>
                      <TableCell className="p-3 font-semibold text-emerald-600">{formatCurrency((r.quantity_sold || 0) * (r.price_per_unit || 0))}</TableCell>
                      <TableCell className="p-3 text-muted-foreground text-xs">{r.buyer_name || "N/A"}</TableCell>
                      <TableCell className="text-right p-3">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteRecord("sales_records", r.id)}>
                          <Trash2 className="h-4 w-4 text-destructive/70" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {salesRecords.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No sales records yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            <div className="px-4 py-3 border-t bg-emerald-50/50 text-sm font-semibold flex justify-between">
              <span>Total Revenue</span>
              <span className="text-emerald-600">{formatCurrency(totals.totalRevenue)}</span>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>

      {/* Season Profit/Loss Summary */}
      <Card className={`border-2 ${displayMetrics.netProfit >= 0 ? "border-emerald-200 bg-emerald-50/30" : "border-destructive/30 bg-destructive/5"}`}>
        <CardContent className="pt-5 pb-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Expenses</p>
              <p className="text-lg font-bold mt-1">{formatCurrency(displayMetrics.totalExpenses)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Losses</p>
              <p className="text-lg font-bold mt-1 text-destructive">{displayMetrics.totalLosses.toLocaleString()} units</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Revenue</p>
              <p className="text-lg font-bold mt-1 text-emerald-600">{formatCurrency(displayMetrics.totalRevenue)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Harvest Qty</p>
              <p className="text-lg font-bold mt-1">{displayMetrics.totalHarvestQty.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold">{displayMetrics.netProfit >= 0 ? "🟢 Net Profit" : "🔴 Net Loss"}</p>
              <p className={`text-xl font-black mt-1 ${displayMetrics.netProfit >= 0 ? "text-emerald-700" : "text-destructive"}`}>{formatCurrency(displayMetrics.netProfit)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Sub-components
function MetricCard({ icon: Icon, label, value, color, bg }: { icon: any; label: string; value: string; color: string; bg: string }) {
  return (
    <Card className={`${bg} border-0 shadow-none`}>
      <CardContent className="p-4 text-center">
        <Icon className={`h-4 w-4 mx-auto ${color} opacity-80`} />
        <p className="text-base font-bold mt-2 tracking-tight">{value}</p>
        <p className="text-[9px] uppercase tracking-wider font-medium text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

function SectionCard({ title, badge, addDialog, children }: { title: string; badge: string; addDialog: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="shadow-sm border-border/60">
      <CardHeader className="py-4 px-4 flex-row items-center justify-between space-y-0 border-b">
        <div className="flex items-center gap-3">
          <CardTitle className="text-sm font-bold uppercase tracking-tight">{title}</CardTitle>
          <Badge variant="outline" className="text-[10px] rounded-full px-2">{badge}</Badge>
        </div>
        {addDialog}
      </CardHeader>
      <CardContent className="p-0">
        {children}
      </CardContent>
    </Card>
  );
}
