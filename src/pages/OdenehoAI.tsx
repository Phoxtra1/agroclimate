import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Mic, MicOff, Loader2, User, Volume2, VolumeX } from "lucide-react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useWeather } from "@/hooks/useWeather";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import aminevaLogo from "@/assets/amineva-logo.png";
import odenehoLogo from "@/assets/odeneho.png"; 

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
      toast({ title: "Odeneho Error", description: e.message, variant: "destructive" });
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
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <img src={odenehoLogo} alt="Odeneho AI" className="h-8 w-8 rounded-full border border-primary/20 shadow-sm" />
        <div>
          <h1 className="font-bold text-sm tracking-tight">Odeneho AI</h1>
          <p className="text-[10px] text-muted-foreground uppercase">Expert Agricultural Intelligence</p>
        </div>
        {isSpeaking && (
          <Button variant="ghost" size="sm" onClick={stopSpeaking} className="ml-auto text-xs text-destructive">
            <VolumeX className="h-4 w-4 mr-1" /> Stop
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <img src={odenehoLogo} alt="Odeneho AI" className="h-20 w-20 rounded-full mx-auto mb-4 border border-primary/20 shadow-md" />
            <h2 className="font-bold text-lg mb-2">Welcome to your AI Partner</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6 px-4">
              I can help with crop advisory, fish farm management, and climate predictions.
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
                <img src={odenehoLogo} alt="AI" className="h-full w-full object-cover" />
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
                <img src={odenehoLogo} alt="AI Thinking" className="h-full w-full object-cover grayscale opacity-50" />
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
            placeholder={isListening ? "Listening..." : "Message Odeneho AI..."}
            disabled={isLoading}
            className="flex-1 rounded-full bg-muted border-none ring-offset-background focus-visible:ring-1"
          />
          <Button type="submit" size="icon" className="rounded-full h-10 w-10 flex-shrink-0" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
