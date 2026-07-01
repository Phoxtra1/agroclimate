// Lightweight in-browser event log for AIH connection events.
// Records handshakes, errors, protocol changes, connect/disconnect transitions.
// Used by Connection Diagnostics (drawer + CSV export) and Aircraft Registry timeline.

const KEY = "aih_connection_event_log";
const MAX = 500;

export type ConnectionEventType =
  | "handshake"
  | "connect"
  | "disconnect"
  | "protocol_change"
  | "telemetry"
  | "error"
  | "info";

export interface ConnectionEvent {
  id: string;
  ts: number;                // epoch ms
  type: ConnectionEventType;
  protocol?: string;
  adapter?: string;          // websocket / ble / serial / simulator / aih
  aircraftId?: string;
  aircraftName?: string;
  message: string;
  detail?: string;
}

function safeRead(): ConnectionEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function safeWrite(items: ConnectionEvent[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
    window.dispatchEvent(new CustomEvent("aih:event-log-changed"));
  } catch {}
}

export function logConnectionEvent(ev: Omit<ConnectionEvent, "id" | "ts"> & { ts?: number }): void {
  const items = safeRead();
  items.unshift({
    id: (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`),
    ts: ev.ts ?? Date.now(),
    ...ev,
  });
  safeWrite(items);
}

export function getConnectionEvents(filter?: { aircraftId?: string; type?: ConnectionEventType; limit?: number }): ConnectionEvent[] {
  const all = safeRead();
  let out = all;
  if (filter?.aircraftId) out = out.filter((e) => e.aircraftId === filter.aircraftId);
  if (filter?.type) out = out.filter((e) => e.type === filter.type);
  if (filter?.limit) out = out.slice(0, filter.limit);
  return out;
}

export function clearConnectionEvents() {
  safeWrite([]);
}

export function exportConnectionEventsCSV(events: ConnectionEvent[]): string {
  const header = ["timestamp_iso", "type", "protocol", "adapter", "aircraft_id", "aircraft_name", "message", "detail"];
  const escape = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = events.map((e) => [
    new Date(e.ts).toISOString(),
    e.type,
    e.protocol || "",
    e.adapter || "",
    e.aircraftId || "",
    e.aircraftName || "",
    e.message,
    e.detail || "",
  ].map(escape).join(","));
  return [header.join(","), ...rows].join("\n");
}

export function downloadEventsCSV(events: ConnectionEvent[], filename = `aih-diagnostics-${new Date().toISOString().slice(0, 10)}.csv`) {
  const csv = exportConnectionEventsCSV(events);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
