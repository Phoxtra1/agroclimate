import { useState } from "react";
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
import { Plus, Trash2, Edit2, Package, Users, MapPin, Wheat, TrendingDown, DollarSign, TrendingUp, Loader2, Bot, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";

function formatCurrency(amount: number) {
  const isGhana = Intl.DateTimeFormat().resolvedOptions().timeZone.includes("Accra");
  const currency = isGhana ? "GHS" : "USD";
  const locale = isGhana ? "en-GH" : "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2 }).format(amount);
}

// Generic Add/Edit Dialog
function RecordDialog({ title, fields, onSave, trigger, initialData }: {
  title: string;
  fields: { name: string; label: string; type?: string; required?: boolean; placeholder?: string }[];
  onSave: (data: any) => void;
  trigger: React.ReactNode;
  initialData?: any;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(initialData || {});

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && initialData) setForm({ ...initialData });
    if (!isOpen) setForm(initialData || {});
  };

  const handleSave = () => {
    onSave(form);
    setForm(initialData || {});
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          {fields.map((f) => (
            <div key={f.name}>
              <Label className="text-xs">{f.label}{f.required && " *"}</Label>
              <Input
                type={f.type || "text"}
                placeholder={f.placeholder || f.label}
                value={form[f.name] ?? ""}
                onChange={(e) => setForm({ ...form, [f.name]: f.type === "number" ? Number(e.target.value) : e.target.value })}
              />
            </div>
          ))}
          <Button onClick={handleSave} className="w-full">Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AgroInventory() {
  const [filterSeason, setFilterSeason] = useState<string>();
  const [filterCrop, setFilterCrop] = useState<string>();
  const [filterPlot, setFilterPlot] = useState<string>();

  const {
    inventoryItems, laborRecords, landCosts, harvestRecords, harvestLosses, salesRecords,
    metrics, loading, addRecord, updateRecord, deleteRecord, seasons, crops, plots,
  } = useInventory(filterSeason, filterCrop, filterPlot);

  const inputFields = [
    { name: "item_name", label: "Item Name", required: true, placeholder: "e.g. NPK Fertilizer" },
    { name: "item_type", label: "Type", required: true, placeholder: "e.g. Fertilizer, Seeds, Chemical" },
    { name: "quantity", label: "Quantity", type: "number", required: true },
    { name: "unit", label: "Unit", placeholder: "kg, liters, bags, bottles" },
    { name: "price_per_unit", label: "Price per Unit", type: "number", required: true },
    { name: "crop_name", label: "Crop/Linked To", placeholder: "e.g. Maize" },
    { name: "season", label: "Season", placeholder: "e.g. 2026 Major" },
    { name: "farm_plot", label: "Farm Plot", placeholder: "e.g. Plot A" },
    { name: "notes", label: "Notes" },
  ];

  const laborFields = [
    { name: "task_description", label: "Task", required: true, placeholder: "e.g. Weeding" },
    { name: "worker_count", label: "Workers", type: "number", required: true },
    { name: "days_worked", label: "Days Worked", type: "number", required: true },
    { name: "cost_per_day", label: "Cost per Day", type: "number", required: true },
    { name: "crop_name", label: "Crop", placeholder: "e.g. Maize" },
    { name: "season", label: "Season" },
    { name: "farm_plot", label: "Farm Plot" },
    { name: "notes", label: "Notes" },
  ];

  const landFields = [
    { name: "land_description", label: "Description", required: true, placeholder: "e.g. Farmland at Kumasi" },
    { name: "size_acres", label: "Size (Acres)", type: "number", required: true },
    { name: "cost_type", label: "Cost Type", placeholder: "rent or purchase" },
    { name: "cost_amount", label: "Cost", type: "number", required: true },
    { name: "season", label: "Season" },
    { name: "farm_plot", label: "Farm Plot" },
    { name: "notes", label: "Notes" },
  ];

  const harvestFields = [
    { name: "crop_name", label: "Crop", required: true, placeholder: "e.g. Maize" },
    { name: "quantity", label: "Quantity", type: "number", required: true },
    { name: "unit", label: "Unit", placeholder: "kg, bags, crates" },
    { name: "quality_grade", label: "Quality Grade", placeholder: "e.g. Grade A" },
    { name: "season", label: "Season" },
    { name: "farm_plot", label: "Farm Plot" },
    { name: "harvest_date", label: "Harvest Date", type: "date" },
    { name: "notes", label: "Notes" },
  ];

  const lossFields = [
    { name: "crop_name", label: "Crop", required: true },
    { name: "quantity_lost", label: "Quantity Lost", type: "number", required: true },
    { name: "unit", label: "Unit", placeholder: "kg" },
    { name: "loss_reason", label: "Reason", required: true, placeholder: "spoilage, pests, storage, theft" },
    { name: "season", label: "Season" },
    { name: "farm_plot", label: "Farm Plot" },
    { name: "notes", label: "Notes" },
  ];

  const salesFields = [
    { name: "crop_name", label: "Crop", required: true },
    { name: "quantity_sold", label: "Quantity Sold", type: "number", required: true },
    { name: "unit", label: "Unit", placeholder: "kg, bags" },
    { name: "price_per_unit", label: "Price per Unit", type: "number", required: true },
    { name: "buyer_name", label: "Buyer Name" },
    { name: "season", label: "Season" },
    { name: "farm_plot", label: "Farm Plot" },
    { name: "sale_date", label: "Sale Date", type: "date" },
    { name: "notes", label: "Notes" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">📦 Agro Inventory</h1>
          <p className="text-sm text-muted-foreground">Track inputs, harvest, sales, costs & profits</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterSeason || "all"} onValueChange={(v) => setFilterSeason(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Seasons" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Seasons</SelectItem>
            {seasons.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCrop || "all"} onValueChange={(v) => setFilterCrop(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Crops" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Crops</SelectItem>
            {crops.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPlot || "all"} onValueChange={(v) => setFilterPlot(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Plots" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plots</SelectItem>
            {plots.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <MetricCard icon={Package} label="Total Inputs" value={formatCurrency(metrics.totalInputsCost)} color="text-blue-600" bg="bg-blue-50 dark:bg-blue-950/30" />
        <MetricCard icon={Users} label="Labor Costs" value={formatCurrency(metrics.totalLaborCost)} color="text-blue-600" bg="bg-blue-50 dark:bg-blue-950/30" />
        <MetricCard icon={MapPin} label="Land Cost" value={formatCurrency(metrics.totalLandCost)} color="text-blue-600" bg="bg-blue-50 dark:bg-blue-950/30" />
        <MetricCard icon={Wheat} label="Total Harvest" value={`${metrics.totalHarvestQty.toLocaleString()} units`} color="text-primary" bg="bg-primary/10" />
        <MetricCard icon={TrendingDown} label="Total Losses" value={`${metrics.totalLosses.toLocaleString()} units`} color="text-destructive" bg="bg-destructive/10" />
        <MetricCard icon={DollarSign} label="Total Revenue" value={formatCurrency(metrics.totalRevenue)} color="text-amber-600" bg="bg-amber-50 dark:bg-amber-950/30" />
        <MetricCard icon={TrendingUp} label="Net Profit" value={formatCurrency(metrics.netProfit)} color={metrics.netProfit >= 0 ? "text-amber-600" : "text-destructive"} bg={metrics.netProfit >= 0 ? "bg-amber-50 dark:bg-amber-950/30" : "bg-destructive/10"} />
      </div>

      {/* AI Strategic Advice with Odeneho CTA */}
      <Card className="border-dashed border-primary/40">
        <CardContent className="pt-4 flex items-center gap-3">
          <Bot className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">AI Strategic Advice</p>
            <p className="text-xs text-muted-foreground">Get fertilizer usage optimization, crop rotation suggestions, and labor cost analysis from Odeneho AI.</p>
          </div>
          <Link to="/odeneho">
            <Button size="sm" variant="default" className="shrink-0">
              <MessageSquare className="h-4 w-4 mr-1" /> Ask Odeneho
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Tabs for each section */}
      <Tabs defaultValue="inputs" className="space-y-4">
        <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full">
          <TabsTrigger value="inputs">Inputs</TabsTrigger>
          <TabsTrigger value="labor">Labor</TabsTrigger>
          <TabsTrigger value="land">Land</TabsTrigger>
          <TabsTrigger value="harvest">Harvest</TabsTrigger>
          <TabsTrigger value="losses">Losses</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
        </TabsList>

        {/* INPUTS */}
        <TabsContent value="inputs">
          <SectionCard title="Production Inputs" badge={`${inventoryItems.length} records`}
            addDialog={<RecordDialog title="Add Input" fields={inputFields} onSave={(data) => addRecord("inventory_items", data)} trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Input</Button>} />}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead><TableHead>Type</TableHead><TableHead>Qty</TableHead><TableHead>Unit Price</TableHead><TableHead>Total</TableHead><TableHead>Crop</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventoryItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.item_name}</TableCell>
                    <TableCell><Badge variant="outline">{item.item_type}</Badge></TableCell>
                    <TableCell>{item.quantity} {item.unit}</TableCell>
                    <TableCell>{formatCurrency(item.price_per_unit)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(item.quantity * item.price_per_unit)}</TableCell>
                    <TableCell>{item.crop_name || "—"}</TableCell>
                    <TableCell className="flex gap-1">
                      <RecordDialog title="Edit Input" fields={inputFields} initialData={item}
                        onSave={(data) => updateRecord("inventory_items", item.id, data)}
                        trigger={<Button variant="ghost" size="icon"><Edit2 className="h-4 w-4" /></Button>} />
                      <Button variant="ghost" size="icon" onClick={() => deleteRecord("inventory_items", item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {inventoryItems.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No inputs recorded yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        {/* LABOR */}
        <TabsContent value="labor">
          <SectionCard title="Labor Records" badge={`${laborRecords.length} records`}
            addDialog={<RecordDialog title="Add Labor Record" fields={laborFields} onSave={(data) => addRecord("labor_records", data)} trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Labor</Button>} />}
          >
            <Table>
              <TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Workers</TableHead><TableHead>Days</TableHead><TableHead>Rate/Day</TableHead><TableHead>Total</TableHead><TableHead>Crop</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {laborRecords.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell className="font-medium">{rec.task_description}</TableCell>
                    <TableCell>{rec.worker_count}</TableCell>
                    <TableCell>{rec.days_worked}</TableCell>
                    <TableCell>{formatCurrency(rec.cost_per_day)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(rec.worker_count * rec.days_worked * rec.cost_per_day)}</TableCell>
                    <TableCell>{rec.crop_name || "—"}</TableCell>
                    <TableCell className="flex gap-1">
                      <RecordDialog title="Edit Labor" fields={laborFields} initialData={rec}
                        onSave={(data) => updateRecord("labor_records", rec.id, data)}
                        trigger={<Button variant="ghost" size="icon"><Edit2 className="h-4 w-4" /></Button>} />
                      <Button variant="ghost" size="icon" onClick={() => deleteRecord("labor_records", rec.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {laborRecords.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No labor records yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        {/* LAND */}
        <TabsContent value="land">
          <SectionCard title="Land Costs" badge={`${landCosts.length} records`}
            addDialog={<RecordDialog title="Add Land Cost" fields={landFields} onSave={(data) => addRecord("land_costs", data)} trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Land</Button>} />}
          >
            <Table>
              <TableHeader><TableRow><TableHead>Description</TableHead><TableHead>Size (Acres)</TableHead><TableHead>Type</TableHead><TableHead>Cost</TableHead><TableHead>Season</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {landCosts.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell className="font-medium">{rec.land_description}</TableCell>
                    <TableCell>{rec.size_acres}</TableCell>
                    <TableCell><Badge variant="outline">{rec.cost_type}</Badge></TableCell>
                    <TableCell className="font-medium">{formatCurrency(rec.cost_amount)}</TableCell>
                    <TableCell>{rec.season || "—"}</TableCell>
                    <TableCell className="flex gap-1">
                      <RecordDialog title="Edit Land Cost" fields={landFields} initialData={rec}
                        onSave={(data) => updateRecord("land_costs", rec.id, data)}
                        trigger={<Button variant="ghost" size="icon"><Edit2 className="h-4 w-4" /></Button>} />
                      <Button variant="ghost" size="icon" onClick={() => deleteRecord("land_costs", rec.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {landCosts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No land costs yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        {/* HARVEST */}
        <TabsContent value="harvest">
          <SectionCard title="Harvest Records" badge={`${harvestRecords.length} records`}
            addDialog={<RecordDialog title="Add Harvest" fields={harvestFields} onSave={(data) => addRecord("harvest_records", data)} trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Harvest</Button>} />}
          >
            <Table>
              <TableHeader><TableRow><TableHead>Crop</TableHead><TableHead>Quantity</TableHead><TableHead>Grade</TableHead><TableHead>Date</TableHead><TableHead>Plot</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {harvestRecords.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell className="font-medium">{rec.crop_name}</TableCell>
                    <TableCell>{rec.quantity} {rec.unit}</TableCell>
                    <TableCell>{rec.quality_grade || "—"}</TableCell>
                    <TableCell>{rec.harvest_date || "—"}</TableCell>
                    <TableCell>{rec.farm_plot || "—"}</TableCell>
                    <TableCell className="flex gap-1">
                      <RecordDialog title="Edit Harvest" fields={harvestFields} initialData={rec}
                        onSave={(data) => updateRecord("harvest_records", rec.id, data)}
                        trigger={<Button variant="ghost" size="icon"><Edit2 className="h-4 w-4" /></Button>} />
                      <Button variant="ghost" size="icon" onClick={() => deleteRecord("harvest_records", rec.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {harvestRecords.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No harvest records yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        {/* LOSSES */}
        <TabsContent value="losses">
          <SectionCard title="Harvest Losses" badge={`${harvestLosses.length} records`}
            addDialog={<RecordDialog title="Add Loss Record" fields={lossFields} onSave={(data) => addRecord("harvest_losses", data)} trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Loss</Button>} />}
          >
            <Table>
              <TableHeader><TableRow><TableHead>Crop</TableHead><TableHead>Qty Lost</TableHead><TableHead>Reason</TableHead><TableHead>Season</TableHead><TableHead>Plot</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {harvestLosses.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell className="font-medium">{rec.crop_name}</TableCell>
                    <TableCell className="text-destructive font-medium">{rec.quantity_lost} {rec.unit}</TableCell>
                    <TableCell><Badge variant="destructive" className="text-xs">{rec.loss_reason}</Badge></TableCell>
                    <TableCell>{rec.season || "—"}</TableCell>
                    <TableCell>{rec.farm_plot || "—"}</TableCell>
                    <TableCell className="flex gap-1">
                      <RecordDialog title="Edit Loss" fields={lossFields} initialData={rec}
                        onSave={(data) => updateRecord("harvest_losses", rec.id, data)}
                        trigger={<Button variant="ghost" size="icon"><Edit2 className="h-4 w-4" /></Button>} />
                      <Button variant="ghost" size="icon" onClick={() => deleteRecord("harvest_losses", rec.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {harvestLosses.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No losses recorded</TableCell></TableRow>}
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        {/* SALES */}
        <TabsContent value="sales">
          <SectionCard title="Sales / Revenue" badge={`${salesRecords.length} records`}
            addDialog={<RecordDialog title="Add Sale" fields={salesFields} onSave={(data) => addRecord("sales_records", data)} trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Sale</Button>} />}
          >
            <Table>
              <TableHeader><TableRow><TableHead>Crop</TableHead><TableHead>Qty Sold</TableHead><TableHead>Price/Unit</TableHead><TableHead>Total</TableHead><TableHead>Buyer</TableHead><TableHead>Date</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {salesRecords.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell className="font-medium">{rec.crop_name}</TableCell>
                    <TableCell>{rec.quantity_sold} {rec.unit}</TableCell>
                    <TableCell>{formatCurrency(rec.price_per_unit)}</TableCell>
                    <TableCell className="font-medium text-amber-600">{formatCurrency(rec.quantity_sold * rec.price_per_unit)}</TableCell>
                    <TableCell>{rec.buyer_name || "—"}</TableCell>
                    <TableCell>{rec.sale_date || "—"}</TableCell>
                    <TableCell className="flex gap-1">
                      <RecordDialog title="Edit Sale" fields={salesFields} initialData={rec}
                        onSave={(data) => updateRecord("sales_records", rec.id, data)}
                        trigger={<Button variant="ghost" size="icon"><Edit2 className="h-4 w-4" /></Button>} />
                      <Button variant="ghost" size="icon" onClick={() => deleteRecord("sales_records", rec.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {salesRecords.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No sales recorded yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color, bg }: { icon: any; label: string; value: string; color: string; bg: string }) {
  return (
    <Card className={`${bg} border-0`}>
      <CardContent className="p-3 text-center">
        <Icon className={`h-5 w-5 mx-auto ${color}`} />
        <p className="text-sm font-bold mt-1.5">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}

function SectionCard({ title, badge, addDialog, children }: { title: string; badge: string; addDialog: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="secondary" className="text-xs">{badge}</Badge>
        </div>
        {addDialog}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {children}
      </CardContent>
    </Card>
  );
}
