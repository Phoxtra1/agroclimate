import { useState } from "react";
import { Activity, AlertCircle, CheckCircle2, CloudRain, Mountain, Save, Sprout, Thermometer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { GeoPoint } from "@/services/satellite/navigation";
import { assessLandClimate, CROP_CLIMATE_REFERENCES, type LandClimateAssessment } from "@/services/satellite/landSuitability";
import { createGeoFeature, recordGeoObservation } from "@/services/satellite/geospatial";

interface Props {
  point: GeoPoint;
  pointLabel: string;
  fieldGeometry?: GeoJSON.Polygon | null;
  fieldAreaHa?: number;
}

function fitLabel(value: string) {
  if (value === "within_optimal_range") return "Within FAO EcoCrop optimal interval";
  if (value === "within_absolute_range_only") return "Within absolute interval only";
  if (value === "outside_absolute_range") return "Outside absolute interval";
  return "Insufficient data";
}

export function LandSuitabilityPanel({ point, pointLabel, fieldGeometry, fieldAreaHa }: Props) {
  const [assessment, setAssessment] = useState<LandClimateAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [crop, setCrop] = useState("Maize");
  const [error, setError] = useState("");
  const [savedFeatureId, setSavedFeatureId] = useState("");

  const selectedCrop = assessment?.cropScreens.find((item) => item.crop === crop);
  const run = async () => {
    setLoading(true);
    setError("");
    setAssessment(null);
    setSavedFeatureId("");
    try {
      const result = await assessLandClimate(point);
      setAssessment(result);
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "Land climate screening is unavailable.";
      setError(message);
      toast.error("Climate screening unavailable", { description: message });
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!assessment) return;
    setSaving(true);
    try {
      const geometry: GeoJSON.Geometry = fieldGeometry ?? {
        type: "Point",
        coordinates: [point.lon, point.lat],
      };
      const feature = await createGeoFeature({
        featureType: fieldGeometry ? "farm_boundary" : "other",
        name: fieldGeometry ? `Field boundary · ${pointLabel}` : `Climate screening · ${pointLabel}`,
        description: "Private user-saved spatial reference for a preliminary climate screen. Not a land title or full agronomic suitability certificate.",
        visibility: "private",
        geometry,
        properties: {
          assessment_type: assessment.assessmentType,
          selected_crop: crop,
          area_hectares: fieldAreaHa ?? null,
        },
        sourceName: "AgroClimate Satellite climate screening",
        dataQuality: "estimated",
      });
      await recordGeoObservation({
        featureId: feature.id,
        observationType: "preliminary_crop_climate_screen",
        sourceName: "NASA POWER Climatology / Copernicus DEM GLO-90 via Open-Meteo",
        sourceUrl: assessment.sources.map((source) => source.url).join(" | "),
        confidence: assessment.confidence === "moderate" ? 0.5 : 0.25,
        metrics: {
          coordinates: assessment.coordinates,
          elevation_m: assessment.elevationM,
          annual_mean_temperature_c: assessment.annualMeanTemperatureC,
          estimated_annual_rainfall_mm: assessment.estimatedAnnualRainfallMm,
          selected_crop: crop,
          crop_screen: selectedCrop ?? null,
          assessment_type: assessment.assessmentType,
        },
        evidence: {
          sources: assessment.sources,
          unavailable_evidence: assessment.unavailableEvidence,
          assessed_at: assessment.assessedAt,
          caveat: "Climate screen only. Soil, slope, water, crop cultivar, ownership and access are not verified.",
        },
      });
      setSavedFeatureId(feature.id);
      toast.success("Spatial assessment saved", { description: "Saved privately to the shared geospatial registry." });
    } catch (failure) {
      toast.error("Could not save the assessment", { description: failure instanceof Error ? failure.message : "Retry after checking your connection." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-b border-slate-800/80 p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-300">
        <Sprout className="h-4 w-4" /> LAND &amp; CROP CLIMATE SCREEN
        <Badge variant="outline" className="ml-auto border-amber-600/50 text-[9px] text-amber-300">PRELIMINARY</Badge>
      </div>
      <p className="text-[10px] leading-relaxed text-slate-400">
        Screens long-term climate indicators at this coordinate against broad crop reference ranges. It is not a soil test or a full parcel suitability decision.
      </p>
      <div className="text-[10px] text-slate-400">{pointLabel} · {point.lat.toFixed(5)}, {point.lon.toFixed(5)}{fieldAreaHa ? ` · ${fieldAreaHa.toFixed(2)} ha boundary drawn` : ""}</div>
      <Select value={crop} onValueChange={setCrop}>
        <SelectTrigger className="h-9 border-slate-700 bg-slate-900 text-xs text-slate-100"><SelectValue placeholder="Choose crop" /></SelectTrigger>
        <SelectContent>
          {CROP_CLIMATE_REFERENCES.map((item) => <SelectItem key={item.crop} value={item.crop}>{item.crop}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button size="sm" onClick={() => void run()} disabled={loading} className="w-full h-8 bg-emerald-700 hover:bg-emerald-600 text-xs">
        {loading ? "Loading verified climate data…" : <><Activity className="mr-2 h-3.5 w-3.5" /> Screen crop climate</>}
      </Button>
      {error && <div className="rounded border border-rose-800/50 bg-rose-950/30 p-2 text-[10px] text-rose-200">{error}</div>}
      {assessment && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-1.5">
            <div className="rounded border border-slate-700 bg-slate-900/80 p-2">
              <Thermometer className="h-3.5 w-3.5 text-orange-300" />
              <div className="mt-1 text-sm font-bold text-slate-100">{assessment.annualMeanTemperatureC === null ? "—" : `${assessment.annualMeanTemperatureC}°`}</div>
              <div className="text-[9px] text-slate-500">Climate mean</div>
            </div>
            <div className="rounded border border-slate-700 bg-slate-900/80 p-2">
              <CloudRain className="h-3.5 w-3.5 text-sky-300" />
              <div className="mt-1 text-sm font-bold text-slate-100">{assessment.estimatedAnnualRainfallMm === null ? "—" : `${assessment.estimatedAnnualRainfallMm}`}</div>
              <div className="text-[9px] text-slate-500">Rain mm/yr</div>
            </div>
            <div className="rounded border border-slate-700 bg-slate-900/80 p-2">
              <Mountain className="h-3.5 w-3.5 text-amber-300" />
              <div className="mt-1 text-sm font-bold text-slate-100">{assessment.elevationM === null ? "—" : `${Math.round(assessment.elevationM)} m`}</div>
              <div className="text-[9px] text-slate-500">GLO-90 elevation</div>
            </div>
          </div>
          <div className="rounded border border-slate-700 bg-slate-900/80 p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-100">{crop} climate screen</span>
              <Badge variant="outline" className="border-amber-600/50 text-[9px] text-amber-300">{fitLabel(selectedCrop?.climateScreen ?? "unknown")}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div><span className="text-slate-500">Annual mean temperature</span><div className="text-slate-200">{fitLabel(selectedCrop?.temperatureFit ?? "unknown")}</div></div>
              <div><span className="text-slate-500">Estimated annual rainfall</span><div className="text-slate-200">{fitLabel(selectedCrop?.rainfallFit ?? "unknown")}</div></div>
            </div>
            <div className="rounded bg-slate-950/70 p-2 text-[10px] space-y-1">
              <div className="font-semibold text-slate-200">{selectedCrop?.reference.scientificName} · FAO EcoCrop #{selectedCrop?.reference.ecoCropId}</div>
              <div className="text-slate-400">Optimal temperature: {selectedCrop?.reference.optimalTemperatureC.join("–")}°C · absolute: {selectedCrop?.reference.absoluteTemperatureC.join("–")}°C</div>
              <div className="text-slate-400">Optimal rainfall: {selectedCrop?.reference.optimalAnnualRainfallMm.join("–")} mm/year · absolute: {selectedCrop?.reference.absoluteAnnualRainfallMm.join("–")} mm/year</div>
              <div className="text-slate-400">Soil depth: {selectedCrop?.reference.soilDepth} · Texture: {selectedCrop?.reference.soilTexture} · Fertility: {selectedCrop?.reference.soilFertility}</div>
              <div className="text-slate-400">Soil pH: {selectedCrop?.reference.soilPhOptimal ? selectedCrop.reference.soilPhOptimal.join("–") : "not stated"} optimal; {selectedCrop?.reference.soilPhAbsolute ? selectedCrop.reference.soilPhAbsolute.join("–") : "not stated"} absolute</div>
              <div className="text-slate-400">Drainage: {selectedCrop?.reference.drainage}</div>
              {selectedCrop?.reference.sourceUrl && <a href={selectedCrop.reference.sourceUrl} target="_blank" rel="noreferrer" className="inline-block text-sky-300 underline">Open FAO EcoCrop source record</a>}
            </div>
            <p className="text-[10px] leading-relaxed text-slate-400">{selectedCrop?.explanation}</p>
            <p className="text-[9px] leading-relaxed text-slate-500">{selectedCrop?.reference.notes}</p>
          </div>
          <div className="rounded border border-amber-700/40 bg-amber-950/20 p-2 text-[10px] leading-relaxed text-amber-100">
            <div className="mb-1 flex items-center gap-1 font-semibold"><AlertCircle className="h-3.5 w-3.5" /> Missing evidence</div>
            {assessment.unavailableEvidence.slice(0, 4).map((item) => <div key={item}>• {item}</div>)}
          </div>
          <div className="text-[9px] text-slate-500">
            {assessment.sources.map((source) => source.name).join(" · ")} · {new Date(assessment.assessedAt).toLocaleString()} · confidence {assessment.confidence}
          </div>
          <Button size="sm" variant="outline" onClick={() => void save()} disabled={saving || !!savedFeatureId} className="w-full h-8 border-slate-700 bg-slate-900 text-xs">
            {saving ? "Saving…" : savedFeatureId ? <><CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Saved privately</> : <><Save className="mr-2 h-3.5 w-3.5" /> Save spatial assessment</>}
          </Button>
        </div>
      )}
    </div>
  );
}
