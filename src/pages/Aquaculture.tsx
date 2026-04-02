import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Fish, Plus, Thermometer, Droplets, Wind, Clock, BookOpen, Bug, Wheat, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Pond {
  id: string;
  name: string;
  species: string;
  stock_count: number;
  pond_size_sqm: number | null;
  water_temp: number | null;
  ph_level: number | null;
  dissolved_oxygen: number | null;
  last_feeding: string | null;
  feeding_schedule: string;
  notes: string | null;
}

interface GuideSection {
  title: string;
  content: string;
}

interface SpeciesGuide {
  name: string;
  icon: string;
  overview: string;
  sections: GuideSection[];
}

const speciesGuides: SpeciesGuide[] = [
  {
    name: "Tilapia",
    icon: "🐟",
    overview: "Most farmed fish in Africa. Hardy, fast-growing, tolerates a wide range of conditions.",
    sections: [
      { title: "Pond Setup", content: "Pond size: Minimum 200m² for commercial production. Depth: 1–1.5m. Stock at 3–5 fish per m². Fertilize pond 2 weeks before stocking to grow natural food (plankton). Inlet and outlet pipes for water management." },
      { title: "Water Quality", content: "Temperature: 25–30°C (optimal), survives 12–42°C. pH: 6.5–8.5. Dissolved oxygen: Above 3mg/L (critical below 1mg/L). Ammonia: Below 0.5mg/L. Water change: 10–20% weekly or when water turns dark green." },
      { title: "Feeding", content: "Feed 2–3 times daily. Fingerlings: 5–10% body weight/day with high-protein feed (35–40%). Growers: 3–5% body weight/day with 28–32% protein. Adults: 2–3% body weight/day. Stop feeding if fish are not eating within 15 minutes. Use floating pellets to monitor consumption." },
      { title: "Growth & Harvest", content: "Reaches market size (250–500g) in 6–8 months. Harvest at dawn when water is cool. Use seine nets, drain partially for easier harvesting. Sort by size — sell larger fish first. Sell fresh at farmgate or local market within hours of harvest." },
      { title: "Common Diseases", content: "Streptococcosis: Erratic swimming, eye cloudiness. Treat with antibiotics in feed. Columnaris: White patches on skin/gills. Improve water quality, reduce stocking density. Ich (White Spot): White dots on body. Raise temperature to 30°C, add salt (5g/L). Prevention: Maintain clean water, avoid overstocking, quarantine new fish for 2 weeks." },
    ],
  },
  {
    name: "Catfish (Clarias)",
    icon: "🐱",
    overview: "Most commercially farmed fish in West Africa. Air-breathing, tolerates poor water quality, very fast growth.",
    sections: [
      { title: "Pond Setup", content: "Concrete tanks, earthen ponds, or tarpaulin ponds all work. Size: 3m×4m tank can hold 500–1000 fingerlings. Depth: 1–1.2m. Drainage must be easy — catfish ponds need regular cleaning. Cover ponds to prevent jumping (catfish are escape artists)." },
      { title: "Water Quality", content: "Temperature: 26–32°C optimal. pH: 6.5–8.0. Catfish breathe air, so low oxygen is less deadly but still stressful. Change water every 2–3 days in concrete tanks, weekly in earthen ponds. Ammonia buildup is the #1 killer — clean uneaten feed daily." },
      { title: "Feeding", content: "Fingerlings (1–4 weeks): Feed 4 times daily, 10% body weight. Use powdered or crushed pellets. Juveniles (1–3 months): Feed 3 times daily, 5% body weight. 40–42% protein pellets. Table size (3–6 months): Feed twice daily, 3% body weight. 35% protein. Local feed alternatives: Maggot farming, duckweed, soybean meal + fish meal mix." },
      { title: "Growth & Harvest", content: "Reaches 1kg in 5–7 months with good feeding. Harvest by draining pond partially. Sort by size — uniform sizes sell better. Smoke, dry, or sell fresh. Smoked catfish has 3–5× the value of fresh and stores for weeks." },
      { title: "Common Diseases", content: "Bacterial infections: Red sores, fin rot. Treat with salt bath (10g/L for 10 min). Fungal infections: Cotton-like growth. Improve water quality, reduce density. Parasites: Anchor worm, leeches. Manual removal + salt treatment. Prevention: Don't overcrowd, feed quality feed, change water regularly, treat incoming water with lime." },
    ],
  },
  {
    name: "African Carp (Labeo)",
    icon: "🐠",
    overview: "Native to African rivers. Good for polyculture with tilapia. Feeds on bottom detritus and algae.",
    sections: [
      { title: "Pond Setup", content: "Best in earthen ponds with natural bottom. Stock at 1–2 fish per m². Ideal for polyculture: stock with tilapia (carp cleans bottom while tilapia feeds at surface). Pond depth: 1–1.5m." },
      { title: "Water & Feeding", content: "Temperature: 22–28°C. Feeds naturally on algae, detritus, and organic matter on pond bottom. Supplement with rice bran, wheat bran, or cassava peel. Fertilize pond regularly to promote natural food growth." },
      { title: "Growth & Harvest", content: "Slower growth than tilapia/catfish — 12–18 months to market size. Harvested with seine nets. Popular in local markets of Central and West Africa." },
    ],
  },
  {
    name: "Shrimp (Freshwater Prawns)",
    icon: "🦐",
    overview: "High-value product with growing demand. Macrobrachium rosenbergii (giant river prawn) is most farmed.",
    sections: [
      { title: "Pond Requirements", content: "Earthen ponds, 0.1–0.5 hectares. Depth: 0.8–1.2m. Stock at 5–10 per m². Must have shelters (bamboo bundles, PVC pipes) — prawns are territorial and cannibalistic. Good water inlet/outlet essential." },
      { title: "Water Quality", content: "Temperature: 26–32°C. pH: 7.0–8.5. Dissolved oxygen: Above 4mg/L (prawns are more sensitive than fish). Salinity: Freshwater to slightly brackish. Ammonia: Below 0.1mg/L." },
      { title: "Feeding & Growth", content: "Feed with commercial prawn pellets or locally made feed (fish meal + soybean + cassava). Feed 3–5% body weight, twice daily. Reaches market size in 5–8 months. Harvest with traps or by draining — handle carefully to avoid damage." },
    ],
  },
  {
    name: "Heterotis (African Arowana)",
    icon: "🐟",
    overview: "Large freshwater fish native to West Africa. Can reach 1m and 10kg. Excellent for extensive pond culture.",
    sections: [
      { title: "Culture", content: "Best in large earthen ponds (0.5+ hectares). Stock at 0.5–1 per m². Feeds on zooplankton, insects, and organic matter. Supplement with termites, maggots, or rice bran. Reaches 2–5kg in 12–18 months." },
      { title: "Management", content: "Hardy species tolerant of poor conditions. Breeds naturally in ponds if given nesting space. Protect from predatory birds with netting. Good for polyculture with tilapia and carp." },
    ],
  },
];

const generalGuides = [
  {
    title: "Pond Construction & Types",
    icon: Droplets,
    content: "Earthen Ponds: Most common in Africa. Dig 1–1.5m deep, compact clay bottom to prevent seepage. Build dykes 0.5m above water level. Cost: $200–500 for 200m².\n\nConcrete Tanks: Best for catfish in urban areas. 3m×4m×1.2m tank costs $300–800. Easy to clean and manage. Requires pumped water.\n\nTarpaulin Ponds: Affordable starter option. Iron/wooden frame lined with reinforced tarpaulin. 3m×3m costs $50–150. Lasts 2–5 years with care.\n\nCage Culture: For rivers/lakes. Floating net cages stocked with fingerlings. Low construction cost but requires flowing water.",
  },
  {
    title: "Water Quality Management",
    icon: Thermometer,
    content: "The 5 Critical Parameters:\n\n1. Temperature: Affects feeding rate, growth, and disease. Shade ponds if above 32°C.\n\n2. pH: Test weekly. If below 6.5, add agricultural lime (200kg/ha). If above 9, add fresh water.\n\n3. Dissolved Oxygen: Below 3mg/L causes stress. Below 1mg/L causes death. Signs of low oxygen: fish gasping at surface at dawn. Solutions: aeration, water exchange, reduce feeding.\n\n4. Ammonia: From fish waste and uneaten feed. Toxic above 0.5mg/L. Solution: regular water change, remove uneaten feed, don't overstock.\n\n5. Turbidity: Green water (algae) is good — provides natural food. Brown/muddy water blocks light. Clear water means no natural food — fertilize pond.",
  },
  {
    title: "Feed Management & Local Alternatives",
    icon: Wheat,
    content: "Commercial Feed: Most reliable but expensive. Buy 35–42% protein pellets for catfish, 28–35% for tilapia.\n\nLocal Feed Formulation:\n• Fish meal (25%) + Soybean meal (30%) + Maize/wheat bran (35%) + Vitamins/minerals (5%) + Palm oil (5%)\n• Mix, pelletize, and sun-dry. Costs 40–60% less than commercial feed.\n\nLive Feed (for fingerlings):\n• Maggot farming: Expose animal offal to flies in a ventilated container. Harvest larvae in 3–5 days.\n• Duckweed: Grows on pond surface. High protein (35–45%). Free natural feed.\n• Termites: Collect from mounds. Excellent protein source.\n\nFeeding Rules:\n• Feed at the same times daily\n• Don't feed more than fish eat in 15 minutes\n• Reduce feeding in cold/cloudy weather\n• Stop feeding 24 hours before harvest",
  },
  {
    title: "Disease Prevention & Biosecurity",
    icon: ShieldCheck,
    content: "Prevention is 10× cheaper than treatment:\n\n1. Quarantine: Isolate new fish for 14 days before adding to main pond.\n2. Stock Quality: Buy fingerlings only from certified hatcheries.\n3. Stocking Density: Overstocking is the #1 cause of disease. Follow species-specific guidelines.\n4. Water Quality: Most diseases occur when water quality deteriorates. Test weekly.\n5. Hygiene: Disinfect nets, containers, and hands between ponds. Footbath with lime at pond entrance.\n\nCommon Signs of Sick Fish:\n• Loss of appetite or erratic swimming\n• Spots, sores, or cotton-like growths\n• Gasping at water surface\n• Darkened color or swollen belly\n• Mass mortality (more than 1% per day)\n\nEmergency Response:\n• Stop feeding immediately\n• Increase water exchange\n• Add salt (5–10g/L) as general treatment\n• Isolate affected pond\n• Consult aquaculture extension officer",
  },
  {
    title: "Economics & Business Planning",
    icon: Bug,
    content: "Starting Cost Estimates (500 catfish cycle):\n• Pond construction: $100–800 (tarpaulin vs concrete)\n• Fingerlings (500): $25–50\n• Feed (6 months): $200–400\n• Water/electricity: $30–60\n• Total: $355–1,310\n\nExpected Revenue:\n• 500 catfish × 80% survival = 400 fish\n• Average weight: 1kg × 400 = 400kg\n• Price: $2–4/kg = $800–1,600\n• Net profit: $290–1,245 per cycle\n\nTips for Profitability:\n• Produce your own fingerlings after first cycle\n• Make local feed to reduce costs by 40%\n• Smoke or process fish for 3–5× value\n• Sell directly to restaurants and hotels\n• Time harvests for festive periods (Christmas, Easter, Ramadan) when prices peak\n• Keep accurate records of every cost and sale",
  },
];

export default function Aquaculture() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", species: "Tilapia", stock_count: "", pond_size_sqm: "" });
  const [expandedGuide, setExpandedGuide] = useState<string | null>(null);
  const [expandedSpecies, setExpandedSpecies] = useState<string | null>(null);

  const fetchPonds = async () => {
    if (!user) return;
    const { data } = await supabase.from("fish_ponds").select("*").order("created_at", { ascending: false });
    setPonds((data as Pond[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchPonds(); }, [user]);

  const addPond = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("fish_ponds").insert({
      user_id: user.id, name: form.name, species: form.species,
      stock_count: parseInt(form.stock_count) || 0,
      pond_size_sqm: parseFloat(form.pond_size_sqm) || null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Pond added!" });
      setDialogOpen(false);
      setForm({ name: "", species: "Tilapia", stock_count: "", pond_size_sqm: "" });
      fetchPonds();
    }
  };

  const logFeeding = async (pondId: string) => {
    await supabase.from("fish_ponds").update({ last_feeding: new Date().toISOString() }).eq("id", pondId);
    toast({ title: "Feeding logged!" });
    fetchPonds();
  };

  const updateWaterQuality = async (pondId: string, field: string, value: string) => {
    await supabase.from("fish_ponds").update({ [field]: parseFloat(value) }).eq("id", pondId);
    fetchPonds();
  };

  const getPhStatus = (ph: number | null) => {
    if (!ph) return { text: "Not recorded", color: "text-muted-foreground" };
    if (ph >= 6.5 && ph <= 8.5) return { text: "Optimal", color: "text-primary" };
    if (ph >= 6 && ph <= 9) return { text: "Acceptable", color: "text-accent-foreground" };
    return { text: "Critical", color: "text-destructive" };
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Fish className="h-6 w-6 text-primary" /> Aquaculture
          </h1>
          <p className="text-sm text-muted-foreground">Fish farming management & knowledge hub</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Add Pond</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Pond</DialogTitle></DialogHeader>
            <form onSubmit={addPond} className="space-y-3">
              <Input placeholder="Pond name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <Select value={form.species} onValueChange={(v) => setForm({ ...form, species: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {speciesGuides.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Stock count" type="number" value={form.stock_count} onChange={(e) => setForm({ ...form, stock_count: e.target.value })} />
              <Input placeholder="Pond size (m²)" type="number" value={form.pond_size_sqm} onChange={(e) => setForm({ ...form, pond_size_sqm: e.target.value })} />
              <Button type="submit" className="w-full">Add Pond</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="ponds" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="ponds">My Ponds</TabsTrigger>
          <TabsTrigger value="species">Species Guides</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
        </TabsList>

        {/* MY PONDS TAB */}
        <TabsContent value="ponds">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : ponds.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Fish className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="font-semibold mb-1">No ponds yet</p>
                <p className="text-sm text-muted-foreground mb-4">Add your first fish pond to start monitoring</p>
                <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Pond</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ponds.map((pond) => {
                const phStatus = getPhStatus(pond.ph_level);
                return (
                  <Card key={pond.id}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span>{pond.name}</span>
                        <span className="text-xs font-normal bg-primary/10 text-primary px-2 py-1 rounded-full">{pond.species}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2"><Fish className="h-4 w-4 text-muted-foreground" /><span>{pond.stock_count} fish</span></div>
                        <div className="flex items-center gap-2"><Thermometer className="h-4 w-4 text-muted-foreground" /><span>{pond.water_temp ?? "—"}°C</span></div>
                        <div className="flex items-center gap-2"><Droplets className="h-4 w-4 text-muted-foreground" /><span className={phStatus.color}>pH: {pond.ph_level ?? "—"}</span></div>
                        <div className="flex items-center gap-2"><Wind className="h-4 w-4 text-muted-foreground" /><span>O₂: {pond.dissolved_oxygen ?? "—"} mg/L</span></div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{pond.last_feeding ? `Fed ${new Date(pond.last_feeding).toLocaleString()}` : "Not fed yet"}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => logFeeding(pond.id)}>Log Feeding</Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="secondary" className="flex-1 text-xs">Update Water</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Update Water Quality - {pond.name}</DialogTitle></DialogHeader>
                            <div className="space-y-3">
                              <div><label className="text-sm font-medium">Temperature (°C)</label><Input type="number" step="0.1" defaultValue={pond.water_temp ?? ""} onBlur={(e) => updateWaterQuality(pond.id, "water_temp", e.target.value)} /></div>
                              <div><label className="text-sm font-medium">pH Level</label><Input type="number" step="0.1" defaultValue={pond.ph_level ?? ""} onBlur={(e) => updateWaterQuality(pond.id, "ph_level", e.target.value)} /></div>
                              <div><label className="text-sm font-medium">Dissolved Oxygen (mg/L)</label><Input type="number" step="0.1" defaultValue={pond.dissolved_oxygen ?? ""} onBlur={(e) => updateWaterQuality(pond.id, "dissolved_oxygen", e.target.value)} /></div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* SPECIES GUIDES TAB */}
        <TabsContent value="species">
          <div className="space-y-3">
            {speciesGuides.map((species) => {
              const isExpanded = expandedSpecies === species.name;
              return (
                <Card key={species.name}>
                  <button onClick={() => setExpandedSpecies(isExpanded ? null : species.name)} className="w-full text-left">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{species.icon}</span>
                          <div>
                            <CardTitle className="text-base">{species.name}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">{species.overview}</p>
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </CardHeader>
                  </button>
                  {isExpanded && (
                    <CardContent className="pt-0 space-y-3">
                      {species.sections.map((section, idx) => (
                        <div key={idx} className="bg-muted/50 rounded-lg p-4">
                          <h4 className="text-sm font-semibold mb-2">{section.title}</h4>
                          <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{section.content}</p>
                        </div>
                      ))}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* KNOWLEDGE BASE TAB */}
        <TabsContent value="knowledge">
          <div className="space-y-3">
            {generalGuides.map((guide) => {
              const isExpanded = expandedGuide === guide.title;
              const GuideIcon = guide.icon;
              return (
                <Card key={guide.title}>
                  <button onClick={() => setExpandedGuide(isExpanded ? null : guide.title)} className="w-full text-left">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                            <GuideIcon className="h-4 w-4 text-primary" />
                          </div>
                          <CardTitle className="text-base">{guide.title}</CardTitle>
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </CardHeader>
                  </button>
                  {isExpanded && (
                    <CardContent className="pt-0">
                      <div className="bg-muted/50 rounded-lg p-4">
                        <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{guide.content}</p>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
