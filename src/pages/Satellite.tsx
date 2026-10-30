import { FormEvent, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Satellite as SatelliteIcon, Search, MapPin, Layers, CalendarDays, LocateFixed, Info, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import "leaflet/dist/leaflet.css";

type Place = { lat: number; lon: number; label: string };
const layers = [
  { id: "MODIS_Terra_CorrectedReflectance_TrueColor", label: "Natural colour", description: "Natural-colour satellite imagery" },
  { id: "MODIS_Terra_CorrectedReflectance_Bands721", label: "False colour", description: "Highlights vegetation, moisture and burn patterns" },
  { id: "MODIS_Terra_NDVI_8Day", label: "Vegetation index (NDVI)", description: "Eight-day vegetation greenness composite" },
];
const marker = L.divIcon({ className: "satellite-marker", html: '<div style="width:18px;height:18px;border:3px solid white;border-radius:50%;background:#16a34a;box-shadow:0 1px 8px #0008"></div>', iconSize: [18,18], iconAnchor: [9,9] });
const fmtDate = (d: Date) => [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
function Recenter({ place }: { place: Place }) { const map=useMap(); useEffect(()=>{ map.flyTo([place.lat,place.lon],Math.max(7,map.getZoom()),{duration:.7}); },[map,place.lat,place.lon]); return null; }
function ClickToSelect({ onSelect }: { onSelect:(p:Place)=>void }) { useMapEvents({click:e=>onSelect({lat:e.latlng.lat,lon:e.latlng.lng,label:"Selected coordinates"})}); return null; }

export default function Satellite() {
  const [place,setPlace]=useState<Place>({lat:7.9465,lon:-1.0232,label:"Ghana"});
  const [query,setQuery]=useState("");
  const [layer,setLayer]=useState(layers[0].id);
  const [date,setDate]=useState(()=>fmtDate(new Date(Date.now()-3*86400000)));
  const [busy,setBusy]=useState(false);
  const [locating,setLocating]=useState(false);
  const [error,setError]=useState("");
  const [mapMessage,setMapMessage]=useState("");
  const active=useMemo(()=>layers.find(x=>x.id===layer)!,[layer]);
  const maxDate=fmtDate(new Date(Date.now()-86400000));

  const resolvePlace=async(p:Place)=>{
    setPlace(p); setMapMessage("");
    try {
      const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${p.lat}&lon=${p.lon}`);
      if(r.ok){const d=await r.json();const a=d.address||{};const name=d.name||[a.suburb,a.town,a.city,a.county,a.state,a.country].filter(Boolean).slice(0,3).join(", ");if(name)setPlace({...p,label:name});}
    } catch { setMapMessage("Could not resolve a place name; selected coordinates remain available."); }
  };
  const search=async(e:FormEvent)=>{
    e.preventDefault();const q=query.trim();if(!q)return;setError("");
    const coords=q.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if(coords){const lat=Number(coords[1]),lon=Number(coords[2]);if(lat>=-90&&lat<=90&&lon>=-180&&lon<=180){await resolvePlace({lat,lon,label:"Coordinate search"});return;}}
    setBusy(true);
    try{const r=await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`);if(!r.ok)throw new Error("Location search is temporarily unavailable.");const rows=await r.json();if(!rows.length)throw new Error("No matching place found. Try a town, district, region or coordinates.");await resolvePlace({lat:Number(rows[0].lat),lon:Number(rows[0].lon),label:rows[0].display_name});setQuery("");}
    catch(e){setError(e instanceof Error?e.message:"Location search failed.");}finally{setBusy(false);}
  };
  const locate=()=>{
    if(!navigator.geolocation){setError("Geolocation is not supported by this browser.");return;}
    setLocating(true);setError("");
    navigator.geolocation.getCurrentPosition(p=>{void resolvePlace({lat:p.coords.latitude,lon:p.coords.longitude,label:"Your location"});setLocating(false);},()=>{setError("Could not access your location. Check browser permission or search for a place.");setLocating(false);},{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
  };
  const url=`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
  return <div className="space-y-5 pb-8">
    <header className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-100 p-2 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"><SatelliteIcon className="h-6 w-6"/></div><div><h1 className="text-2xl font-bold">Satellite</h1><p className="text-sm text-muted-foreground">Explore Earth-observation imagery for agricultural landscapes</p></div></div><Badge variant="outline">NASA Earthdata · Open imagery</Badge></header>
    <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search farm, town, district, region or coordinates…" className="h-11 pl-9" aria-label="Search location"/></div><Button disabled={busy||!query.trim()} className="h-11 gap-2">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Search className="h-4 w-4"/>} Search</Button><Button type="button" variant="outline" onClick={locate} disabled={locating} className="h-11 gap-2">{locating?<Loader2 className="h-4 w-4 animate-spin"/>:<LocateFixed className="h-4 w-4"/>} My location</Button></form>
    {error&&<div role="alert" className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="h-4 w-4 shrink-0"/>{error}</div>}
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm"><div className="flex flex-col justify-between gap-3 border-b p-3 sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-emerald-600"/><span className="truncate">{place.label}</span></div><p className="pl-6 text-xs text-muted-foreground">{place.lat.toFixed(5)}, {place.lon.toFixed(5)} · Select the map to inspect another point</p></div><div className="flex flex-wrap gap-2"><label className="flex h-9 items-center gap-2 rounded-md border px-2 text-xs"><Layers className="h-3.5 w-3.5"/><select aria-label="Imagery layer" value={layer} onChange={e=>setLayer(e.target.value)} className="max-w-[175px] bg-transparent outline-none">{layers.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label><label className="flex h-9 items-center gap-2 rounded-md border px-2 text-xs"><CalendarDays className="h-3.5 w-3.5"/><input aria-label="Observation date" type="date" value={date} max={maxDate} onChange={e=>setDate(e.target.value)} className="w-[126px] bg-transparent outline-none"/></label></div></div>
    <div className="h-[440px] w-full bg-slate-900 sm:h-[560px]"><MapContainer center={[place.lat,place.lon]} zoom={6} scrollWheelZoom className="h-full w-full"><TileLayer key={url} url={url} maxZoom={9} attribution='Imagery: <a href="https://earthdata.nasa.gov/">NASA GIBS / Earthdata</a>' eventHandlers={{tileerror:()=>setMapMessage("Some imagery tiles failed to load. Try another date or layer.")}}/><Recenter place={place}/><ClickToSelect onSelect={p=>void resolvePlace(p)}/><Marker position={[place.lat,place.lon]} icon={marker}><Popup>{place.label}<br/>{place.lat.toFixed(5)}, {place.lon.toFixed(5)}</Popup></Marker></MapContainer></div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 p-3"><div><p className="text-sm font-medium">{active.label}</p><p className="text-xs text-muted-foreground">{active.description}</p></div><p className="text-xs text-muted-foreground">Selected product date: {date}</p></div></section>
    {mapMessage&&<p className="text-xs text-muted-foreground">{mapMessage}</p>}
    <div className="grid gap-3 md:grid-cols-2"><div className="rounded-xl border bg-card p-4"><h2 className="mb-2 font-semibold">Agricultural observation</h2><p className="text-sm text-muted-foreground">The NDVI layer shows broad vegetation greenness patterns using an eight-day composite. It is not a direct diagnosis of crop health, yield, soil moisture or an individual farm's condition.</p></div><div className="rounded-xl border bg-card p-4"><h2 className="mb-2 flex items-center gap-2 font-semibold"><Info className="h-4 w-4"/> Data freshness and limitations</h2><p className="text-sm text-muted-foreground">This viewer requests archived NASA GIBS imagery for the selected date. Product availability, cloud cover, spatial resolution and revisit cadence affect what can be observed. This is not live video or real-time ground imagery.</p><a href="https://www.earthdata.nasa.gov/data/instruments/modis" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">About MODIS <ExternalLink className="h-3 w-3"/></a></div></div>
    <p className="text-center text-[11px] text-muted-foreground">Imagery: NASA GIBS · Map: Leaflet · Geocoding: OpenStreetMap Nominatim. Public services are free to access but subject to provider usage policies and availability.</p>
  </div>;
}
