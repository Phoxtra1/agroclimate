import { useState } from "react";
import { BookOpen, Sprout, Bug, Droplets, Leaf, ShieldCheck, Wheat, ChevronRight, PlayCircle, Lightbulb, Bot } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";

interface LearningTopic {
  id: string;
  icon: React.ElementType;
  title: string;
  isNew?: boolean;
  sections: { title: string; content: string; image?: string }[];
}

const topics: LearningTopic[] = [
  {
    id: "explainer",
    icon: PlayCircle,
    title: "Explainer",
    isNew: true,
    sections: [
      {
        title: "Getting Started with AgroClimate",
        content: "Welcome to AgroClimate — your intelligent farming companion.\n\nAgroClimate helps you make better farming decisions using real-time weather data, AI-powered crop advisories, and environmental monitoring.\n\n🔑 Key Features:\n\n1️⃣ **Dashboard** — Your personalized farming hub with real-time weather, alerts, and crop recommendations based on your exact location.\n\n2️⃣ **Odeneho AI** — Your intelligent assistant. Ask anything about farming, weather, livestock, aquaculture, or food safety. Voice-enabled with West African accent support.\n\n3️⃣ **Weather & Forecast** — Live weather from Tomorrow.io with 7-day forecasts, irrigation advisories, and seasonal crop planning.\n\n4️⃣ **Alerts** — Smart notifications triggered by real weather conditions — heavy rain, extreme heat, high winds, disease risk. Mark as read or dismiss permanently.\n\n5️⃣ **Agro Inventory** — Track all farm inputs, labor, land costs, harvest, losses, and sales with real-time profit calculations.",
      },
      {
        title: "Using Odeneho AI Assistant",
        content: "Odeneho is your personal agricultural intelligence assistant.\n\n**How to use Odeneho:**\n\n📝 **Text**: Type your question in the chat box and press Send.\n\n🎙️ **Voice**: Press the microphone button, speak your question clearly, then press the mic again to stop and send. Odeneho understands English and common West African expressions.\n\n🔊 **Listen**: Press 'Listen' on any response to hear Odeneho read it aloud in a natural voice.\n\n**What you can ask:**\n• \"What crops should I plant this season?\"\n• \"Is it safe to spray pesticides today?\"\n• \"How do I manage my fish pond in this weather?\"\n• \"When should I vaccinate my poultry?\"\n• \"What's the best fertilizer for my maize?\"\n\n**Tips for best results:**\n• Be specific about your crop, location, or concern\n• Odeneho uses your real-time weather and location data\n• If unsure about advice, Odeneho will redirect you to expert support",
      },
      {
        title: "Understanding Alerts & Advisories",
        content: "AgroClimate alerts are powered by a two-layer intelligence system:\n\n**Layer 1: Weather Signals**\nWeather data provides early warning signals. Alerts trigger when conditions cross agriculturally meaningful thresholds:\n• Rainfall > 60% → Flood/waterlogging risk\n• Temperature > 36°C → Heat stress for crops and livestock\n• Wind > 25 km/h → Flight advisory restriction\n• Extended dry spell → Drought preparedness\n\n**Layer 2: Environmental Validation**\nEnvironmental data confirms ground impact:\n• Soil moisture + heavy rain = High flood risk\n• Heat + low humidity = Fire risk\n• High humidity + moderate temp = Disease risk\n\n**Alert Actions:**\n• ✅ Mark as Read — stays in your history\n• ❌ Dismiss — removed permanently\n• 📱 SMS Alerts — critical alerts sent via SMS to your registered phone number\n\nAlerts are never repeated unless conditions escalate.",
      },
      {
        title: "Flight Advisory & Air Monitoring",
        content: "The Flight Advisory module supports drones, helicopters, and light aircraft.\n\n**How to use:**\n1. Select your mission type (monitoring, spraying, surveying, etc.)\n2. Your location is automatically detected\n3. Enter aircraft type and planned altitude\n4. Click 'Evaluate Flight Safety'\n\n**Results:**\n🟢 Safe to Fly — conditions are favorable\n🟡 Caution — some risks, follow precautions\n🔴 Do Not Fly — unsafe conditions\n\n**Air Monitoring (New!):**\n• Upload aerial images, survey videos, or NDVI files\n• Odeneho AI interprets patterns and provides advisories\n• API ingestion for environmental sensors coming soon\n\n**No-Fly Zone Rules:**\n• Wind > 30 km/h → No drone flights\n• Active thunderstorm → All flights grounded\n• Visibility < 1 km → Caution/No-fly",
      },
      {
        title: "Agro Inventory Management",
        content: "Track every aspect of your farm's finances.\n\n**Sections:**\n📦 **Inputs** — Seeds, fertilizers, chemicals, feed. Record quantity, unit price, and link to crop/season.\n\n👥 **Labor** — Task description, number of workers, days worked, daily rate.\n\n🗺️ **Land** — Land description, size in acres, rent or purchase cost.\n\n🌾 **Harvest** — Crop, quantity, quality grade, harvest date.\n\n📉 **Losses** — Spoilage, pests, storage, theft — tracked by crop and reason.\n\n💰 **Sales** — Quantity sold, price per unit, buyer name.\n\n**Metrics Dashboard:**\nAll calculations update in real-time:\n• Total Inputs Cost\n• Total Labor & Land Costs\n• Total Harvest Quantity\n• Total Losses\n• Total Revenue\n• Net Profit = Revenue − All Costs\n\n**Filters:** View by season, crop, or farm plot.\n**Edit:** Click the pencil icon to update any record.\n**Delete:** Click the trash icon to remove records.",
      },
    ],
  },
  {
    id: "smart-farming",
    icon: Sprout,
    title: "Smart Farming",
    sections: [
      {
        title: "What is Smart Farming?",
        content: "Smart farming uses technology and data to make better farming decisions. This includes using weather forecasts, soil information, and crop calendars to know the right time to plant, fertilize, and harvest.\n\nKey principles:\n• Use weather data before planting\n• Test your soil before applying fertilizer\n• Keep records of what you plant and when\n• Rotate crops to maintain soil health\n• Use improved seed varieties suited to your region",
      },
      {
        title: "Planning Your Farm Season",
        content: "Before the rains come:\n1. Clear and prepare your land early\n2. Check AgroClimate weather forecasts for planting windows\n3. Select crops suited to your region and season\n4. Calculate how much seed and fertilizer you need\n5. Prepare storage for your harvest\n\nDuring the growing season:\n• Monitor weather alerts for heavy rain or drought\n• Apply fertilizer at the right growth stage\n• Scout for pests weekly\n• Keep your drainage channels clear",
      },
      {
        title: "Record Keeping",
        content: "Good farmers keep records. Track:\n• Date of planting\n• Type and amount of seed used\n• Fertilizer application dates and amounts\n• Pest problems and treatments\n• Harvest date and yield\n• Money spent and earned\n\nUse the Agro Inventory module to track all inputs, costs, harvest, and sales digitally.",
      },
    ],
  },
  {
    id: "climate-change",
    icon: Leaf,
    title: "Climate Change & Agriculture",
    sections: [
      {
        title: "How Climate Change Affects Your Farm",
        content: "Climate change is changing rainfall patterns across West Africa. You may notice:\n• Rains starting later or ending earlier\n• More intense rainfall causing floods\n• Longer dry spells during the growing season\n• Higher temperatures stressing crops and livestock\n• New pests and diseases appearing\n\nThese changes affect planting windows, crop yields, and livestock health.",
      },
      {
        title: "Adapting to Climate Change",
        content: "Practical steps every farmer can take:\n• Plant drought-tolerant crop varieties\n• Use mulching to conserve soil moisture\n• Practice minimum tillage to protect soil\n• Diversify crops instead of relying on one\n• Adopt agroforestry (planting trees with crops)\n• Harvest rainwater for dry periods\n• Use AgroClimate alerts to plan around weather",
      },
      {
        title: "Carbon Farming Opportunities",
        content: "Farmers can benefit from protecting the environment:\n• Tree planting programs may offer payments\n• Reduced burning improves soil fertility\n• Cover cropping prevents erosion and adds nutrients\n• Composting instead of burning crop residues\n\nAsk your extension officer about climate-smart agriculture programs in your region.",
      },
    ],
  },
  {
    id: "fertilizer-safety",
    icon: Bug,
    title: "Fertilizer & Pesticide Safety",
    sections: [
      {
        title: "Safe Use of Fertilizers",
        content: "Fertilizer is good when used correctly:\n• Always read the label\n• Apply the recommended amount, more is not better\n• Apply when soil is moist, not dry or waterlogged\n• Keep fertilizer away from stems and leaves\n• Store in a cool, dry place away from children\n\nCommon mistakes:\n• Applying too much urea burns crops\n• Applying fertilizer to dry soil wastes money\n• Using expired fertilizer gives poor results",
      },
      {
        title: "Pesticide Safety",
        content: "SAFETY FIRST when using pesticides:\n• Wear protective clothing: gloves, mask, long sleeves\n• Never spray against the wind\n• Do not eat, drink, or smoke while spraying\n• Wash hands and clothes thoroughly after spraying\n• Keep pesticides locked away from children\n• Do not use food containers for pesticide storage\n\nCheck AgroClimate weather before spraying:\n• Do not spray if rain is expected within 4 hours\n• Do not spray in strong winds (over 15 km/h)\n• Best time to spray is early morning or late afternoon",
      },
      {
        title: "Organic Alternatives",
        content: "Low-cost, natural pest and soil management:\n• Neem leaf extract for insect pests\n• Wood ash for some fungal diseases\n• Composting for soil fertility\n• Crop rotation to break pest cycles\n• Intercropping to confuse pests\n• Companion planting (maize with beans)\n\nThese methods reduce costs and protect your health.",
      },
    ],
  },
  {
    id: "post-harvest",
    icon: Wheat,
    title: "Post-Harvest & Food Safety",
    sections: [
      {
        title: "Reducing Post-Harvest Losses",
        content: "Up to 30% of harvested crops are lost after harvest. Prevent this:\n• Harvest at the right maturity stage\n• Dry crops properly before storage (grain moisture below 13%)\n• Use improved storage bags (hermetic bags) for grains\n• Clean storage rooms before use\n• Check stored crops regularly for pests\n• Separate damaged produce from good ones",
      },
      {
        title: "Food Safety Basics",
        content: "Safe food handling protects your family and increases market value:\n• Wash hands before handling food\n• Keep harvesting tools clean\n• Do not mix chemicals with food during transport\n• Dry food on clean surfaces, not bare ground\n• Avoid aflatoxin: dry maize and groundnuts quickly and completely\n• Store food away from moisture and rodents",
      },
      {
        title: "Adding Value to Your Produce",
        content: "Increase your income through processing:\n• Drying vegetables and fruits for off-season sales\n• Milling grains into flour\n• Packaging produce attractively for urban markets\n• Sorting and grading by size and quality\n• Group marketing through cooperatives for better prices\n\nClean, well-packaged produce fetches higher prices at market.",
      },
    ],
  },
  {
    id: "water-management",
    icon: Droplets,
    title: "Water & Irrigation",
    sections: [
      {
        title: "Water Conservation",
        content: "Water is precious in dry seasons:\n• Mulch around plants to reduce evaporation\n• Water early morning or late evening\n• Use drip irrigation instead of flooding\n• Harvest rainwater during the rainy season\n• Build small earth dams or dugouts\n• Plant drought-resistant crops in water-scarce areas",
      },
      {
        title: "Simple Irrigation Methods",
        content: "Affordable irrigation options:\n• Bucket/watering can for small gardens\n• Drip irrigation with plastic bottles (DIY)\n• Hose irrigation from nearby water source\n• Small motorized pumps for larger areas\n• Gravity-fed systems from elevated tanks\n\nKey rule: Irrigate based on crop need, not routine. Over-watering wastes water and can cause root diseases.",
      },
    ],
  },
  {
    id: "organic-methods",
    icon: ShieldCheck,
    title: "Organic & Low-Chemical Methods",
    sections: [
      {
        title: "Benefits of Organic Farming",
        content: "Organic farming can:\n• Reduce input costs (less money on chemicals)\n• Protect your health and family\n• Improve soil fertility long-term\n• Access premium markets willing to pay more\n• Protect pollinators like bees\n\nStarting organic does not mean zero yield. With good practices, organic yields can match conventional farming over time.",
      },
      {
        title: "Making Your Own Compost",
        content: "Turn farm waste into fertilizer:\n1. Collect crop residues, animal manure, kitchen waste\n2. Layer green (wet) and brown (dry) materials\n3. Keep the pile moist but not waterlogged\n4. Turn the pile every 2 weeks\n5. Compost is ready in 6 to 8 weeks (dark, crumbly, earthy smell)\n\nApply compost at planting time, mixed into the soil around the planting hole. One wheelbarrow per 10 square meters is a good start.",
      },
      {
        title: "Integrated Pest Management (IPM)",
        content: "Manage pests with minimal chemicals:\n1. Prevention: crop rotation, resistant varieties, clean fields\n2. Monitoring: scout fields weekly, identify pest species\n3. Cultural control: hand-picking, trapping, intercropping\n4. Biological control: encourage natural predators\n5. Chemical control: only as last resort, use targeted products\n\nIPM saves money and protects the environment while keeping pests under control.",
      },
    ],
  },
];

export default function AgroLearning() {
  const [selectedTopic, setSelectedTopic] = useState<string>(topics[0].id);
  const [selectedSection, setSelectedSection] = useState<number>(0);

  const topic = topics.find((t) => t.id === selectedTopic)!;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] lg:h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex-shrink-0 hidden md:flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-sm">Agro Learning</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Educational guides for farmers</p>
        </div>
        <ScrollArea className="flex-1">
          <nav className="p-2 space-y-1">
            {topics.map((t) => (
              <button
                key={t.id}
                onClick={() => { setSelectedTopic(t.id); setSelectedSection(0); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                  selectedTopic === t.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <t.icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">{t.title}</span>
                {t.isNew && <Badge variant="default" className="text-[10px] px-1.5 py-0">New</Badge>}
              </button>
            ))}
          </nav>
        </ScrollArea>
      </aside>

      {/* Mobile topic selector */}
      <div className="md:hidden fixed top-14 left-0 right-0 z-30 bg-card border-b border-border overflow-x-auto">
        <div className="flex gap-1 p-2">
          {topics.map((t) => (
            <button
              key={t.id}
              onClick={() => { setSelectedTopic(t.id); setSelectedSection(0); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                selectedTopic === t.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <t.icon className="h-3 w-3" />
              {t.title}
              {t.isNew && <span className="bg-destructive text-destructive-foreground text-[8px] px-1 rounded">New</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <main className="flex-1 overflow-y-auto pt-12 md:pt-0">
        <div className="max-w-3xl mx-auto p-4 lg:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <topic.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                {topic.title}
                {topic.isNew && <Badge variant="default" className="text-xs">New</Badge>}
              </h1>
              <p className="text-xs text-muted-foreground">{topic.sections.length} sections</p>
            </div>
          </div>

          {/* Section navigation */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {topic.sections.map((s, i) => (
              <button
                key={i}
                onClick={() => setSelectedSection(i)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  selectedSection === i
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {s.title}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="bg-card border border-border rounded-xl p-5 lg:p-8">
            <h2 className="text-lg font-bold mb-4">{topic.sections[selectedSection].title}</h2>
            <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {topic.sections[selectedSection].content}
            </div>
          </div>

          {/* Ask Odeneho CTA */}
          {selectedTopic === "explainer" && (
            <Card className="mt-4 border-dashed border-primary/40">
              <CardContent className="pt-4 flex items-center gap-3">
                <Bot className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Need help understanding a feature?</p>
                  <p className="text-xs text-muted-foreground">Ask Odeneho AI for a personalized walkthrough.</p>
                </div>
                <Link to="/odeneho">
                  <Button size="sm">Ask Odeneho</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <Button variant="outline" size="sm" onClick={() => setSelectedSection(Math.max(0, selectedSection - 1))} disabled={selectedSection === 0}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (selectedSection < topic.sections.length - 1) {
                  setSelectedSection(selectedSection + 1);
                } else {
                  const nextIdx = topics.findIndex(t => t.id === selectedTopic) + 1;
                  if (nextIdx < topics.length) {
                    setSelectedTopic(topics[nextIdx].id);
                    setSelectedSection(0);
                  }
                }
              }}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
