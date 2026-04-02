import { useState } from "react";
import { BookOpen, Sprout, Bug, Droplets, Leaf, ShieldCheck, Wheat, ChevronRight, PlayCircle, Bot, DollarSign, TrendingUp, Users, Warehouse, BarChart3, LineChart, Lightbulb, ArrowRight, Package } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useNewTag } from "@/hooks/useNewTag";

interface LearningTopic {
  id: string;
  icon: React.ElementType;
  title: string;
  isNew?: boolean;
  sections: { title: string; content: string }[];
}

const topics: LearningTopic[] = [
  {
    id: "explainer",
    icon: PlayCircle,
    title: "Explainer",
    sections: [
      {
        title: "Getting Started with AgroClimate",
        content: "Welcome to AgroClimate, your intelligent farming companion.\n\nAgroClimate helps you make better farming decisions using real-time weather data, AI-powered crop advisories, and environmental monitoring.\n\nKey Features:\n\n1) Dashboard: Your personalized farming hub with real-time weather, alerts, and crop recommendations based on your exact location.\n\n2) Odeneho: Your intelligent assistant. Ask anything about farming, weather, livestock, aquaculture, or food safety. Voice-enabled for hands-free use.\n\n3) Weather and Forecast: Live weather with 7-day forecasts, irrigation advisories, and seasonal crop planning.\n\n4) Alerts: Smart notifications triggered by real weather conditions: heavy rain, extreme heat, high winds, disease risk. Mark as read or dismiss permanently.\n\n5) Agro Inventory: Track all farm inputs, labor, land costs, harvest, losses, and sales with real-time profit calculations.\n\n6) Farm Business Hub: Practical strategies for improving profitability, pricing power, and financial resilience.",
      },
      {
        title: "Using Odeneho",
        content: "Odeneho is your personal agricultural intelligence assistant.\n\nHow to use:\n\nText: Type your question in the chat box and press Send.\n\nVoice: Press the microphone button, speak your question clearly, then press the mic again to stop. Review the transcribed text and edit if needed before sending.\n\nListen: Press 'Listen' on any response to hear it read aloud.\n\nWhat you can ask:\nWhat crops should I plant this season?\nIs it safe to spray pesticides today?\nHow do I manage my fish pond in this weather?\nWhen should I vaccinate my poultry?\nWhat's the best fertilizer for my maize?\nHow do I reduce post-harvest losses?\nWhat's a good pricing strategy for my produce?\n\nTips for best results:\nBe specific about your crop, location, or concern.\nOdeneho uses your real-time weather and location data.\nFor complex topics (disease diagnosis, market strategy), Odeneho provides research-grade guidance.\nIf unsure about advice, Odeneho will redirect you to expert support.",
      },
      {
        title: "Understanding Alerts & Advisories",
        content: "AgroClimate alerts are powered by a two-layer intelligence system.\n\nLayer 1: Weather Signals\nWeather data provides early warning signals. Alerts trigger when conditions cross agriculturally meaningful thresholds:\nRainfall above 60% means flood or waterlogging risk\nTemperature above 36°C means heat stress for crops and livestock\nWind above 25 km/h means operational caution\nExtended dry spell means drought preparedness\n\nLayer 2: Environmental Validation\nEnvironmental data confirms ground impact:\nSoil moisture plus heavy rain means high flood risk\nHeat plus low humidity means fire risk\nHigh humidity plus moderate temperature means disease risk\n\nAlert Actions:\nMark as Read stays in your history\nDismiss removes permanently\nSMS Alerts send critical alerts to your registered phone number\n\nAlerts are never repeated unless conditions escalate.",
      },
      {
        title: "Flight Advisory & Air Monitoring",
        content: "The Flight Advisory module supports drones, helicopters, and light aircraft used in agricultural operations.\n\nHow to use:\n1. Select your mission type (monitoring, spraying, surveying, and more)\n2. Your location is automatically detected\n3. Enter aircraft type and planned altitude\n4. Click Evaluate Flight Safety\n\nResults:\nSafe to Fly means conditions are favorable\nCaution means some risks, follow precautions\nDo Not Fly means unsafe conditions\n\nNo-Fly Zone Rules:\nWind above 30 km/h means no drone flights\nActive thunderstorm means all flights grounded\nVisibility below 1 km means caution or no-fly",
      },
      {
        title: "Agro Inventory Management",
        content: "Track every aspect of your farm finances.\n\nSections:\nInputs: Seeds, fertilizers, chemicals, feed. Record quantity, unit price, and link to crop or season.\nLabor: Task description, number of workers, days worked, daily rate.\nLand: Land description, size in acres, rent or purchase cost.\nHarvest: Crop, quantity, quality grade, harvest date.\nLosses: Spoilage, pests, storage, theft tracked by crop and reason.\nSales: Quantity sold, price per unit, buyer name.\n\nMetrics Dashboard:\nAll calculations update in real-time:\nTotal Inputs Cost\nTotal Labor and Land Costs\nTotal Harvest Quantity\nTotal Losses\nTotal Revenue\nNet Profit equals Revenue minus All Costs\n\nFilters: View by season, crop, or farm plot.\nEdit: Click the pencil icon to update any record.\nDelete: Click the trash icon to remove records.",
      },
    ],
  },
  {
    id: "post-harvest",
    icon: Wheat,
    title: "Post-Harvest & Food Safety",
    isNew: true,
    sections: [
      {
        title: "Reducing Post-Harvest Losses",
        content: "Up to 30% of harvested crops are lost after harvest in Africa. This is the single biggest drain on farmer income.\n\nKey Causes of Loss:\n• Harvesting too early or too late\n• Poor drying — grain stored above 13% moisture develops mould and aflatoxin\n• Weevils, borers, and rodents in storage\n• Bruising and damage during transport\n• Lack of cold chain for perishables\n\nPrevention Steps:\n• Harvest at correct maturity stage\n• Dry crops properly before storage (grain moisture below 13%)\n• Use hermetic storage bags (PICS bags, GrainPro) for cereals and legumes — costs $2–3 per bag, saves 30% of grain\n• Clean and disinfect storage rooms before use\n• Check stored crops weekly for pest activity\n• Separate damaged produce from good ones immediately",
      },
      {
        title: "Preservation Methods for African Farmers",
        content: "Solar Drying:\nBuild a simple solar dryer with wooden frame, black polythene base, and clear plastic cover. Dries produce 30–50% faster than open air with less contamination. Cost: $20–50.\n\nSmoking:\nTraditional method for fish, meat, and some vegetables. Use improved smoking kilns (Chorkor oven for fish) for better quality and less fuel.\n\nSalting & Brining:\nFish and meat can be preserved with 15–20% salt concentration. Lasts 2–6 months without refrigeration.\n\nFermentation:\nCassava → gari, milk → yoghurt, maize → kenkey. Fermentation preserves food, adds nutritional value, and creates market-ready products.\n\nHermetic Storage:\nAirtight containers or bags that suffocate insects without chemicals. PICS bags for grain cost $2–3 and last 2+ seasons. Metal silos for larger quantities cost $50–200.\n\nCold Storage:\nCoolBot + air conditioner converts any insulated room into cold storage for $300–500. Solar-powered cold rooms available from $2,000–5,000 for community use.",
      },
      {
        title: "Food Safety Basics",
        content: "Safe food handling protects your family and increases market value:\n• Wash hands before handling food\n• Keep harvesting tools clean\n• Do not mix chemicals with food during transport\n• Dry food on clean surfaces, not bare ground\n• Avoid aflatoxin: dry maize and groundnuts quickly and completely\n• Store food away from moisture and rodents\n\nAflatoxin Prevention:\nAflatoxin is a deadly mould toxin common in maize and groundnuts in tropical Africa.\n• Harvest promptly at maturity\n• Dry to below 13% moisture within 48 hours\n• Sort and remove damaged or discolored kernels\n• Store in hermetic bags away from soil contact\n• Never consume or sell mouldy grain",
      },
      {
        title: "Adding Value to Your Produce",
        content: "Processing multiplies income:\n\nCassava → gari/flour: 3× raw value\nTomatoes → paste/sauce: 5× raw value\nGroundnuts → oil/paste: 2× raw value\nFruits → dried fruit/juice: 3–4× raw value\nMaize → flour/porridge mix: 2× raw value\n\nPackaging & Branding:\n• Clean, labelled packaging increases perceived value by 30–50%\n• Use clear bags so buyers can see quality\n• Include weight, production date, and contact info\n• Register a simple brand name with your district office\n\nGrading & Sorting:\n• Sort by size and quality — Grade A fetches 30–50% premium\n• Remove damaged, undersized, or discolored items\n• Uniform packaging builds buyer confidence",
      },
      {
        title: "Why Are Most Farmers Still Poor?",
        content: "If farming is profitable, why are most farmers still poor?\n\nThe truth: Farming IS profitable — but most farmers don't capture the profit. Here's why and what to do:\n\n1. Hidden Costs Eat Profits\nMost farmers underestimate costs by 40–60%. Transport, storage losses, middlemen fees, and unpaid family labor are rarely tracked.\n→ Action: Record every input, labor hour, and transport cost. Use Agro Inventory to calculate your true cost per kilogram. Never sell below this number.\n\n2. Post-Harvest Losses Destroy Income\nUp to 30% of harvested produce is lost to spoilage, pests, and poor storage.\n→ Action: Invest in hermetic bags ($2–3 each), dry grain below 13% moisture, and process perishables into shelf-stable products.\n\n3. Selling at the Wrong Time\nFarmers sell at harvest when prices are lowest because they need cash immediately.\n→ Action: Sell only 30% at harvest for urgent needs. Store the rest and sell in stages as prices rise (typically 40–80% increase within 2–3 months).\n\n4. Operating Alone\nIndividual farmers have zero negotiating power with buyers, suppliers, and transporters.\n→ Action: Join or form a cooperative of 10–20 farmers. Bulk-buy inputs for 20–40% savings. Sell collectively for better prices.",
      },
      {
        title: "Setting Prices Instead of Begging Buyers",
        content: "Why do farmers beg buyers instead of setting prices?\n\nBecause most farmers sell perishable products with no storage alternative, no market information, and no collective power. Fix these three and you control pricing.\n\n1. Know Your Break-Even Price\nCalculate: (Total Season Cost) ÷ (Total Harvest in kg) = minimum price per kg.\nNever accept less than this number. If a buyer offers less, you're literally paying them to take your produce.\n\n2. Get Market Intelligence\nCheck prices in 3+ markets before selling. Price differences of 30–100% exist between farmgate, local market, and urban market. Call contacts in different markets or use mobile price services.\n\n3. Store Strategically\nWarehouse receipt systems let you store grain, get a receipt, and borrow against it while waiting for better prices. Sell in stages: 30% at harvest, 30% after 2 months, 40% at peak price.\n\n4. Grade and Package\nGrade A produce commands 30–50% premium. Sort by size, color, and condition. Clean packaging with labels signals quality.\n\n5. Sell Collectively\n100 farmers selling 100 tonnes together have far more negotiating power than 1 farmer selling 1 tonne. Use contract farming and forward agreements to lock in prices before planting.",
      },
      {
        title: "Surviving Bad Seasons",
        content: "Why does one bad season destroy a farmer completely?\n\nBecause most smallholder farmers operate with zero reserves, single-crop dependency, and no risk management. Here's the practical fix:\n\n1. Never Depend on One Crop\nGrow 2–3 crops with different risk profiles: one drought-tolerant (millet, sorghum), one high-value (vegetables, spices), one staple (maize, rice). If one fails, others survive.\n\n2. Add Livestock or Aquaculture\nPoultry generates income in 6–8 weeks. Goats reproduce in 5–6 months. Fish ponds produce protein and income year-round. These buffer against crop failure.\n\n3. Build a 3-Month Reserve\nSave 10–20% of each season's revenue. Target 3 months of operating costs. Village Savings and Loan Associations (VSLAs) or mobile money savings make this practical.\n\n4. Explore Crop Insurance\nWeather-based index insurance is available in many African countries. Premiums are 5–10% of insured value. Some are government-subsidized. Ask your extension officer.\n\n5. Store Seed and Feed\nAlways keep seed for next season plus 50% extra. Store 2–3 months of animal feed. This prevents the devastating cycle of buying inputs at peak prices after a loss.\n\n6. Use Climate-Smart Varieties\nDrought-tolerant maize (SAMMAZ varieties), flood-tolerant rice (WITA-4), and heat-tolerant cowpea varieties exist for African conditions. They cost slightly more but survive extreme weather.",
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
        content: "Before the rains come:\n1. Clear and prepare your land early\n2. Check weather forecasts for planting windows\n3. Select crops suited to your region and season\n4. Calculate how much seed and fertilizer you need\n5. Prepare storage for your harvest\n\nDuring the growing season:\n• Monitor weather alerts for heavy rain or drought\n• Apply fertilizer at the right growth stage\n• Scout for pests weekly\n• Keep your drainage channels clear",
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
        content: "Practical steps every farmer can take:\n• Plant drought-tolerant crop varieties\n• Use mulching to conserve soil moisture\n• Practice minimum tillage to protect soil\n• Diversify crops instead of relying on one\n• Adopt agroforestry (planting trees with crops)\n• Harvest rainwater for dry periods\n• Use weather alerts to plan around weather events",
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
        content: "SAFETY FIRST when using pesticides:\n• Wear protective clothing: gloves, mask, long sleeves\n• Never spray against the wind\n• Do not eat, drink, or smoke while spraying\n• Wash hands and clothes thoroughly after spraying\n• Keep pesticides locked away from children\n• Do not use food containers for pesticide storage\n\nCheck weather before spraying:\n• Do not spray if rain is expected within 4 hours\n• Do not spray in strong winds (over 15 km/h)\n• Best time to spray is early morning or late afternoon",
      },
      {
        title: "Organic Alternatives",
        content: "Low-cost, natural pest and soil management:\n• Neem leaf extract for insect pests\n• Wood ash for some fungal diseases\n• Composting for soil fertility\n• Crop rotation to break pest cycles\n• Intercropping to confuse pests\n• Companion planting (maize with beans)\n\nThese methods reduce costs and protect your health.",
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
  const { isNew, markVisited } = useNewTag();

  const topic = topics.find((t) => t.id === selectedTopic)!;

  const handleTopicClick = (topicId: string) => {
    markVisited(`learning-${topicId}`);
    setSelectedTopic(topicId);
    setSelectedSection(0);
  };

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
                onClick={() => handleTopicClick(t.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                  selectedTopic === t.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <t.icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">{t.title}</span>
                {t.isNew && isNew(`learning-${t.id}`) && <Badge variant="default" className="text-[10px] px-1.5 py-0">New</Badge>}
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
              onClick={() => handleTopicClick(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                selectedTopic === t.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <t.icon className="h-3 w-3" />
              {t.title}
              {t.isNew && isNew(`learning-${t.id}`) && <span className="bg-destructive text-destructive-foreground text-[8px] px-1 rounded">New</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <main className="flex-1 overflow-y-auto pt-12 md:pt-0">
        <div className="max-w-3xl mx-auto p-4 lg:p-8">
          {/* Back button for public access */}
          <div className="mb-4">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-1">
                <ChevronRight className="h-4 w-4 rotate-180" /> Back to Home
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <topic.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                {topic.title}
                {topic.isNew && isNew(`learning-${topic.id}`) && <Badge variant="default" className="text-xs">New</Badge>}
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
          {(selectedTopic === "explainer" || selectedTopic === "post-harvest") && (
            <Card className="mt-4 border-dashed border-primary/40">
              <CardContent className="pt-4 flex items-center gap-3">
                <Bot className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {selectedTopic === "post-harvest" ? "Need personalized business or preservation advice?" : "Need help understanding a feature?"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedTopic === "post-harvest" ? "Ask Odeneho for strategies tailored to your crops, location, and season." : "Ask Odeneho AI for a personalized walkthrough."}
                  </p>
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
                    handleTopicClick(topics[nextIdx].id);
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
