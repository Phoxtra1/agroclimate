// Central AGTrans status definitions. All UI badge colors, labels, and
// allowed transitions flow from this file so the supplier, driver, buyer,
// and admin views always agree on what each state means.

export type AgTransStatus =
  | "searching_driver"
  | "driver_matched"
  | "driver_en_route"
  | "cargo_picked"
  | "in_transit"
  | "near_destination"
  | "delivered"
  | "delivery_confirmed"
  | "cancelled"
  | "delayed";

export const STATUS_LABEL: Record<AgTransStatus, string> = {
  searching_driver: "Searching for Driver",
  driver_matched: "Driver Matched",
  driver_en_route: "Driver En Route",
  cargo_picked: "Cargo Picked",
  in_transit: "In Transit",
  near_destination: "Near Destination",
  delivered: "Delivered",
  delivery_confirmed: "Delivery Confirmed",
  cancelled: "Cancelled",
  delayed: "Delayed",
};

// Tailwind class hint per status — uses semantic tokens already in the app.
export const STATUS_TONE: Record<AgTransStatus, string> = {
  searching_driver: "bg-muted text-muted-foreground",
  driver_matched: "bg-primary/15 text-primary",
  driver_en_route: "bg-primary/15 text-primary",
  cargo_picked: "bg-primary/20 text-primary",
  in_transit: "bg-primary/25 text-primary",
  near_destination: "bg-warning/20 text-warning",
  delivered: "bg-success/20 text-success",
  delivery_confirmed: "bg-success/30 text-success",
  cancelled: "bg-destructive/15 text-destructive",
  delayed: "bg-warning/20 text-warning",
};

// Driver-side forward progression. Suppliers handle confirmation/cancel.
export const DRIVER_NEXT: Partial<Record<AgTransStatus, AgTransStatus[]>> = {
  driver_matched: ["driver_en_route", "cancelled"],
  driver_en_route: ["cargo_picked", "delayed", "cancelled"],
  cargo_picked: ["in_transit", "delayed"],
  in_transit: ["near_destination", "delayed"],
  near_destination: ["delivered", "delayed"],
};

export const URGENCY_LABEL: Record<string, string> = {
  standard: "Standard",
  urgent: "Urgent",
  cold_chain: "Cold-chain",
};
