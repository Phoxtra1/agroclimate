import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AlertItem {
  id: string;
  title: string;
  message: string;
  created_at: string;
}

export default function Alert() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    const { data, error } = await supabase
      .from("alerts")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setAlerts(data);
    }
  };

  const createAlert = async () => {
    if (!title || !message) return;

    const { error } = await supabase.from("alerts").insert([
      { title, message },
    ]);

    if (!error) {
      setTitle("");
      setMessage("");
      fetchAlerts();
    }
  };

  const deleteAlert = async (id: string) => {
    await supabase.from("alerts").delete().eq("id", id);
    fetchAlerts();
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Crop & Weather Alerts</h2>

      <div className="space-y-2 mb-6">
        <input
          className="border p-2 w-full"
          placeholder="Alert Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="border p-2 w-full"
          placeholder="Alert Message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button
          onClick={createAlert}
          className="bg-primary text-white px-4 py-2 rounded"
        >
          Create Alert
        </button>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => (
          <div key={alert.id} className="border p-3 rounded flex justify-between">
            <div>
              <h4 className="font-semibold">{alert.title}</h4>
              <p className="text-sm text-muted-foreground">{alert.message}</p>
            </div>
            <button
              onClick={() => deleteAlert(alert.id)}
              className="text-red-500 text-sm"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
