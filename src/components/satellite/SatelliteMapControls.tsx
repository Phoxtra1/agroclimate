import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { Minus, Plus, Navigation2 } from "lucide-react";

/** On-map zoom in/out, live zoom level and north-up compass for the Satellite map. */
export function SatelliteMapControls() {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const update = () => setZoom(map.getZoom());
    map.on("zoomend", update);
    return () => {
      map.off("zoomend", update);
    };
  }, [map]);

  const stop = (el: HTMLDivElement | null) => {
    if (el) {
      L.DomEvent.disableClickPropagation(el);
      L.DomEvent.disableScrollPropagation(el);
    }
  };

  const btn =
    "flex h-9 w-9 items-center justify-center bg-card text-foreground hover:bg-muted disabled:opacity-40 transition-colors";

  return (
    <div ref={stop} className="absolute right-3 top-1/2 z-[1000] -translate-y-1/2 flex flex-col items-center gap-2">
      <div className="flex flex-col overflow-hidden rounded-lg border border-border shadow-lg">
        <button type="button" aria-label="Zoom in" className={btn} disabled={zoom >= map.getMaxZoom()} onClick={() => map.zoomIn()}>
          <Plus className="h-4 w-4" />
        </button>
        <div className="bg-card py-1 text-center text-[10px] font-semibold text-muted-foreground border-y border-border">
          {Math.round(zoom)}
        </div>
        <button type="button" aria-label="Zoom out" className={btn} disabled={zoom <= map.getMinZoom()} onClick={() => map.zoomOut()}>
          <Minus className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        aria-label="North up"
        title="North is up"
        className={`${btn} rounded-full border border-border shadow-lg`}
        onClick={() => map.setView(map.getCenter(), map.getZoom())}
      >
        <div className="flex flex-col items-center leading-none">
          <Navigation2 className="h-4 w-4 text-destructive" />
          <span className="text-[8px] font-bold">N</span>
        </div>
      </button>
    </div>
  );
}
