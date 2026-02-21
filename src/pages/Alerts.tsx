import { AlertCard } from "@/components/AlertCard";
import { alerts } from "@/data/mock-data";
import { Bell } from "lucide-react";

export default function Alerts() {
  const unread = alerts.filter((a) => !a.read);
  const read = alerts.filter((a) => a.read);

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-bold">Alerts</h1>
        {unread.length > 0 && (
          <span className="bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full font-semibold">
            {unread.length} new
          </span>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-5">
          {unread.length > 0 && (
            <section>
              <h2 className="font-semibold text-sm text-muted-foreground mb-3">NEW</h2>
              <div className="space-y-3">
                {unread.map((a) => <AlertCard key={a.id} alert={a} />)}
              </div>
            </section>
          )}

          {read.length > 0 && (
            <section>
              <h2 className="font-semibold text-sm text-muted-foreground mb-3">EARLIER</h2>
              <div className="space-y-3">
                {read.map((a) => <AlertCard key={a.id} alert={a} />)}
              </div>
            </section>
          )}

          {alerts.length === 0 && (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground/30" />
              <p className="text-muted-foreground mt-3">No alerts yet</p>
            </div>
          )}
        </div>

        <div>
          <div className="bg-muted rounded-xl p-4 text-center">
            <p className="text-sm text-muted-foreground">
              📱 Critical alerts are also sent via SMS to your registered phone number.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
