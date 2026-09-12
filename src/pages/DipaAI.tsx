import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Mic, MicOff, Loader2, User, Volume2, VolumeX, Sparkles, FileText, ShieldAlert, CheckCircle2, Info, RefreshCw } from "lucide-react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useWeather } from "@/hooks/useWeather";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import dipaLogo from "@/assets/dipa.png";
import { DipaEngine, type ExecutiveDipaBrief } from "@/lib/dipaEngine";
import { Badge } from "@/components/ui/badge";

type Msg = { role: "user" | "assistant"; content: string };

export default function DipaAI() {
  const [activeTab, setActiveTab] = useState<"chat" | "brief">("chat");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [brief, setBrief] = useState<ExecutiveDipaBrief | null>(null);
  const [isBriefLoading, setIsBriefLoading] = useState(false);
  const [showTransparency, setShowTransparency] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const { position } = useGeolocation();
  const { forecast } = useWeather(position.lat, position.lon);
  const { toast } = useToast();

  const loadExecutiveBrief = useCallback(async () => {
    setIsBriefLoading(true);
    try {
      const res = await DipaEngine.generateExecutiveDipaBrief(
        position.lat,
        position.lon,
        position.locationName,
        forecast
      );
      setBrief(res);
    } catch (e: any) {
      toast({ title: "Brief Error", description: e.message || "Failed to generate brief", variant: "destructive" });
    } finally {
      setIsBriefLoading(false);
    }
  }, [forecast, position.lat, position.locationName, position.lon, toast]);

  useEffect(() => {
    if (activeTab === "brief" && !brief) {
      loadExecutiveBrief();
    }
  }, [activeTab, brief, loadExecutiveBrief]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Pick up a prefilled prompt (e.g. from Post-Harvest Tracker "Get Advice")
  useEffect(() => {
    try {
      const prefill = sessionStorage.getItem("dipa-prefill");
      if (prefill) { setInput(prefill); sessionStorage.removeItem("dipa-prefill"); }
    } catch {}
  }, []);

  const streamChat = useCallback(async (allMessages: Msg[]) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dipa-ai`;
    const weatherContext = forecast[0]
      ? `Temp ${forecast[0].tempHigh}°C, Humidity ${forecast[0].humidity}%, Rain ${forecast[0].rainProb}%, Wind ${forecast[0].wind} km/h, ${forecast[0].description}`
      : undefined;

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages,
          location: { community: position.community, district: position.district, region: position.region },
          weatherContext,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Connection failed" }));
        throw new Error(err.error || `Error ${resp.status}`);
      }
      if (!resp.body) throw new Error("No response stream");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantText += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantText } : m);
                }
                return [...prev, { role: "assistant", content: assistantText }];
              });
            }
          } catch { /* partial chunk */ }
        }
      }
    } catch (e: any) {
      toast({ title: "Dipa Error", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [forecast, position, toast]);

  const send = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    await streamChat([...messages, userMsg]);
  };

  const toggleVoice = () => {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      toast({ title: "Voice not supported", description: "Your browser does not support voice input.", variant: "destructive" });
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-GH";
    recognition.maxAlternatives = 1;

    let finalTranscript = "";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interim = transcript;
        }
      }
      setInput((finalTranscript + interim).trimStart());
    };

    recognition.onerror = (event: any) => {
      if (["not-allowed", "service-not-allowed", "audio-capture"].includes(event.error)) {
        setIsListening(false);
        recognitionRef.current = null;
        toast({ title: "Microphone access denied", description: "Please allow microphone access.", variant: "destructive" });
      }
    };

    recognition.onend = () => {
      if (isListening && recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          setIsListening(false);
          recognitionRef.current = null;
        }
      }
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const selectVoice = (): SpeechSynthesisVoice | null => {
    const voices = speechSynthesis.getVoices();
    return voices.find(v => v.lang.includes("en-GH")) || voices.find(v => v.lang.startsWith("en")) || null;
  };

  const speak = (text: string) => {
    if ("speechSynthesis" in window) {
      if (isSpeaking) { speechSynthesis.cancel(); setIsSpeaking(false); return; }
      const clean = text.replace(/[#*_`>\-]/g, "").replace(/\n+/g, ". ");
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = "en-GH";
      utterance.rate = 0.85;
      utterance.pitch = 0.9;
      const voice = selectVoice();
      if (voice) utterance.voice = voice;
      utterance.onend = () => setIsSpeaking(false);
      setIsSpeaking(true);
      speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => { speechSynthesis.cancel(); setIsSpeaking(false); };

  const handleSend = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setIsListening(false);
      return;
    }
    send(input);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen">
      {/* Header with Tab switcher */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src={dipaLogo} alt="Dipa" className="h-8 w-8 rounded-full border border-primary/20 shadow-sm" />
          <div>
            <h1 className="font-bold text-sm tracking-tight flex items-center gap-2">
              Dipa
              <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                v1.6
              </Badge>
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase">Expert Agricultural Intelligence</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-muted p-0.5 rounded-lg border border-border">
            <Button
              size="sm"
              variant={activeTab === "chat" ? "default" : "ghost"}
              onClick={() => setActiveTab("chat")}
              className="h-7 text-xs px-2.5 rounded-md gap-1"
            >
              <Sparkles className="h-3.5 w-3.5" /> Chat
            </Button>
            <Button
              size="sm"
              variant={activeTab === "brief" ? "default" : "ghost"}
              onClick={() => setActiveTab("brief")}
              className="h-7 text-xs px-2.5 rounded-md gap-1"
            >
              <FileText className="h-3.5 w-3.5" /> V1.6 Brief
            </Button>
          </div>

          {isSpeaking && (
            <Button variant="ghost" size="sm" onClick={stopSpeaking} className="text-xs text-destructive h-7 px-2">
              <VolumeX className="h-4 w-4 mr-1" /> Stop
            </Button>
          )}
        </div>
      </div>

      {activeTab === "brief" ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-muted/20">
          {isBriefLoading ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground font-medium">Generating V1.6 Dipa Executive Brief for {position.locationName}...</p>
            </div>
          ) : brief ? (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Header card */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
                  <div>
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{brief.version}</span>
                    <h2 className="text-lg font-bold text-foreground">Location Executive Intelligence Brief</h2>
                    <p className="text-xs text-muted-foreground">
                      {brief.location.name}, {brief.location.region} • {brief.location.country} ({brief.location.elevationMeters}m MSL, {brief.location.terrainType})
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={brief.overallRiskLevel === "Critical" || brief.overallRiskLevel === "High" ? "destructive" : "secondary"}>
                      {brief.overallRiskLevel} Vulnerability ({brief.compositeVulnerabilityScore}/100)
                    </Badge>
                    <Button size="sm" variant="outline" onClick={loadExecutiveBrief} className="h-8 gap-1 text-xs">
                      <RefreshCw className="h-3.5 w-3.5" /> Refresh
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed italic bg-muted/40 p-3 rounded-lg border border-border/40">
                  "{brief.executiveSummary}"
                </p>
              </div>

              {/* Sector Advisories Grid */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> Multi-Sector Risk Breakdown
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {brief.sectorAdvisories.map((sec) => (
                    <div key={sec.sector} className="bg-card border border-border rounded-xl p-4 space-y-2 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-foreground">{sec.sector}</span>
                        <Badge
                          variant={sec.status === "Critical" || sec.status === "Warning" ? "destructive" : sec.status === "Caution" ? "outline" : "secondary"}
                          className="text-[10px]"
                        >
                          {sec.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{sec.keyInsight}</p>
                      <div className="pt-2 border-t border-border/40 text-[11px] font-medium text-primary">
                        👉 {sec.recommendedAction}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mitigation Roadmap */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" /> Actionable Mitigation Roadmap
                </h3>
                <div className="space-y-3">
                  {brief.mitigationRoadmap.map((item) => (
                    <div key={item.step} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        {item.step}
                      </span>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-foreground">{item.title}</h4>
                          <Badge variant="outline" className="text-[9px] uppercase">
                            {item.urgency}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{item.action}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Transparency Metadata & Lineage */}
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                    <Info className="h-4 w-4 text-primary" /> Data Source Lineage & System Transparency
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowTransparency(!showTransparency)} className="text-xs text-primary h-6">
                    {showTransparency ? "Hide Lineage" : "View Lineage"}
                  </Button>
                </div>

                {showTransparency && (
                  <div className="text-xs text-muted-foreground space-y-2 pt-2 border-t border-border/50">
                    <p><strong className="text-foreground">Engine Model:</strong> {brief.transparencyMeta.modelName}</p>
                    <p><strong className="text-foreground">Confidence Rating:</strong> {brief.transparencyMeta.confidence} ({brief.transparencyMeta.dataQuality})</p>
                    <p><strong className="text-foreground">Methodology:</strong> {brief.transparencyMeta.calculationMethodology}</p>
                    <div>
                      <strong className="text-foreground">Data Feeds:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px]">
                        {brief.transparencyMeta.dataSources.map((ds) => (
                          <li key={ds}>{ds}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm">No brief generated yet.</p>
              <Button size="sm" onClick={loadExecutiveBrief} className="mt-3">Generate V1.6 Brief</Button>
            </div>
          )}
        </div>
      ) : (
        /* Interactive Chat Tab */
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <img src={dipaLogo} alt="Dipa" className="h-20 w-20 rounded-full mx-auto mb-4 border border-primary/20 shadow-md" />
                <h2 className="font-bold text-lg mb-2">Welcome to your AI Partner</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6 px-4">
                  I can help with crop advisory, fish farm management, climate predictions, and V1.6 location briefs.
                </p>
                <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto px-4">
                  {[
                    "Analyze my crop window",
                    "Check rain probability",
                    "Fish pond maintenance",
                    "Livestock vaccination",
                  ].map((q) => (
                    <button key={q} onClick={() => send(q)} className="text-left text-[11px] p-3 rounded-xl bg-card border border-border hover:bg-muted transition-colors font-medium">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="h-8 w-8 rounded-full flex-shrink-0 mt-1 border border-primary/10 overflow-hidden shadow-sm">
                    <img src={dipaLogo} alt="AI" className="h-full w-full object-cover" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.role === "user" ? "bg-primary text-primary-foreground border-transparent" : "bg-card border border-border"}`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert leading-relaxed">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : msg.content}
                  {msg.role === "assistant" && (
                    <button onClick={() => speak(msg.content)} className="mt-3 pt-2 border-t border-border/50 text-[10px] text-primary hover:text-primary/70 flex items-center gap-1 font-bold uppercase tracking-tighter">
                      <Volume2 className="h-3 w-3" /> Voice Advisory
                    </button>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-1 shadow-sm border border-border">
                    <User className="h-4 w-4 text-secondary-foreground" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full flex-shrink-0 mt-1 border border-primary/10 overflow-hidden animate-pulse">
                    <img src={dipaLogo} alt="AI Thinking" className="h-full w-full object-cover grayscale opacity-50" />
                </div>
                <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border bg-card p-4">
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2 max-w-4xl mx-auto">
              <Button
                type="button"
                variant={isListening ? "destructive" : "secondary"}
                size="icon"
                onClick={toggleVoice}
                className={`flex-shrink-0 rounded-full h-10 w-10 ${isListening ? "animate-pulse" : ""}`}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? "Listening..." : "Message Dipa..."}
                disabled={isLoading}
                className="flex-1 rounded-full bg-muted border-none ring-offset-background focus-visible:ring-1"
              />
              <Button type="submit" size="icon" className="rounded-full h-10 w-10 flex-shrink-0" disabled={isLoading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
