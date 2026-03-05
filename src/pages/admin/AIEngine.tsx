import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DatasetItem {
  id: string;
  question: string;
  answer: string;
  created_at: string;
}

export default function AIEngine() {
  const [dataset, setDataset] = useState<DatasetItem[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isTrainingEnabled, setIsTrainingEnabled] = useState(false);
  const [aiStatus, setAiStatus] = useState<"Online" | "Offline">("Offline");

  useEffect(() => {
    fetchDataset();
    checkAIStatus();
  }, []);

  const fetchDataset = async () => {
    const { data } = await supabase
      .from("ai_dataset")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setDataset(data);
  };

  const checkAIStatus = async () => {
    const { data } = await supabase
      .from("system_settings")
      .select("ai_enabled")
      .single();

    if (data?.ai_enabled) {
      setAiStatus("Online");
      setIsTrainingEnabled(true);
    } else {
      setAiStatus("Offline");
      setIsTrainingEnabled(false);
    }
  };

  const toggleTraining = async () => {
    const newState = !isTrainingEnabled;

    await supabase
      .from("system_settings")
      .update({ ai_enabled: newState })
      .eq("id", 1);

    setIsTrainingEnabled(newState);
    setAiStatus(newState ? "Online" : "Offline");
  };

  const addDataset = async () => {
    if (!question || !answer) return;

    await supabase.from("ai_dataset").insert([
      {
        question,
        answer,
      },
    ]);

    setQuestion("");
    setAnswer("");
    fetchDataset();
  };

  const deleteDataset = async (id: string) => {
    await supabase.from("ai_dataset").delete().eq("id", id);
    fetchDataset();
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Odeneho AI Engine</h2>

      {/* Status Panel */}
      <div className="border rounded p-4 mb-6">
        <p className="font-semibold">System Status: 
          <span className={`ml-2 ${aiStatus === "Online" ? "text-green-600" : "text-red-600"}`}>
            {aiStatus}
          </span>
        </p>

        <button
          onClick={toggleTraining}
          className="mt-3 px-4 py-2 bg-primary text-white rounded"
        >
          {isTrainingEnabled ? "Disable AI Engine" : "Enable AI Engine"}
        </button>
      </div>

      {/* Dataset Management */}
      <div className="border rounded p-4 mb-6">
        <h3 className="font-semibold mb-3">Dataset Management</h3>

        <input
          className="border p-2 w-full mb-2"
          placeholder="Question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />

        <textarea
          className="border p-2 w-full mb-2"
          placeholder="Answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />

        <button
          onClick={addDataset}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          Add Dataset Entry
        </button>
      </div>

      {/* Dataset Table */}
      <div>
        <h3 className="font-semibold mb-3">Existing Dataset</h3>

        <div className="space-y-3">
          {dataset.map((item) => (
            <div
              key={item.id}
              className="border rounded p-3 flex justify-between"
            >
              <div>
                <p className="font-semibold">{item.question}</p>
                <p className="text-sm text-muted-foreground">
                  {item.answer}
                </p>
              </div>

              <button
                onClick={() => deleteDataset(item.id)}
                className="text-red-600 text-sm"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
