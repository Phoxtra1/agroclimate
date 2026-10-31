import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildSatelliteHref } from "@/lib/satelliteLink";

interface OpenInSatelliteButtonProps {
  query?: string;
  lat?: number;
  lon?: number;
  label?: string;
  zoom?: number;
  children?: ReactNode;
  className?: string;
}

export function OpenInSatelliteButton({
  query,
  lat,
  lon,
  label,
  zoom,
  children,
  className,
}: OpenInSatelliteButtonProps) {
  const to = buildSatelliteHref({ query, lat, lon, label, zoom });
  return (
    <Button asChild size="sm" variant="outline" className={className}>
      <Link to={to}>
        <MapPinned className="h-4 w-4 mr-2" />
        {children || "Open in Satellite"}
      </Link>
    </Button>
  );
}
