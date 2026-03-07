import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Mic, MicOff, Loader2, User, Volume2, VolumeX } from "lucide-react"; // Removed Bot icon
import { useGeolocation } from "@/hooks/useGeolocation";
import { useWeather } from "@/hooks/useWeather";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import aminevaLogo from "@/assets/amineva-logo.png";
import odenehoLogo from "@/assets/odeneho.png"; // Imported your new Professional AI Logo

type Msg = { role: "user" | "assistant"; content: string };

export default function OdenehoAI() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const { position } = useGeolocation();
  const { forecast } = useWeather(position.lat, position.lon);
  const { toast } = useToast();

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const streamChat = useCallback(async (allMessages: Msg[]) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/odeneho-ai`;
    const weatherContext = forecast[0]
      ? `Temp ${forecast[0].tempHigh}°C, Humidity ${forecast[0].humidity}%, Rain ${forecast[0].rainProb}%, Wind ${forecast[0].wind} km/h, ${forecast[0].description}`
      : undefined;

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
  }, [forecast, position]);

  const send = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    try {
      await streamChat([...messages, userMsg]);
    } catch (e: any) {
      toast({ title: "Odeneho Error", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
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
        try { recognition.start(); } catch { setIsListening(false); recognitionRef.current = null; }
      }
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  const speak = (text: string) => {
    if ("speechSynthesis" in window) {
      if (isSpeaking) { speechSynthesis.cancel(); setIsSpeaking(false); return; }
      const clean = text.replace(/[#*_`>\-]/g, "").replace(/\n+/g, ". ");
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = "en-GH";
      utterance.rate = 0.85;
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
    <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <img src={odenehoLogo} alt="Odeneho AI" className="h-9 w-9 rounded-full object-cover border border-primary/20" />
        <div>
          <h1 className="font-bold text-sm">Odeneho AI</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Powered by Amineva Global</p>
        </div>
        {isSpeaking && (
          <Button variant="ghost" size="sm" onClick={stopSpeaking} className="ml-auto text-xs text-destructive">
            <VolumeX className="h-4 w-4 mr-1" /> Stop Speaking
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
          <div className="text-center py-12 animate-in fade-in zoom-in duration-500">
            <img src={odenehoLogo} alt="Odeneho" className="h-20 w-20 rounded-full mx-auto mb-6 shadow-lg border-2 border-primary/10" />
            <h2 className="font-bold text-xl mb-2">Akwaaba! I am Odeneho</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-8">
              Your expert Agricultural and Climate Intelligence partner. How can I help your farm today?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
              {[
                "Analyze planting windows for Maize",
                "Check risk of pests in my region",
                "Optimal water pH for Talapia ponds",
                "Flight safety for drone spraying today",
              ].map((q) => (
                <button key={q} onClick={() => send(q)} className="text-left text-xs p-4 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="h-8 w-8 rounded-full flex-shrink-0 mt-1 overflow-hidden border border-primary/20 shadow-sm">
                <img src={odenehoLogo} alt="AI" className="h-full w-full object-cover" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-sm shadow-sm ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-card border border-border rounded-tl-none"}`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm max-w-none dark:prose-invert leading-relaxed">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : msg.content}
              {msg.role === "assistant" && (
                <button onClick={() => speak(msg.content)} className="mt-3 pt-2 border-t border-border/50 w-full text-[10px] text-primary/70 hover:text-primary flex items-center gap-1.5 uppercase font-bold tracking-tighter">
                  <Volume2 className="h-3 w-3" /> Play Voice Advisory
                </button>
              )}
            </div>
            {msg.role === "user" && (
              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-1 border border-border shadow-sm">
                <User className="h-4 w-4 text-secondary-foreground" />
              </div>
            )}
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-3">
             <div className="h-8 w-8 rounded-full flex-shrink-0 mt-1 overflow-hidden border border-primary/20 animate-pulse">
                <img src={odenehoLogo} alt="AI" className="h-full w-full object-cover grayscale opacity-50" />
            </div>
            <div className="bg-card border border-border rounded-xl px-5 py-3 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground font-medium">Odeneho is analyzing...</span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card p-4">
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-3 max-w-4xl mx-auto">
          <Button
            type="button"
            variant={isListening ? "destructive" : "secondary"}
            size="icon"
            onClick={toggleVoice}
            className={`flex-shrink-0 transition-all ${isListening ? "ring-2 ring-destructive animate-pulse" : ""}`}
          >
            {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? "Listening to your voice..." : "Ask your assistant..."}
            disabled={isLoading}
            className="flex-1 rounded-full h-11 bg-muted/30 border-none focus-visible:ring-primary/40 text-base"
          />
          <Button type="submit" size="icon" className="rounded-full h-11 w-11 shadow-md" disabled={isLoading || !input.trim()}>
            <Send className="h-5 w-5" />
          </Button>
        </form>
        {isListening && (
          <p className="text-[10px] text-center text-destructive mt-2 font-bold uppercase tracking-widest">Recording Active — Tap Mic to Review</p>
        )}
      </div>
    </div>
  );
}
