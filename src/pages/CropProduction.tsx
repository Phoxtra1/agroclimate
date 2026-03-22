// src/components/CropProduction.tsx
import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, ShieldCheck, Leaf, Archive, Sprout, Thermometer } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Region =
  | "All Africa"
  | "West Africa"
  | "East Africa"
  | "Central Africa"
  | "Southern Africa"
  | "Sahel"
  | "Coastal Africa";

interface ProductionPhase {
  title: string;
  duration: string;
  steps: string[];
}

interface PestEntry {
  name: string;
  sign: string;
  control: string;
}

interface CropDetail {
  name: string;
  icon: string;
  scientificName: string;
  regions: Region[];
  soilType: string;
  temperatureRange: string;
  rainfall: string;
  irrigationNeeded: boolean;
  yieldPerHectare: string;
  phases: {
    landPrep: ProductionPhase;
    planting: ProductionPhase;
    growth: ProductionPhase;
    harvest: ProductionPhase;
    postHarvest: ProductionPhase;
    preservation: ProductionPhase;
  };
  pests: PestEntry[];
  yieldTips: string[];
  marketInfo: string;
}

interface CropCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  crops: CropDetail[];
}

// ─── SEASON HELPER ────────────────────────────────────────────────────────────

function getCurrentSeason(month: number) {
  if (month >= 3 && month <= 6) return { name: "Long Rains (MAM)", type: "rainy" };
  if (month >= 7 && month <= 9) return { name: "Dry Season", type: "dry" };
  if (month >= 10 && month <= 11) return { name: "Short Rains (OND)", type: "rainy" };
  return { name: "Cool Dry Season", type: "dry" };
}

// ─── CROP DATA ────────────────────────────────────────────────────────────────

const cropCategories: CropCategory[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 1 — CASH CROPS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "cash",
    name: "Cash Crops",
    icon: "💰",
    description: "High-value crops cultivated primarily for commercial sale and export income.",
    crops: [
      {
        name: "Cocoa",
        icon: "🍫",
        scientificName: "Theobroma cacao",
        regions: ["West Africa", "Central Africa", "Coastal Africa"],
        soilType: "Deep, well-drained loam rich in organic matter, pH 6.0–7.5",
        temperatureRange: "21–32 °C",
        rainfall: "1,500–2,000 mm/year",
        irrigationNeeded: false,
        yieldPerHectare: "400–600 kg/ha (smallholder); up to 2,000 kg with improved varieties",
        phases: {
          landPrep: {
            title: "Land Preparation",
            duration: "4–6 weeks before planting",
            steps: [
              "Clear land but retain shade trees (cocoa thrives under 30–50% shade).",
              "Till to 30 cm depth; apply 10 t/ha farmyard manure.",
              "Dig planting holes 60×60×60 cm; space 3×3 m (approx. 1,111 trees/ha).",
              "Plant windbreaks (Gliricidia or Leucaena) along field borders.",
            ],
          },
          planting: {
            title: "Planting",
            duration: "Plant at start of rainy season (Mar–Apr or Sep–Oct)",
            steps: [
              "Use hybrid seeds or grafted seedlings (CRIG-1, T85/799) for disease resistance.",
              "Sow seeds in nursery polybags 5–6 months before transplanting.",
              "Transplant seedlings 60–90 cm tall into pre-dug holes.",
              "Mulch base with dry leaves to retain moisture and suppress weeds.",
            ],
          },
          growth: {
            title: "Crop Growth & Management",
            duration: "3–5 years to first harvest (then annual)",
            steps: [
              "Apply NPK (0:22:18) at 100 g/tree at 6 and 18 months.",
              "Prune 'chupons' (suckers) and maintain a single main stem (jorquette).",
              "Annual heavy pruning in Dec–Jan to remove dead wood and open the canopy.",
              "Weed 3× per year; ring-weed around tree base to 1 m radius.",
            ],
          },
          harvest: {
            title: "Harvesting",
            duration: "Oct–Mar (main crop); May–Aug (mid-crop)",
            steps: [
              "Harvest pods when color changes to yellow/orange-red and sounds hollow when tapped.",
              "Use a cutlass or harvesting hook; cut flush with the pod stalk — do not damage the cushion.",
              "Collect pods within 1 week of ripening; overripe pods reduce quality.",
              "Break pods within 24 hours of harvest using a wooden mallet — avoid seed damage.",
            ],
          },
          postHarvest: {
            title: "Post-Harvest Handling",
            duration: "6–8 days fermentation + 7–14 days drying",
            steps: [
              "Ferment beans in wooden boxes (60 cm deep) for 6–8 days, turning on day 3.",
              "Spread on raised drying racks in single layers for 7–14 days (target 7–8% moisture).",
              "Never dry on bare ground — introduces mould and contamination.",
              "Grade and bag in new jute/sisal sacks (60–65 kg); never re-use old bags.",
            ],
          },
          preservation: {
            title: "Storage & Preservation",
            duration: "Up to 12 months if properly stored",
            steps: [
              "Store in cool, well-ventilated warehouse on pallets 15 cm off the floor.",
              "Maintain relative humidity below 70%; fumigate store before use.",
              "Inspect monthly for mould and insect damage.",
              "Do not store near fertilisers, fuel, or strong-smelling items.",
            ],
          },
        },
        pests: [
          {
            name: "Black Pod Disease (Phytophthora palmivora)",
            sign: "Dark water-soaked patches on pods that turn black; affects all stages.",
            control: "Spray copper-based fungicide (Ridomil Gold) every 3 weeks during wet season; remove and destroy infected pods.",
          },
          {
            name: "Cocoa Swollen Shoot Virus (CSSV)",
            sign: "Swollen stems, yellowing leaves, red band in leaf shoot tip.",
            control: "No cure — uproot and burn infected trees; maintain buffer distance; use certified clean planting material.",
          },
          {
            name: "Mirids / Capsids (Sahlbergella singularis)",
            sign: "Lesions on stems and pods; 'blast' appearance of young shoots.",
            control: "Apply Dimethoate or Cypermethrin; inspect every 2 weeks during dry season.",
          },
          {
            name: "Cocoa Pod Borer (Conopomorpha cramerella)",
            sign: "Prematurely ripening pods with stunted/clumped beans inside.",
            control: "Frequent harvesting (every 2 weeks), sleeving pods, releasing parasitic wasps (Dolichogenidea).",
          },
        ],
        yieldTips: [
          "Use improved hybrid varieties (PH16, Amazon) to double yields vs. local seedlings.",
          "Ferment properly — under-fermented cocoa loses 15–20% market value.",
          "Shade management: too much shade reduces yield; too little causes heat stress.",
          "Join a cooperative for access to certified inputs and better farmgate prices.",
        ],
        marketInfo: "Primary buyers: OLAM, Barry Callebaut, Cargill. Minimum farmgate: ~$2,200/MT (2024). Export grade requires ≤7.5% moisture and ≤3% mouldy beans.",
      },

      {
        name: "Coffee (Arabica)",
        icon: "☕",
        scientificName: "Coffea arabica",
        regions: ["East Africa", "Central Africa"],
        soilType: "Deep, well-drained volcanic loam, pH 6.0–6.5, rich in organic matter",
        temperatureRange: "18–24 °C (cool highlands)",
        rainfall: "1,200–2,000 mm/year (bimodal preferred)",
        irrigationNeeded: false,
        yieldPerHectare: "600–1,200 kg clean coffee/ha; 3,000+ kg with SL28/SL34 varieties under high input",
        phases: {
          landPrep: {
            title: "Land Preparation",
            duration: "3–4 months before planting",
            steps: [
              "Choose highland sites (1,400–2,200 m asl) for premium Arabica quality.",
              "Clear land; plant shade trees (Grevillea robusta, Alnus) at 10×10 m.",
              "Prepare planting holes 60×60×60 cm; backfill with topsoil + 5 kg compost.",
              "Spacing: 2.5×2.5 m (1,600 trees/ha) or 3×3 m (1,100 trees/ha).",
            ],
          },
          planting: {
            title: "Planting",
            duration: "Begin of long rains (Mar–May)",
            steps: [
              "Use certified seedlings: SL28, SL34 (Kenya), Ruiru11 (disease-resistant), Bourbon.",
              "Transplant 6–9-month-old seedlings from nursery; water immediately.",
              "Mulch with 10 cm dry grass or coffee husks.",
              "Stake young plants in windy areas.",
            ],
          },
          growth: {
            title: "Crop Management",
            duration: "2–3 years to first crop (then annual)",
            steps: [
              "Apply CAN (Calcium Ammonium Nitrate) 60 g/tree at onset of rains.",
              "Apply DSP (triple super phosphate) 30 g/tree in second application.",
              "Prune to single-stem or multiple-stem depending on system; remove suckers.",
              "Slashing of undergrowth 3× per year; ring-weed monthly.",
            ],
          },
          harvest: {
            title: "Harvesting",
            duration: "Oct–Jan (main); Apr–Jun (fly crop)",
            steps: [
              "Selective pick ONLY red-ripe cherries — green and overripe cherries reduce cup quality.",
              "Pick every 2 weeks during peak ripening period.",
              "Carry in clean baskets; avoid metal containers that cause oxidation.",
              "Transport to pulping station same day of harvest.",
            ],
          },
          postHarvest: {
            title: "Processing (Washed Method)",
            duration: "3–4 days",
            steps: [
              "Pulp cherries within 24 hours; ferment mucilage for 24–72 hours in clean tanks.",
              "Wash thoroughly until parchment feels 'gritty'.",
              "Dry on raised tables under shade nets to 11–12% moisture.",
              "Grade by density (floaters removed); hull, sort, and bag as green coffee.",
            ],
          },
          preservation: {
            title: "Storage",
            duration: "6–12 months in parchment; 3–6 months hulled",
            steps: [
              "Store parchment coffee in grain pro bags inside hessian sacks.",
              "Maintain storage at 60% RH and <25°C — avoids moisture and flavour degradation.",
              "Never store near onions, garlic, or chemicals — coffee absorbs odours.",
              "Roast or export within 6 months for peak quality.",
            ],
          },
        },
        pests: [
          {
            name: "Coffee Berry Borer (Hypothenemus hampei)",
            sign: "Small round holes at tip of coffee berry; brown powder inside.",
            control: "Beauveria bassiana biopesticide spray; use Cbtrack traps; harvest all ripe and overripe cherries.",
          },
          {
            name: "Coffee Leaf Rust (Hemileia vastatrix)",
            sign: "Orange-yellow powdery spots on underside of leaves; defoliation.",
            control: "Spray copper oxychloride or Bayleton fungicide; plant resistant variety (Ruiru11, Batian).",
          },
          {
            name: "Antestia Bug (Antestiopsis orbitalis)",
            sign: "Stunted, discoloured cherries; potato-like off-flavour in cup.",
            control: "Spray Dimethoate; remove wild hosts (Rubus) from field edges.",
          },
        ],
        yieldTips: [
          "Selective hand-picking increases prices by 20–40% vs. strip picking.",
          "Fermentation time is critical — test parchment by feel, not a fixed time.",
          "Maintain shade at 30–40% to reduce temperature stress on cherries.",
          "Join a certified cooperative (Rainforest Alliance, Fairtrade) for price premiums.",
        ],
        marketInfo: "Specialty Arabica (80+ SCA score): $4–8/kg green. Commodity grade: $2.5–3.5/kg. Major buyers: Starbucks, Nespresso, local cooperatives.",
      },

      {
        name: "Cotton",
        icon: "🌿",
        scientificName: "Gossypium hirsutum",
        regions: ["West Africa", "East Africa", "Sahel", "Southern Africa"],
        soilType: "Deep clay-loam, pH 6.0–7.5; tolerates vertisols",
        temperatureRange: "25–35 °C (warm days, cool nights good for fibre quality)",
        rainfall: "600–1,200 mm/year",
        irrigationNeeded: true,
        yieldPerHectare: "700–1,500 kg seed cotton/ha; 2,000–3,500 kg under irrigation",
        phases: {
          landPrep: {
            title: "Land Preparation",
            duration: "4–6 weeks before planting",
            steps: [
              "Deep plough to 30 cm after previous season; sub-soil plough every 3 years.",
              "Apply 10 t/ha farmyard manure or compost; incorporate with disc harrow.",
              "Prepare raised beds (15 cm height) in heavy soils for drainage.",
              "Plant rows north-to-south orientation for maximum sun interception.",
            ],
          },
          planting: {
            title: "Planting",
            duration: "Onset of rains (Apr–May; Nov–Dec in bimodal areas)",
            steps: [
              "Use certified improved varieties: STAM 59A (West Africa), UK91 (East Africa).",
              "Treat seeds with Thiram or Apron Star (metalaxyl) fungicide before planting.",
              "Plant 2 seeds/hole at 5 cm depth; thin to 1 plant at 3 weeks.",
              "Spacing: 90×30 cm (37,000 plants/ha).",
            ],
          },
          growth: {
            title: "Crop Management",
            duration: "150–180 days",
            steps: [
              "Apply DAP (18:46:0) at 100 kg/ha at planting; top-dress with CAN at 8 weeks.",
              "Weed at 3, 6, and 10 weeks — cotton is highly sensitive to early weed competition.",
              "Irrigate at square formation, flowering, and boll filling if rainfall is insufficient.",
              "Side-dress with potassium sulphate at boll-filling stage for fibre quality.",
            ],
          },
          harvest: {
            title: "Harvesting",
            duration: "150–180 days after planting (Oct–Jan)",
            steps: [
              "Harvest when 60% of bolls are open — usually 3 picks per season.",
              "Pick early morning to avoid heat wilting of lint.",
              "Separate clean cotton from trash; avoid harvesting after rain (mould risk).",
              "Do not mix grades; keep different varieties separate.",
            ],
          },
          postHarvest: {
            title: "Ginning Preparation",
            duration: "Sun-dry to <12% moisture before ginning",
            steps: [
              "Dry cotton in shed or on tarpaulin; avoid ground contact.",
              "Remove sticks, leaves, and soil clumps before selling to ginnery.",
              "Pack in clean polypropylene bags (100 kg); weigh at certified scales.",
              "Deliver to licensed ginnery within 30 days; avoid long storage as seed cotton.",
            ],
          },
          preservation: {
            title: "Lint Storage",
            duration: "6–18 months (at ginnery level)",
            steps: [
              "Ginned lint baled at 220 kg; cover with cotton bagging and metal bands.",
              "Store bales raised off floor in low-humidity warehouse.",
              "Inspect for mould, pests (beetles), and moisture ingress monthly.",
            ],
          },
        },
        pests: [
          {
            name: "Bollworm (Helicoverpa armigera)",
            sign: "Entry holes in bolls; shed squares and bolls; caterpillar frass.",
            control: "Spray Spinosad, Emamectin benzoate, or Bt (Bacillus thuringiensis); monitor with pheromone traps.",
          },
          {
            name: "Whitefly (Bemisia tabaci)",
            sign: "Yellowing leaves; sooty mould on lint; sticky honeydew on leaves.",
            control: "Use Imidacloprid (seed treatment); spray Acetamiprid; yellow sticky traps for monitoring.",
          },
          {
            name: "Cotton Stainer (Dysdercus spp.)",
            sign: "Red bugs feeding on open bolls; yellow-stained lint.",
            control: "Harvest promptly; spray Dimethoate; remove wild hibiscus (alternate host).",
          },
          {
            name: "Fusarium Wilt",
            sign: "Yellowing of lower leaves, browning of vascular tissue.",
            control: "Use resistant varieties; crop rotation with maize or sorghum; avoid waterlogged soils.",
          },
        ],
        yieldTips: [
          "Plant on time — late planting reduces yield 15–30% due to pest pressure and moisture stress.",
          "Use pheromone traps to monitor bollworm populations for targeted spraying.",
          "Rotate with legumes (groundnut, cowpea) to improve soil nitrogen.",
          "Avoid applying nitrogen late in season — causes excessive vegetative growth, reduces bolls.",
        ],
        marketInfo: "Lint prices (2024): $0.80–1.10/kg. Deliver to certified ginneries for fair weighing. Organic cotton fetches 20–30% premium from Fairtrade-certified buyers.",
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 2 — FOOD CROPS / CEREALS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "food",
    name: "Food Crops",
    icon: "🌾",
    description: "Staple cereals and root crops that form the dietary foundation across African regions.",
    crops: [
      {
        name: "Maize (Corn)",
        icon: "🌽",
        scientificName: "Zea mays",
        regions: ["West Africa", "East Africa", "Central Africa", "Southern Africa"],
        soilType: "Well-drained loam or sandy-loam, pH 5.8–7.0",
        temperatureRange: "18–32 °C",
        rainfall: "500–900 mm/season",
        irrigationNeeded: false,
        yieldPerHectare: "2–4 t/ha (local); 6–10 t/ha (hybrid + irrigation)",
        phases: {
          landPrep: {
            title: "Land Preparation",
            duration: "2–4 weeks before planting",
            steps: [
              "Plough to 20–25 cm depth; disc harrow to fine tilth.",
              "Apply 5–10 t/ha farmyard manure or compost and incorporate.",
              "Avoid waterlogged areas — maize is highly sensitive to flooding.",
              "Spacing: 75×25 cm (50,000+ plants/ha) or 90×30 cm (37,000 plants/ha).",
            ],
          },
          planting: {
            title: "Planting",
            duration: "Onset of rains (Mar–May; Oct–Nov)",
            steps: [
              "Use certified hybrids: H614D (Kenya/Uganda), WS303 (Ghana), SC403 (Zambia/Zimbabwe).",
              "Treat seeds with fungicide (Thiram) + insecticide (Gaucho) dressing.",
              "Plant 2 seeds/hole at 5 cm depth; thin to 1 at 2–3 weeks.",
              "Apply DAP/NPK 23:23:0 at 150 kg/ha in planting furrow, 5 cm away from seed.",
            ],
          },
          growth: {
            title: "Crop Management",
            duration: "90–120 days",
            steps: [
              "Top-dress with CAN (nitrogen) at knee-high stage (V6); 150 kg/ha.",
              "Second top-dressing at tasselling stage (V12).",
              "Weed twice: at 2–3 weeks and 5–6 weeks after planting.",
              "Scout for FAW, stalk borer, and armyworm from 4 weeks onwards.",
            ],
          },
          harvest: {
            title: "Harvesting",
            duration: "90–120 days (cob husk turns brown and dry)",
            steps: [
              "Harvest when 75–80% of plants show brown/dry husks and silk.",
              "Moisture at harvest: 18–25% (for field drying); 13–14% for storage.",
              "Husk cobs in field; keep dry; never pile undried cobs for more than 2 days.",
              "Transport in open trucks to allow air circulation.",
            ],
          },
          postHarvest: {
            title: "Drying & Shelling",
            duration: "1–3 weeks",
            steps: [
              "Sun-dry cobs on raised platforms or drying cribs for 2–3 weeks.",
              "Shell by hand or mechanical sheller at 13% moisture.",
              "Winnow to remove light chaff, stones, and broken kernels.",
              "Grade: reject black, shriveled, and visibly mouldy grain.",
            ],
          },
          preservation: {
            title: "Storage & Preservation",
            duration: "6–12 months at 13% moisture",
            steps: [
              "Store in hermetic bags (Grain Pro, PICS bags) or metal silos.",
              "Apply Actellic Super (pirimiphos-methyl) dust at 1 g/kg grain for 6-month protection.",
              "Never store near moisture; keep store off ground; use pallets.",
              "Monitor temperature and moisture monthly; use hand moisture meter.",
            ],
          },
        },
        pests: [
          {
            name: "Fall Armyworm (Spodoptera frugiperda)",
            sign: "Ragged feeding on leaves, saw-dust frass in whorl, window-pane damage.",
            control: "Apply Emamectin benzoate or Spinosad to whorl at 7–10 day intervals; Bt spray at early instars.",
          },
          {
            name: "Maize Stalk Borer (Busseola fusca)",
            sign: "Dead heart in seedlings; holes in stalk; dead tassels.",
            control: "Apply granular Furadan in whorl; spray Cypermethrin; practice crop rotation.",
          },
          {
            name: "Maize Lethal Necrosis (MLN)",
            sign: "Chlorotic streaking, premature drying of plants, kernel discolouration.",
            control: "No cure — plant resistant varieties (DK8031, PH4); control vectors (thrips, aphids).",
          },
          {
            name: "Aflatoxin (Aspergillus flavus)",
            sign: "Yellow-green mould on stored grain; invisible contamination.",
            control: "Harvest at correct moisture; dry to 13%; use hermetic storage; apply Aflasafe biological control in field.",
          },
        ],
        yieldTips: [
          "Plant within the first 2 weeks of rains for 20–30% higher yield vs. late planting.",
          "Split fertiliser applications reduce losses from leaching.",
          "Hermetic storage eliminates weevil losses — saves 15–20% of harvest annually.",
          "Intercrop with beans or cowpea to improve soil nitrogen for the next season.",
        ],
        marketInfo: "Farmgate price: $150–250/MT (2024). Sells as grain, flour (posho/ugali), or animal feed. Strategic food reserve purchases at government depots.",
      },

      {
        name: "Cassava",
        icon: "🥔",
        scientificName: "Manihot esculenta",
        regions: ["West Africa", "Central Africa", "East Africa", "Coastal Africa"],
        soilType: "Sandy-loam, well-drained, pH 5.5–6.5; tolerant of poor soils",
        temperatureRange: "25–29 °C",
        rainfall: "600–1,500 mm/year",
        irrigationNeeded: false,
        yieldPerHectare: "8–15 t/ha (fresh roots); 30–50 t/ha (improved varieties with good management)",
        phases: {
          landPrep: {
            title: "Land Preparation",
            duration: "2–3 weeks",
            steps: [
              "Mound or ridge soil to improve drainage and root expansion.",
              "Mound size: 30–40 cm high, 60 cm diameter.",
              "Spacing: 1×1 m (10,000 plants/ha) or 1.2×0.8 m.",
              "Apply 5 t/ha compost or incorporate crop residues.",
            ],
          },
          planting: {
            title: "Planting",
            duration: "At start of rains or 2 weeks before",
            steps: [
              "Use stem cuttings 20–25 cm long with 4–6 nodes from healthy plants (IITA TME419, UMUSPO/2).",
              "Plant at 45° angle with ⅔ of cutting in soil.",
              "Discard cuttings older than 2 weeks or showing disease signs.",
              "Do not use tip cuttings — use middle section of 8–12 month old stems.",
            ],
          },
          growth: {
            title: "Crop Management",
            duration: "8–24 months",
            steps: [
              "Weed 2–3× in first 3 months when competition is critical.",
              "Apply NPK 15:15:15 at 250 kg/ha at 4 weeks and 12 weeks.",
              "No staking required; maintain single stem by removing early branches.",
              "Monitor for Cassava Mosaic and Cassava Brown Streak from month 2.",
            ],
          },
          harvest: {
            title: "Harvesting",
            duration: "8–12 months (sweet varieties); 18–24 months (bitter/starch varieties)",
            steps: [
              "Harvest by pulling or using a mechanical lifter on large farms.",
              "Cut stems to 15 cm above ground; process within 24–48 hours (roots deteriorate quickly).",
              "Stagger harvest over weeks if selling fresh to avoid market glut.",
              "Root size indicator: roots should be ≥3 cm diameter for good yield.",
            ],
          },
          postHarvest: {
            title: "Processing",
            duration: "Immediate — roots deteriorate within 48–72 hours",
            steps: [
              "Peel and wash within 24 hours of harvest to prevent post-harvest deterioration.",
              "Grate, press, and ferment for 'garri' (West Africa) or 'ugali wa muhogo'.",
              "Sun-dry chips or flour on clean raised platforms for 3–5 days.",
              "Target moisture: 12–14% for dried chips or flour.",
            ],
          },
          preservation: {
            title: "Storage",
            duration: "Fresh: 48 hours; Dried chips/flour: 6–12 months",
            steps: [
              "Store dried cassava chips in airtight jute or polypropylene sacks in cool, dry stores.",
              "Wax coating with paraffin wax extends fresh root shelf life to 1–2 weeks for transport.",
              "Cyanogenic (bitter) cassava must be processed (fermentation, soaking) before consumption.",
              "Store flour in moisture-proof bags; inspect for weevils and mould monthly.",
            ],
          },
        },
        pests: [
          {
            name: "Cassava Mosaic Disease (CMD)",
            sign: "Yellow-green mosaic pattern on leaves; distorted, small leaves.",
            control: "Use CMD-resistant varieties (TME419, Okoli/Obaseki); rogue infected plants early; use healthy stem cuttings only.",
          },
          {
            name: "Cassava Mealybug (Phenacoccus manihoti)",
            sign: "White waxy clusters on growing tips; stunted, bunchy growth.",
            control: "Release natural enemy Anagyrus lopezi (biological control); avoid chemical sprays to protect natural predators.",
          },
          {
            name: "Cassava Green Mite (Mononychellus tanajoa)",
            sign: "Pale stippling on upper leaf surface; angular leaf shape.",
            control: "Release predatory mite Typhlodromalus aripo; avoid water stress.",
          },
          {
            name: "Cassava Brown Streak Disease (CBSD)",
            sign: "Yellow streaking on leaves; brown necrosis in root flesh.",
            control: "Use CBSD-tolerant varieties; strictly use virus-free planting material.",
          },
        ],
        yieldTips: [
          "Harvest on time — late harvest does not increase yield but exposes roots to field rot.",
          "Process immediately after harvest — fresh roots lose 30% quality within 3 days.",
          "Intercrop with cowpea or groundnut to maximise land use in first 3 months.",
          "Retain healthy stems from good-yielding plants for the next planting season.",
        ],
        marketInfo: "Fresh roots: $30–80/MT. Garri: $200–400/MT. Dried chips for starch industry: $120–180/MT. HQCF (High Quality Cassava Flour) for wheat substitution earns premium prices.",
      },

      {
        name: "Sorghum",
        icon: "🌾",
        scientificName: "Sorghum bicolor",
        regions: ["Sahel", "West Africa", "East Africa", "Southern Africa"],
        soilType: "Clay to sandy-loam, pH 5.5–7.5; drought-tolerant on shallow soils",
        temperatureRange: "25–40 °C (highly heat-tolerant)",
        rainfall: "300–700 mm/year",
        irrigationNeeded: false,
        yieldPerHectare: "0.5–2 t/ha (dryland); 4–8 t/ha (irrigated)",
        phases: {
          landPrep: {
            title: "Land Preparation",
            duration: "2–3 weeks",
            steps: [
              "Minimum tillage preferred in Sahel to conserve moisture and reduce erosion.",
              "Zaï pit planting: dig 20×20×15 cm pits at 80×80 cm spacing; fill with compost.",
              "Conventional: plough to 20 cm; harrow to fine seed-bed.",
              "Spacing: 75×20 cm (60,000 plants/ha).",
            ],
          },
          planting: {
            title: "Planting",
            duration: "At first reliable rains (Jun–Jul in Sahel)",
            steps: [
              "Use improved varieties: SAMSORG-17 (Nigeria), Macia (Southern Africa), ICSR196.",
              "Sow 2–3 seeds/hole at 3–5 cm depth; thin to 1–2 plants.",
              "Apply microdosing: 6 g DAP per planting hole at sowing.",
              "Mix seed with ash before planting to deter soil insects.",
            ],
          },
          growth: {
            title: "Crop Management",
            duration: "90–130 days",
            steps: [
              "Weed at 2–3 weeks and 5–6 weeks — Striga weed control is critical.",
              "Top-dress with urea (30 kg/ha) at knee-high stage.",
              "Monitor for Striga (witch weed) emergence from 3 weeks; remove before flowering.",
              "Apply imidacloprid seed treatment to reduce aphid vectors.",
            ],
          },
          harvest: {
            title: "Harvesting",
            duration: "90–130 days (heads turn brown and dry)",
            steps: [
              "Harvest when grain has firm dough texture or fully mature (black layer).",
              "Cut heads with sickle; leave 30 cm stalk for ratoon crop potential.",
              "Thresh by beating on hard surface or mechanical thresher.",
              "Dry grain to 12–13% moisture for safe storage.",
            ],
          },
          postHarvest: {
            title: "Drying & Threshing",
            duration: "5–10 days",
            steps: [
              "Sun-dry heads on raised platforms or tarpaulins for 5–7 days.",
              "Thresh and winnow to remove chaff.",
              "Grade by removing shriveled, discoloured grains.",
            ],
          },
          preservation: {
            title: "Storage",
            duration: "12–24 months at 13% moisture",
            steps: [
              "Store in clay pots, metal silos, or PICS bags — excellent long-term storage grain.",
              "Apply Actellic Super or mix with neem leaves/ash for insect protection.",
              "Sorghum stores better than maize in humid conditions due to tannin content.",
              "Inspect monthly; aerate stored grain every 2 months.",
            ],
          },
        },
        pests: [
          {
            name: "Striga (Witch Weed)",
            sign: "Parasitic weed emerging around sorghum roots; purple-pink flowers; severe stunting.",
            control: "Use Striga-resistant varieties (SAMSORG-14); apply Imazapyr herbicide seed coating; crop rotation with cotton or groundnuts.",
          },
          {
            name: "Sorghum Shoot Fly (Atherigona soccata)",
            sign: "Dead heart in seedlings; white larvae inside stalk base.",
            control: "Early planting; apply Carbofuran granules in whorl; use tolerant varieties.",
          },
          {
            name: "Grain Mould (Fusarium spp.)",
            sign: "Pink or white mould on heads at late grain-filling.",
            control: "Harvest on time; use mould-tolerant varieties; avoid lodging.",
          },
        ],
        yieldTips: [
          "Zaï pits increase yield 3–5× in Sahel dryland conditions vs. flat planting.",
          "Striga control is the single biggest yield limiter in savanna zones — address early.",
          "Ratoon cropping (allowing regrowth after harvest) gives a second crop with minimal input.",
          "Sorghum for brewing (traditional beer) fetches 30–50% premium over food sorghum.",
        ],
        marketInfo: "Grain: $150–250/MT. Used for food (tô, ugali, injera), brewing, and animal feed. High demand from animal feed compounders and maltsters.",
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 3 — VEGETABLES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "vegetables",
    name: "Vegetables",
    icon: "🥬",
    description: "High-value horticultural vegetables for domestic markets and export.",
    crops: [
      {
        name: "Tomato",
        icon: "🍅",
        scientificName: "Solanum lycopersicum",
        regions: ["West Africa", "East Africa", "Southern Africa", "Coastal Africa"],
        soilType: "Well-drained sandy-loam, pH 6.0–7.0, high organic matter",
        temperatureRange: "18–28 °C (cool nights improve fruit set)",
        rainfall: "600–1,200 mm (prefer irrigation for quality)",
        irrigationNeeded: true,
        yieldPerHectare: "15–25 t/ha (open field); 40–80 t/ha (greenhouse/irrigated)",
        phases: {
          landPrep: {
            title: "Land Preparation",
            duration: "3–4 weeks",
            steps: [
              "Deep plough to 30 cm; ridge or bed to ensure excellent drainage.",
              "Apply 20–30 t/ha well-decomposed compost; incorporate with rotary tiller.",
              "Basal fertiliser: apply NPK 17:17:17 at 300 kg/ha.",
              "Raise beds to 20 cm height for root development and drainage.",
            ],
          },
          planting: {
            title: "Nursery & Transplanting",
            duration: "Nursery: 3–4 weeks; transplant at 15–20 cm height",
            steps: [
              "Use improved varieties: Marglobe, Nuru F1, Tengeru 97, Mongal F1.",
              "Sow in sterilised nursery medium (soil:sand:compost 2:1:1).",
              "Transplant 25–30 day old seedlings at 75×50 cm spacing.",
              "Water immediately after transplanting; shade for first 3–5 days.",
            ],
          },
          growth: {
            title: "Crop Management",
            duration: "60–90 days from transplanting",
            steps: [
              "Stake plants at 4 weeks; use sisal string tied to overhead wire or bamboo.",
              "Prune to 2 stems (determinate) or single stem (indeterminate).",
              "Top-dress with CAN at 3 and 6 weeks; foliar spray with calcium nitrate for blossom end rot.",
              "Fertigate with diluted NPK if drip irrigation is available.",
            ],
          },
          harvest: {
            title: "Harvesting",
            duration: "Start at 60–75 days; harvest every 2–3 days",
            steps: [
              "Pick at mature-green (for transport) or pink-red stage (for local markets).",
              "Harvest in the cool of morning; use plastic crates — not sacks.",
              "Avoid mechanical damage; sort out damaged or diseased fruits in field.",
              "Mature plants produce for 4–6 weeks under good management.",
            ],
          },
          postHarvest: {
            title: "Grading & Packing",
            duration: "Same day as harvest",
            steps: [
              "Grade by size and colour: extra large, large, medium, and cherry.",
              "Pack in ventilated plastic crates (15–20 kg) or wooden boxes.",
              "Pre-cool to 12–15°C within 2 hours of harvest for export.",
              "Wash in chlorinated water (50 ppm) before packing for export.",
            ],
          },
          preservation: {
            title: "Storage",
            duration: "Mature green: 2–3 weeks at 12°C; Ripe: 5–10 days at 8°C",
            steps: [
              "Store in evaporative cool room (zero-energy brick cooler) for 2 weeks.",
              "Separate ripe from green to avoid ethylene-induced over-ripening.",
              "Processing: sun-dry slices for 3–5 days for tomato paste/powder.",
              "Canning and tomato paste production for long shelf life (12–24 months).",
            ],
          },
        },
        pests: [
          {
            name: "Tuta absoluta (Tomato Leafminer)",
            sign: "Serpentine mines in leaves; blotch mines in fruit; larvae in fruits.",
            control: "Use pheromone traps (1/50 m2); apply Spinosad or Chlorantraniliprole; cover crops with insect-proof nets.",
          },
          {
            name: "Early Blight (Alternaria solani)",
            sign: "Brown concentric ring lesions on lower leaves; defoliation.",
            control: "Spray Mancozeb or Chlorothalonil at 7–10 day intervals; practice crop rotation.",
          },
          {
            name: "Tomato Yellow Leaf Curl Virus (TYLCV)",
            sign: "Yellowing, curling upward of leaves; stunted plants; no fruit set.",
            control: "Use TYLCV-resistant varieties (Nuru F1, Lycopersicum); control whitefly vectors with neem oil or Imidacloprid.",
          },
          {
            name: "Root Knot Nematode (Meloidogyne spp.)",
            sign: "Galls on roots; stunted growth; wilt in hot weather.",
            control: "Solarise soil before planting; apply Nemacur or carbofuran; use grafted tomato on nematode-resistant rootstock.",
          },
        ],
        yieldTips: [
          "Drip irrigation increases yield 30–50% vs. flood irrigation while reducing leaf diseases.",
          "Calcium nitrate foliar spray at fruit-set prevents blossom end rot.",
          "Never spray pesticides within 7 days of harvest for export markets.",
          "Crop rotation every 2 seasons reduces Fusarium wilt and nematode buildup.",
        ],
        marketInfo: "Fresh tomato: $0.20–0.60/kg (farmgate). Export (cherry tomato): $1.5–3.0/kg. Peak prices in off-season (dry season under irrigation). Paste processing: $0.10–0.15/kg raw fruit.",
      },

      {
        name: "Kale / Sukuma Wiki",
        icon: "🥬",
        scientificName: "Brassica oleracea var. acephala",
        regions: ["East Africa", "Central Africa", "Southern Africa"],
        soilType: "Fertile, well-drained loam, pH 6.0–7.5",
        temperatureRange: "15–25 °C (cool weather improves leaf quality)",
        rainfall: "500–900 mm; tolerates dry spells with irrigation",
        irrigationNeeded: true,
        yieldPerHectare: "20–40 t/ha (multiple harvests over 3–6 months)",
        phases: {
          landPrep: {
            title: "Land Preparation",
            duration: "2 weeks",
            steps: [
              "Dig or till to 20–30 cm; apply 15 t/ha compost.",
              "Make raised beds 1 m wide, 30 cm height; irrigate before transplanting.",
              "Spacing: 60×45 cm (37,000 plants/ha) for leaf kale.",
              "Apply 200 kg/ha NPK 17:17:17 as basal dressing.",
            ],
          },
          planting: {
            title: "Nursery & Transplanting",
            duration: "Nursery 3–4 weeks; transplant at 4–6 leaf stage",
            steps: [
              "Use Thousand Headed or Collard varieties; newer hybrids Groundforce F1.",
              "Sow 2–3 seeds in nursery tray cells or seedbed rows.",
              "Transplant at 4-leaf stage; water in the evening.",
              "Mulch to retain moisture and suppress weeds.",
            ],
          },
          growth: {
            title: "Crop Management",
            duration: "45–60 days to first harvest; continues 4–6 months",
            steps: [
              "Top-dress with CAN at 30 g/m2 every 3–4 weeks after each harvest.",
              "Irrigate every 3–4 days in dry season.",
              "Weed weekly for first 6 weeks; then crop canopy suppresses weeds.",
              "Foliar spray with micronutrients (zinc, boron) monthly.",
            ],
          },
          harvest: {
            title: "Harvesting",
            duration: "Harvest leaves from outside in; first harvest at 45–60 days",
            steps: [
              "Snap or cut outer leaves leaving 4–6 inner leaves for continued growth.",
              "Harvest every 7–14 days — frequent harvest increases total yield.",
              "Bundle 12–15 leaves per bunch; pack in banana leaves for market.",
              "Early morning harvest retains freshness for 24–36 hours.",
            ],
          },
          postHarvest: {
            title: "Handling",
            duration: "Market within 24 hours of harvest",
            steps: [
              "Dip in clean cold water to reduce temperature and maintain crispness.",
              "Pack upright (like flowers) in boxes with wet cloth at base.",
              "Do not wash until just before selling — washing reduces shelf life.",
            ],
          },
          preservation: {
            title: "Storage",
            duration: "Fresh: 3–5 days at 0–5°C; Dried: 6–12 months",
            steps: [
              "Refrigerate at 0–5°C in high-humidity storage.",
              "Blanch and dry in solar dryer for 8–12 hours for dried kale product.",
              "Dry kale is gaining market in urban centres as vegetable flour.",
            ],
          },
        },
        pests: [
          {
            name: "Diamondback Moth (Plutella xylostella)",
            sign: "Small holes in leaves; caterpillars on leaf underside; 'window pane' damage.",
            control: "Spray Bt (Bacillus thuringiensis); use Spinosad; avoid synthetic pyrethroids (resistance is common).",
          },
          {
            name: "Aphids (Brevicoryne brassicae)",
            sign: "Clusters of grey-green aphids on growing tips and undersides; sticky honeydew.",
            control: "Spray neem extract (50 ml/L) or insecticidal soap; introduce ladybirds (natural predators).",
          },
          {
            name: "Black Rot (Xanthomonas campestris)",
            sign: "V-shaped yellow lesions from leaf margins; black veins; rotting stalk.",
            control: "Use disease-free seed; spray copper oxychloride; avoid overhead irrigation.",
          },
        ],
        yieldTips: [
          "Apply nitrogen after every harvest to maintain leaf quality and dark green colour.",
          "Grow in cool season or highland areas for premium quality leaves.",
          "Intercrop with tomato or pepper to maximise use of irrigation infrastructure.",
          "Market bunching: neat, uniform bundles sell 20–40% faster than loose leaves.",
        ],
        marketInfo: "Bundle of 12–15 leaves: KES 10–30 (Kenya), TZS 500–1,500 (Tanzania). Bulk: $0.10–0.25/kg farmgate. Urban demand is consistent year-round — key staple vegetable.",
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 4 — LEGUMES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "legumes",
    name: "Legumes",
    icon: "🫘",
    description: "Nitrogen-fixing protein crops that improve soil health while providing food and income.",
    crops: [
      {
        name: "Groundnut (Peanut)",
        icon: "🥜",
        scientificName: "Arachis hypogaea",
        regions: ["West Africa", "East Africa", "Sahel", "Southern Africa"],
        soilType: "Sandy-loam, well-drained, pH 5.5–6.5; high calcium needed at pod formation",
        temperatureRange: "25–30 °C",
        rainfall: "500–1,000 mm/season",
        irrigationNeeded: false,
        yieldPerHectare: "0.8–2 t/ha (unshelled); 4–6 t/ha (improved irrigated)",
        phases: {
          landPrep: {
            title: "Land Preparation",
            duration: "2–3 weeks",
            steps: [
              "Till to 20 cm; sandy soils need minimum tillage to prevent erosion.",
              "Do NOT apply heavy nitrogen — groundnut fixes its own nitrogen.",
              "Apply gypsum (calcium sulphate) at 250 kg/ha for pod formation.",
              "Spacing: 60×10 cm (150,000 plants/ha) for bunch types; 45×10 cm for creeping.",
            ],
          },
          planting: {
            title: "Planting",
            duration: "At onset of rains (May–Jun; Oct–Nov)",
            steps: [
              "Use improved varieties: Samnut-24 (Nigeria), ICGV91114 (ICRISAT), Chalimbana (Southern Africa).",
              "Inoculate seed with Rhizobium if planting groundnut for first time on that land.",
              "Plant seeds from pods (not fully de-shelled) for higher germination.",
              "Depth: 5 cm; firmed soil contact essential for germination.",
            ],
          },
          growth: {
            title: "Crop Management",
            duration: "90–120 days",
            steps: [
              "Weed at 3–4 weeks (critical period); hand weed only after pegging to avoid disturbing pegs.",
              "Top-dress with phosphate (SSP) at 150 kg/ha if soil is phosphorus deficient.",
              "Mound soil toward plant base at 6 weeks to facilitate peg penetration.",
              "Do NOT walk between rows after pegging — compaction prevents pod formation.",
            ],
          },
          harvest: {
            title: "Harvesting",
            duration: "90–120 days (inner skin of pod turns brown at maturity)",
            steps: [
              "Test-harvest 5 plants; peel pod — inner skin should be pink-red.",
              "Lift plants by hand or with groundnut lifter in sandy soils.",
              "Invert plants and windrow for 4–5 days to field-dry.",
              "Thresh by hand or machine after field drying.",
            ],
          },
          postHarvest: {
            title: "Drying",
            duration: "Dry pods to 8–9% moisture",
            steps: [
              "Dry pods on raised clean platforms for 7–10 days after threshing.",
              "Sun drying: spread in single layer, turn twice daily.",
              "Mechanical drying at 40°C max to avoid killing seed viability.",
              "Test: bite grain — should snap clean, not be chewy.",
            ],
          },
          preservation: {
            title: "Storage",
            duration: "6–12 months at 8% moisture",
            steps: [
              "Store in well-ventilated bins or PICS hermetic bags at <12% moisture.",
              "Apply neem seed powder as natural insect repellent.",
              "CRITICAL: Never store wet groundnut — aflatoxin contamination is severe health hazard.",
              "Test for aflatoxin before sale to large buyers; reject batches >20 ppb.",
            ],
          },
        },
        pests: [
          {
            name: "Aflatoxin (Aspergillus flavus/parasiticus)",
            sign: "Invisible mould on improperly dried/stored pods; causes liver cancer in humans.",
            control: "Harvest on time; dry to 8–9% immediately; apply Aflasafe biocontrol in field; hermetic storage.",
          },
          {
            name: "Rosette Virus (Groundnut Rosette)",
            sign: "Chlorotic mosaic or dark green mosaic pattern; severe stunting; no pod formation.",
            control: "Use resistant varieties (ICGV-91114, Samnut-24); plant early; control aphid vectors with Imidacloprid seed treatment.",
          },
          {
            name: "Late Leaf Spot (Cercosporidium personatum)",
            sign: "Dark brown circular spots on both leaf surfaces; defoliation.",
            control: "Spray Chlorothalonil or Mancozeb at 14-day intervals from 30 days; use tolerant varieties.",
          },
        ],
        yieldTips: [
          "Never delay harvest — late harvest dramatically increases aflatoxin risk.",
          "Gypsum application at pegging stage increases pod number by 20–30%.",
          "Intercrop with sorghum or millet to maximise total land productivity.",
          "Confectionery groundnuts (large-seeded types) fetch 2–3× higher price than oil types.",
        ],
        marketInfo: "Unshelled: $250–400/MT. Groundnut oil: $900–1,200/MT. Confectionery (roasted/flavoured): premium urban market. Aflatoxin testing required for all export sales.",
      },

      {
        name: "Common Bean",
        icon: "🫘",
        scientificName: "Phaseolus vulgaris",
        regions: ["East Africa", "Central Africa", "Southern Africa"],
        soilType: "Well-drained loam, pH 6.0–7.0; avoid waterlogged soils",
        temperatureRange: "16–25 °C",
        rainfall: "300–600 mm/season",
        irrigationNeeded: false,
        yieldPerHectare: "0.5–1.5 t/ha (local); 2–3 t/ha (improved + fertiliser)",
        phases: {
          landPrep: {
            title: "Land Preparation",
            duration: "1–2 weeks",
            steps: [
              "Minimum tillage or ox-plough to 15 cm.",
              "Avoid excess nitrogen — beans fix their own nitrogen.",
              "Apply 100 kg/ha DAP (phosphate) as basal.",
              "Spacing: 40×10 cm (250,000 plants/ha).",
            ],
          },
          planting: {
            title: "Planting",
            duration: "Early in rainy season; avoid planting in heavy rains",
            steps: [
              "Use improved varieties: Lyamungu 85, Jesca (Tanzania), RWR2245 (Rwanda/Uganda).",
              "Inoculate with Rhizobium on new fields.",
              "Plant 2 seeds/hole at 4 cm depth.",
              "Never plant in soils with standing water.",
            ],
          },
          growth: {
            title: "Crop Management",
            duration: "60–90 days",
            steps: [
              "Weed at 3 and 5 weeks.",
              "Top-dress with potassium (30 kg/ha muriate of potash) at flowering.",
              "Avoid waterlogging — bean roots are highly sensitive.",
            ],
          },
          harvest: {
            title: "Harvesting",
            duration: "60–90 days (pods dry and turn brown)",
            steps: [
              "Pull or cut whole plants at 80% pod maturity.",
              "Windrow for 7 days; thresh by beating on tarpaulin.",
              "Winnow to remove chaff; grade to remove shriveled, discoloured seed.",
            ],
          },
          postHarvest: {
            title: "Drying",
            duration: "Dry to 12–13% moisture",
            steps: [
              "Sun-dry threshed beans on tarpaulin for 3–4 days.",
              "Do not over-dry — seed coat cracks, reducing market quality.",
              "Sort by size and colour; remove stones manually.",
            ],
          },
          preservation: {
            title: "Storage",
            duration: "6–12 months at 12% moisture",
            steps: [
              "Store in PICS bags or hermetic drums to control bean weevil.",
              "Apply 1 teaspoon Actellic Super per 20 kg bag or use 3-bag PICS system.",
              "Keep in cool, dry store away from light.",
              "Inspect every 4–6 weeks for weevil damage or mould.",
            ],
          },
        },
        pests: [
          {
            name: "Bean Stem Maggot (Ophiomyia spp.)",
            sign: "Yellowing seedlings; white maggots in swollen stem base.",
            control: "Seed treatment with Imidacloprid; spray at 10 days; plant on time.",
          },
          {
            name: "Bean Weevil (Acanthoscelides obtectus)",
            sign: "Small round holes in stored beans; adult weevils; powdery frass.",
            control: "Hermetic storage; apply Phostoxin tablets in sealed stores; solar heating treatment.",
          },
          {
            name: "Angular Leaf Spot (Phaeoisariopsis griseola)",
            sign: "Angular, dark grey-brown leaf lesions along veins; defoliation.",
            control: "Use resistant varieties; spray Mancozeb; practice crop rotation.",
          },
        ],
        yieldTips: [
          "Early planting at onset of rains reduces Bean Stem Maggot damage by 50%.",
          "Mixed colours of beans fetch different prices — grow market-preferred types per region.",
          "Climbing beans yield 2–3× more than bush beans with minimal extra input.",
          "Store in hermetic bags immediately after threshing to prevent weevil entry.",
        ],
        marketInfo: "Local: $0.40–0.80/kg. Export to EU/North America (organic): $1.20–2.00/kg. Demand is consistent year-round as a protein staple crop.",
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY 5 — FRUITS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "fruits",
    name: "Fruits",
    icon: "🍍",
    description: "Tropical and subtropical fruits with strong domestic and export potential.",
    crops: [
      {
        name: "Mango",
        icon: "🥭",
        scientificName: "Mangifera indica",
        regions: ["West Africa", "East Africa", "Sahel", "Coastal Africa", "Southern Africa"],
        soilType: "Deep, well-drained sandy-loam to loam, pH 5.5–7.5",
        temperatureRange: "24–30 °C (dry spell needed for flowering)",
        rainfall: "750–2,500 mm (needs dry period to induce flowering)",
        irrigationNeeded: false,
        yieldPerHectare: "5–10 t/ha (local seedlings); 20–40 t/ha (grafted improved varieties)",
        phases: {
          landPrep: {
            title: "Land Preparation",
            duration: "3–6 months before planting",
            steps: [
              "Select deep soils with no hard pan within 1.5 m depth.",
              "Clear land; dig planting holes 1×1×1 m; fill with topsoil + 20 kg compost.",
              "Spacing: 10×10 m (100 trees/ha); higher density 7×7 m for hedgerow orchards.",
              "Install windbreaks on exposed sides.",
            ],
          },
          planting: {
            title: "Planting",
            duration: "At start of rains; grafted seedlings planted year-round with irrigation",
            steps: [
              "Use grafted improved varieties: Kent, Tommy Atkins (export); Ngowe, Apple (local/processing).",
              "Plant 6–12 month grafted seedlings; do not plant polythene-rootbound seedlings.",
              "Plant in early rains for establishment; water weekly in dry season for 2 years.",
              "Stake young trees to protect from wind.",
            ],
          },
          growth: {
            title: "Orchard Management",
            duration: "3–4 years to first crop (then annual)",
            steps: [
              "Apply NPK 17:17:17 at 500 g/tree at 3 and 9 months.",
              "Increase fertiliser annually: year 5 onwards, 2–5 kg NPK + 20 kg compost/tree.",
              "Formative pruning in years 1–3 to develop strong framework.",
              "Maintain 3–5 main branches; remove diseased and crossing branches after harvest.",
            ],
          },
          harvest: {
            title: "Harvesting",
            duration: "Mainly Oct–Mar depending on variety and region",
            steps: [
              "Test maturity: cut one fruit — flesh should be creamy-yellow, not white/starchy.",
              "Pick with 10 cm stem attached using picking pole with net basket.",
              "Avoid latex drip on fruit — causes latex burn; cut at angle, let drip.",
              "Handle fruit carefully; do not drop or throw into bins.",
            ],
          },
          postHarvest: {
            title: "Grading & Packing",
            duration: "Within 4 hours of harvest",
            steps: [
              "Grade: extra class (>550 g), class I (400–550 g), class II (300–400 g).",
              "Wash in 52°C hot water for 5 min (hot water treatment for export) to kill fruit fly larvae.",
              "Pack in single-layer vented cartons (4 kg) for export; crates for local market.",
              "Apply ProTabs ethylene sachets for ripening control in transit.",
            ],
          },
          preservation: {
            title: "Storage",
            duration: "Mature-green: 3–5 weeks at 13°C; Ripe: 1–2 weeks at 8°C",
            steps: [
              "Cold store at 13°C (chilling injury below 10°C).",
              "Processing: sun-dried slices (40% sugar content — good for snacks).",
              "Mango juice/pulp: high-pressure processing for 12-month shelf life.",
              "Dried mango export fetches $2.00–5.00/kg vs. $0.10–0.30/kg fresh.",
            ],
          },
        },
        pests: [
          {
            name: "Mango Fruit Fly (Ceratitis cosyra)",
            sign: "Soft spots on ripe fruit; maggots inside; premature fruit drop.",
            control: "Protein bait spray (GF-120) + Malathion weekly; fruit bagging at marble stage; field sanitation.",
          },
          {
            name: "Powdery Mildew (Oidium mangiferae)",
            sign: "White powdery coating on flowers and young fruits; blossom drop.",
            control: "Spray wettable sulphur or Hexaconazole at flower emergence; 3 applications at 10-day intervals.",
          },
          {
            name: "Anthracnose (Colletotrichum gloeosporioides)",
            sign: "Black sunken lesions on fruit; blossom blight in wet weather.",
            control: "Pre-harvest Mancozeb sprays; post-harvest hot water treatment; proper ventilation in storage.",
          },
        ],
        yieldTips: [
          "Grafted trees yield 5–10× more than seedling trees — always invest in improved planting material.",
          "Smoke treatment or potassium nitrate foliar spray induces uniform flowering out-of-season.",
          "Fruit thinning (remove 50% of fruits at marble stage) doubles remaining fruit size.",
          "Export certification (GlobalGAP) unlocks EU market at 3–5× local prices.",
        ],
        marketInfo: "Local fresh: $0.10–0.30/kg. Export (air freight): $1.50–3.00/kg. Dried mango: $3.00–6.00/kg. Pulp/juice: $0.50–0.80/kg. Peak prices May–Jul when supply is lower.",
      },

      {
        name: "Banana / Plantain",
        icon: "🍌",
        scientificName: "Musa acuminata / Musa paradisiaca",
        regions: ["Central Africa", "East Africa", "West Africa", "Coastal Africa"],
        soilType: "Deep, fertile, well-drained loam with high organic matter, pH 5.5–7.0",
        temperatureRange: "22–28 °C",
        rainfall: "1,000–2,500 mm/year (well distributed)",
        irrigationNeeded: true,
        yieldPerHectare: "20–40 t/ha (bunch weight); 60+ t/ha with high-density + irrigation",
        phases: {
          landPrep: {
            title: "Land Preparation",
            duration: "4–6 weeks",
            steps: [
              "Select deep soils >1 m with no hard pan; banana is wind-sensitive — avoid exposed sites.",
              "Dig planting holes 60×60×60 cm; fill with 10 kg compost + topsoil.",
              "Spacing: 3×3 m (1,100 mats/ha) for dessert banana; 2×2 m for plantain.",
              "Windbreaks essential — banana lodges easily in strong winds.",
            ],
          },
          planting: {
            title: "Planting",
            duration: "Year-round where irrigation is available; start of rains otherwise",
            steps: [
              "Plant tissue culture plantlets (TCPs) for disease-free establishment: FHIA-01, Williams, Cavendish.",
              "Or plant sword suckers (30 cm tall, narrow base) from certified clean mother plants.",
              "Treat suckers in hot water (55°C, 25 min) to kill nematodes before planting.",
              "Plant at correct depth — corm top 10 cm below surface.",
            ],
          },
          growth: {
            title: "Crop Management",
            duration: "9–12 months to first bunch",
            steps: [
              "Fertilise monthly: 200 g NPK 17:17:17 per mat at 2 months; increase to 500 g at 6 months.",
              "Keep 1 mother plant + 1 follower sucker + 1 ratoon — remove all others.",
              "Desuckering is critical: excess suckers reduce bunch weight by 30–40%.",
              "Weed monthly; mulch heavily (10 cm) with crop residues or straw.",
            ],
          },
          harvest: {
            title: "Harvesting",
            duration: "9–12 months (bananas 75–80% filled for export; 90% for local)",
            steps: [
              "Cut bunch when fingers are 75% full (round-shouldered for Cavendish export).",
              "Support bunch with a forked pole before cutting stalk.",
              "Cut stalk 30 cm from bunch crown.",
              "Carry on padded shoulder to de-handing area — avoid bruising.",
            ],
          },
          postHarvest: {
            title: "De-handing & Packing",
            duration: "Within 4 hours of harvest",
            steps: [
              "De-hand and trim cluster stems with clean knife.",
              "Wash hands in 200 ppm chlorinated water; float in water bath.",
              "Grade: 19–22 cm length, no latex scarring, no peel defects.",
              "Pack in 13 kg cartons with polyethylene liner and ethylene absorber sachet.",
            ],
          },
          preservation: {
            title: "Ripening & Storage",
            duration: "Green for export: 6 weeks at 13°C; Ripe: 5–7 days",
            steps: [
              "Ripen with ethylene gas (100–150 ppm) at 16–18°C for 24–48 hours.",
              "Store ripe at 12–14°C in high humidity.",
              "Processing: banana chips (kiln-dried at 70°C), flour, beer.",
              "Plantain: sun-dried 'dodo' chips, fufu, and cooking banana flour.",
            ],
          },
        },
        pests: [
          {
            name: "Banana Weevil (Cosmopolites sordidus)",
            sign: "Galleries in corm; plant topples easily; yellowing lower leaves.",
            control: "Peel traps at base; apply Carbofuran granules; use weevil-free suckers or TCPs.",
          },
          {
            name: "Fusarium Wilt (Panama Disease / TR4)",
            sign: "Yellowing of older leaves from outside; brown discolouration in pseudostem.",
            control: "No chemical cure. Use TR4-resistant varieties (FHIA-01, GCTCV-219); never move infected soil; strict biosecurity.",
          },
          {
            name: "Black Sigatoka (Mycosphaerella fijiensis)",
            sign: "Black streaks expanding to dark lesions on leaves; premature leaf death.",
            control: "Spray systemic fungicides (Propiconazole) on 14-day schedule; remove old leaves monthly.",
          },
          {
            name: "Banana Bunchy Top Virus (BBTV)",
            sign: "Dark green streaks on midrib; bunchy, stunted rosette growth at top.",
            control: "Rogue infected plants immediately; control aphid vector (Pentalonia); use certified TCP planting material.",
          },
        ],
        yieldTips: [
          "Tissue culture plantlets yield 30–50% more than sucker-planted bananas in year 1.",
          "Propping bunches at 7 months prevents lodging and bunch damage.",
          "Regular fertilisation is the biggest yield driver — skipping a month can cost 20–30% of bunch weight.",
          "Never plant bananas where the crop has been in the last 3 years — nematode buildup is severe.",
        ],
        marketInfo: "Export Cavendish: $0.35–0.55/kg FOB. Local fresh: $0.10–0.25/kg. Plantain (cooking): $0.15–0.35/kg. Banana flour: $0.80–1.20/kg. Dried banana chips: $1.50–3.00/kg.",
      },
    ],
  },
];

// ─── COMPONENT ────────────────────────────────────────────────────────────────

const REGIONS: Region[] = [
  "All Africa",
  "West Africa",
  "East Africa",
  "Central Africa",
  "Southern Africa",
  "Sahel",
  "Coastal Africa",
];

export default function CropProduction() {
  const [activeCategory, setActiveCategory] = useState(cropCategories[0].id);
  const [expandedCrop, setExpandedCrop] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<Region>("All Africa");
  const [activeTab, setActiveTab] = useState<"lifecycle" | "pests" | "tips">("lifecycle");

  const currentMonth = new Date().getMonth() + 1;
  const season = getCurrentSeason(currentMonth);
  const category = cropCategories.find((c) => c.id === activeCategory)!;

  const filteredCrops = category.crops.filter((crop) =>
    selectedRegion === "All Africa" ? true : crop.regions.includes(selectedRegion)
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Crop Production</h1>
            <Badge variant="secondary" className="text-xs">
              {season.type === "rainy" ? "🌧️" : "☀️"} {season.name}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Full lifecycle guide: Production → Harvest → Preservation · Pest control included
          </p>
        </div>

        {/* Region Selector */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {REGIONS.map((region) => (
            <button
              key={region}
              onClick={() => setSelectedRegion(region)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedRegion === region
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {region}
            </button>
          ))}
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {cropCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setActiveCategory(cat.id); setExpandedCrop(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mb-4">{category.description}</p>

        {/* Crop List */}
        <div className="space-y-3">
          {filteredCrops.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No crops available for {selectedRegion}.</p>
            </div>
          )}

          {filteredCrops.map((crop) => {
            const isExpanded = expandedCrop === crop.name;
            return (
              <div key={crop.name} className="bg-card border border-border rounded-xl overflow-hidden">

                {/* Crop Header */}
                <button
                  onClick={() => { setExpandedCrop(isExpanded ? null : crop.name); setActiveTab("lifecycle"); }}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{crop.icon}</span>
                    <div>
                      <p className="font-semibold text-foreground">{crop.name}</p>
                      <p className="text-xs text-muted-foreground italic">{crop.scientificName}</p>
                      <p className="text-xs text-muted-foreground">
                        📊 {crop.yieldPerHectare.split(";")[0]}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {crop.irrigationNeeded && (
                      <Badge variant="outline" className="text-xs">💧 Irrigation</Badge>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-border">

                    {/* Inner Tab Bar */}
                    <div className="flex border-b border-border bg-muted/30">
                      {(["lifecycle", "pests", "tips"] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors ${
                            activeTab === tab
                              ? "bg-background border-b-2 border-primary text-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {tab === "lifecycle" && "🌱 Lifecycle"}
                          {tab === "pests" && "🐛 Pest Control"}
                          {tab === "tips" && "💡 Yield Tips"}
                        </button>
                      ))}
                    </div>

                    <div className="p-4 space-y-4">

                      {/* Quick Stats */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-muted/50 p-2.5 rounded-lg">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Thermometer className="h-3 w-3" /> Temperature
                          </p>
                          <p className="text-xs font-medium mt-0.5">{crop.temperatureRange}</p>
                        </div>
                        <div className="bg-muted/50 p-2.5 rounded-lg">
                          <p className="text-xs text-muted-foreground">🌧️ Rainfall</p>
                          <p className="text-xs font-medium mt-0.5">{crop.rainfall}</p>
                        </div>
                        <div className="bg-muted/50 p-2.5 rounded-lg col-span-2">
                          <p className="text-xs text-muted-foreground">🪨 Soil Type</p>
                          <p className="text-xs font-medium mt-0.5">{crop.soilType}</p>
                        </div>
                      </div>

                      {/* LIFECYCLE TAB */}
                      {activeTab === "lifecycle" && (
                        <div className="space-y-3">
                          {Object.entries(crop.phases).map(([key, phase]) => {
                            const phaseIcons: Record<string, string> = {
                              landPrep: "🏗️",
                              planting: "🌱",
                              growth: "🌿",
                              harvest: "🌾",
                              postHarvest: "📦",
                              preservation: "🧊",
                            };
                            return (
                              <div key={key} className="bg-muted/30 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-base">{phaseIcons[key] || "📌"}</span>
                                  <div>
                                    <p className="text-xs font-semibold text-foreground">{phase.title}</p>
                                    <p className="text-xs text-muted-foreground">{phase.duration}</p>
                                  </div>
                                </div>
                                <ul className="space-y-1.5">
                                  {phase.steps.map((step, i) => (
                                    <li key={i} className="flex gap-2 text-xs text-foreground">
                                      <span className="text-primary font-bold flex-shrink-0">{i + 1}.</span>
                                      <span>{step}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* PEST CONTROL TAB */}
                      {activeTab === "pests" && (
                        <div className="space-y-3">
                          {crop.pests.map((pest, i) => (
                            <div key={i} className="border border-border rounded-lg overflow-hidden">
                              <div className="bg-destructive/10 px-3 py-2 flex items-center gap-2">
                                <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                                <p className="text-xs font-semibold text-foreground">{pest.name}</p>
                              </div>
                              <div className="p-3 space-y-2">
                                <div>
                                  <p className="text-xs text-muted-foreground font-medium">Signs / Symptoms:</p>
                                  <p className="text-xs text-foreground mt-0.5">{pest.sign}</p>
                                </div>
                                <div className="bg-primary/10 p-2 rounded">
                                  <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                    <ShieldCheck className="h-3 w-3" /> Control Measures:
                                  </p>
                                  <p className="text-xs text-foreground mt-0.5">{pest.control}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* YIELD TIPS TAB */}
                      {activeTab === "tips" && (
                        <div className="space-y-3">
                          <div className="space-y-2">
                            {crop.yieldTips.map((tip, i) => (
                              <div key={i} className="flex gap-2 bg-primary/10 p-2.5 rounded-lg">
                                <Leaf className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-foreground">{tip}</p>
                              </div>
                            ))}
                          </div>

                          <div className="border border-border rounded-lg p-3">
                            <p className="text-xs font-semibold text-foreground flex items-center gap-1 mb-1.5">
                              <Archive className="h-3.5 w-3.5" /> Market Information
                            </p>
                            <p className="text-xs text-muted-foreground">{crop.marketInfo}</p>
                          </div>

                          <div>
                            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                              <Sprout className="h-3 w-3" /> Best Growing Regions
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {crop.regions.map((r) => (
                                <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
