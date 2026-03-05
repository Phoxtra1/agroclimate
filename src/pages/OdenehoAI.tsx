import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Mic, MicOff, Loader2, Bot, User, Volume2, VolumeX } from "lucide-react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useWeather } from "@/hooks/useWeather";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import aminevaLogo from "@/assets/amineva-logo.png";

type Msg = { role: "user" | "assistant"; content: string };

export default function OdenehoAI() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const shouldKeepListeningRef = useRef(false);
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
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      toast({
        title: "Voice not supported",
        description: "Your browser does not support voice input.",
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      shouldKeepListeningRef.current = false;
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-GH";

    let finalTranscript = "";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += `${transcript} `;
        } else {
          interim = transcript;
        }
      }
      setInput((finalTranscript + interim).trimStart());
    };

    recognition.onerror = (event: any) => {
      if (["not-allowed", "service-not-allowed", "audio-capture"].includes(event?.error)) {
        shouldKeepListeningRef.current = false;
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      if (shouldKeepListeningRef.current) {
        try {
          recognition.start();
        } catch {
          setTimeout(() => {
            if (shouldKeepListeningRef.current) recognition.start();
          }, 150);
        }
        return;
      }

      setIsListening(false);
      const transcript = finalTranscript.trim();
      if (transcript) send(transcript);
    };

    recognitionRef.current = recognition;
    shouldKeepListeningRef.current = true;
    setIsListening(true);
    recognition.start();
  };

  const selectVoice = (): SpeechSynthesisVoice | null => {
    const voices = speechSynthesis.getVoices();
    // Prefer a deep male English voice — prioritize en-GH, en-NG, en-GB male
    const preferred = [
      voices.find(v => v.lang.includes("en-GH") && v.name.toLowerCase().includes("male")),
      voices.find(v => v.lang.includes("en-GH")),
      voices.find(v => v.lang.includes("en-NG")),
      voices.find(v => v.lang.includes("en-GB") && v.name.toLowerCase().includes("male")),
      voices.find(v => v.lang.includes("en-GB")),
      voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("male")),
      voices.find(v => v.lang.startsWith("en")),
    ];
    return preferred.find(Boolean) || null;
  };

  const speak = (text: string) => {
    if ("speechSynthesis" in window) {
      if (isSpeaking) {
        speechSynthesis.cancel();
        setIsSpeaking(false);
        return;
      }
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

  const stopSpeaking = () => {
    speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <img src={aminevaLogo} alt="Odeneho" className="h-8 w-8 rounded-full" />
        <div>
          <h1 className="font-bold text-sm">Odeneho</h1>
          <p className="text-xs text-muted-foreground">Your Agricultural Intelligence Assistant</p>
        </div>
        {isSpeaking && (
          <Button variant="ghost" size="sm" onClick={stopSpeaking} className="ml-auto text-xs text-destructive">
            <VolumeX className="h-4 w-4 mr-1" /> Stop
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <img src={aminevaLogo} alt="Odeneho" className="h-16 w-16 rounded-full mx-auto mb-4 opacity-60" />
            <h2 className="font-bold text-lg mb-2">Welcome to Odeneho</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              Ask me anything about weather, farming, livestock, fish farming, food safety, or drone operations. I use your real-time location and current season to give you the best advice.
            </p>
            <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
              {[
                "What crops should I plant this season?",
                "Is it safe to spray pesticides today?",
                "How do I manage my fish pond in this weather?",
                "When should I vaccinate my poultry?",
              ].map((q) => (
                <button key={q} onClick={() => send(q)} className="text-left text-xs p-3 rounded-lg bg-card border border-border hover:bg-muted transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : msg.content}
              {msg.role === "assistant" && (
                <button onClick={() => speak(msg.content)} className="mt-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <Volume2 className="h-3 w-3" /> Listen
                </button>
              )}
            </div>
            {msg.role === "user" && (
              <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                <User className="h-4 w-4 text-secondary-foreground" />
              </div>
            )}
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-3">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="bg-card border border-border rounded-xl px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card p-3">
        <form onSubmit={(e) => { e.preventDefault(); if (!isListening) send(input); }} className="flex gap-2">
          <Button
            type="button"
            variant={isListening ? "destructive" : "outline"}
            size="icon"
            onClick={toggleVoice}
            className="flex-shrink-0"
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? "🎙️ Listening… tap mic to stop & send" : "Ask Odeneho anything..."}
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim() || isListening}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
        {isListening && (
          <p className="text-xs text-center text-destructive mt-2 animate-pulse">🎙️ Recording... tap the mic button when done speaking</p>
        )}
      </div>
    </div>
  );
}
