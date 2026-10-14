import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { TodayWeather, ForecastRow } from "@/components/WeatherCard";
import { weeklyForecast } from "@/data/mock-data";
import { Cloud, Sprout, Bell, Fish, ArrowRight, Loader2, Bot, Plane, Leaf, Shield, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import agyenkwaIcon from "@/assets/agyenkwa-icon.png";
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION_LABEL, WHATS_NEW, APP_NAME, APP_FOOTER } from "@/config/version";

export default function Landing() {
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [accountType, setAccountType] = useState("farmer");
  const [droneOwnership, setDroneOwnership] = useState(false);
  const [waterTransport, setWaterTransport] = useState(false);
  const [droneType, setDroneType] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const email = loginEmail.trim();
      const { error } = await signIn(email, loginPassword);
      if (error) {
        toast({
          title: "Login failed",
          description: error.message || "Invalid credentials. Please try again.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Login Error",
        description: err.message || "An unexpected error occurred during login.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!loginEmail) {
      toast({ title: "Email required", description: "Type your email first.", variant: "destructive" });
      return;
    }

    setLoading(true);
    localStorage.removeItem("supabase.auth.token");

    const { error } = await supabase.auth.resetPasswordForEmail(loginEmail.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Check your email", description: "A login link has been sent to your inbox." });
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const extraData = {
      role: accountType === "driver" ? "driver" : accountType === "buyer" ? "buyer" : "user",
      account_type: accountType,
      drone_ownership: accountType === "farmer" ? droneOwnership : false,
      water_transport: accountType === "farmer" ? waterTransport : false,
      drone_type: accountType === "farmer" && droneOwnership ? droneType : null,
      phone: regPhone,
    };
    const { error } = await signUp(regEmail.trim(), regPassword, regName, extraData);
    if (error) {
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Account created!", description: "Please check your email to verify your account." });
    }
    setLoading(false);
  };

  const features = [
    { icon: Bot, title: "Dipa Intelligence", desc: "Decision-support engine backing all AgroClimate modules" },
    { icon: Cloud, title: "Climate Risk Engine", desc: "Dynamic global hazard evaluation & rainfall forecasts" },
    { icon: Sprout, title: "Crop Suitability", desc: "Multi-factor agricultural ranking & planting guidance" },
    { icon: Shield, title: "Produce & Safety", desc: "Quality characteristics, pesticide PHI & sensor screening" },
    { icon: Plane, title: "Flight Advisory", desc: "Mission safety evaluation & aerial survey control" },
    { icon: Leaf, title: "Agro & Climate Risk", desc: "Ecological health scoring & terrain hazard modeling" },
    { icon: Bell, title: "Proactive Alerts", desc: "Location-aware disaster warnings & risk mitigation" },
    { icon: Shield, title: "Global & Regional", desc: "Worldwide climate intelligence with Ghana & Africa logistics" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="container mx-auto px-4 py-8 lg:py-16">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <img src={agyenkwaIcon} alt={APP_NAME} className="h-10 w-10 rounded-lg" />
                  <h1 className="text-2xl font-extrabold text-foreground">{APP_NAME}</h1>
                </div>
                <Link to="/marketplace/auth">
                  <Button size="sm" variant="outline" className="gap-1">
                    🛒 Market Link
                  </Button>
                </Link>
              </div>
              <p className="text-xs font-semibold text-primary mb-2">{APP_VERSION_LABEL}</p>
              <h2 className="text-3xl lg:text-5xl font-extrabold text-foreground leading-tight mb-4">
                Global Agricultural &amp; <span className="text-gradient-primary">Climate Intelligence</span>
              </h2>
              <p className="text-muted-foreground text-lg mb-8 max-w-lg">
                Location-aware, prediction-driven decision platform backing farmers, buyers, logistics providers, and agricultural investors worldwide.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 mb-8">
                {features.map((f) => (
                  <div key={f.title} className="flex gap-2 items-start">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <f.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-xs">{f.title}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
              <Card className="shadow-xl border-border/50">
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl">Get Started</CardTitle>
                  <CardDescription>Join the {APP_NAME} platform</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="login">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                      <TabsTrigger value="login">Login</TabsTrigger>
                      <TabsTrigger value="register">Register</TabsTrigger>
                    </TabsList>

                    <TabsContent value="login">
                      <form onSubmit={handleLogin} className="space-y-3">
                        <Input placeholder="Email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                        <Input placeholder="Password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                        
                        <div className="flex justify-end px-1 py-1">
                          <button 
                            type="button" 
                            onClick={handleForgotPassword}
                            className="text-[10px] text-primary hover:underline font-medium focus:outline-none"
                          >
                            Forgot Password?
                          </button>
                        </div>

                        <Button type="submit" className="w-full" disabled={loading}>
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
                        </Button>
                      </form>
                    </TabsContent>

                    <TabsContent value="register">
                      <form onSubmit={handleRegister} className="space-y-3">
                        <Input placeholder="Full Name" value={regName} onChange={(e) => setRegName(e.target.value)} required />
                        <Input placeholder="Email" type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required />
                        <Input placeholder="Phone (optional)" type="tel" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} />
                        <Input placeholder="Password (min 6 chars)" type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required minLength={6} />
                        
                        <div>
                          <label className="text-xs font-medium mb-1.5 block">I am registering as a</label>
                          <Select value={accountType} onValueChange={setAccountType}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="farmer">Farmer</SelectItem>
                              <SelectItem value="buyer">Buyer</SelectItem>
                              <SelectItem value="driver">Transport Driver</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {accountType === "farmer" && (
                          <>
                            <div className="flex flex-col space-y-2 mt-2">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="drone"
                                  checked={droneOwnership}
                                  onCheckedChange={(checked) => setDroneOwnership(checked === true)}
                                />
                                <label htmlFor="drone" className="text-xs">Flight Navigator</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="water_transport"
                                  checked={waterTransport}
                                  onCheckedChange={(checked) => setWaterTransport(checked === true)}
                                />
                                <label htmlFor="water_transport" className="text-xs">Water Transporter</label>
                              </div>
                            </div>

                            {droneOwnership && (
                              <Input
                                placeholder="Drone type/model (optional)"
                                value={droneType}
                                onChange={(e) => setDroneType(e.target.value)}
                                className="mt-2"
                              />
                            )}
                          </>
                        )}

                        <Button type="submit" className="w-full" disabled={loading}>
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
                        </Button>
                      </form>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </header>

      <section className="container mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold mb-2">Live Environmental &amp; Weather Data</h3>
          <p className="text-muted-foreground">Real-time forecast and risk insights for your selected location</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Main Column: Live Weather Overview + Agro Learning & Market Link Hub Cards */}
          <div className="lg:col-span-2 space-y-4">
            <TodayWeather weather={weeklyForecast[0]} />

            {/* Agro Learning & Market Link Hub Cards side-by-side filling the former forecast list area */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-card border border-border/70 rounded-xl p-5 shadow-sm hover:border-primary/50 transition-all flex flex-col justify-between group">
                <div>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <h4 className="font-bold text-base mb-1">Agro Learning</h4>
                  <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                    Interactive educational guides, climate adaptation strategies &amp; crop management best practices.
                  </p>
                </div>
                <Link to="/learning">
                  <Button size="sm" variant="default" className="w-full text-xs h-9">
                    Start Learning <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </Link>
              </div>

              <div className="bg-card border border-primary/20 rounded-xl p-5 shadow-sm hover:border-primary/60 transition-all flex flex-col justify-between bg-gradient-to-br from-primary/5 to-accent/5 group">
                <div>
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <span className="text-lg">🛒</span>
                  </div>
                  <h4 className="font-bold text-base mb-1">Market Link</h4>
                  <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                    Global marketplace for agricultural supply, demand orders, price trends &amp; registered transport logistics.
                  </p>
                </div>
                <Link to="/marketplace/auth">
                  <Button size="sm" variant="default" className="w-full text-xs h-9">
                    Open Marketplace <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Today's Location Metrics & Dipa Intelligence Banner */}
          <div className="space-y-4">
            <div className="bg-card rounded-xl p-4 shadow-sm border border-border/70">
              <h4 className="font-bold text-sm mb-3 flex items-center gap-1.5">
                <span>📅</span> {new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </h4>
              <div className="space-y-2 text-xs text-muted-foreground font-medium">
                <p className="flex justify-between border-b pb-1.5"><span>🌡️ High / Low:</span><strong className="text-foreground">{weeklyForecast[0].tempHigh}°C / {weeklyForecast[0].tempLow}°C</strong></p>
                <p className="flex justify-between border-b pb-1.5"><span>💧 Humidity:</span><strong className="text-foreground">{weeklyForecast[0].humidity}%</strong></p>
                <p className="flex justify-between border-b pb-1.5"><span>🌧️ Rain probability:</span><strong className="text-foreground">{weeklyForecast[0].rainProb}%</strong></p>
                <p className="flex justify-between border-b pb-1.5"><span>💨 Wind speed:</span><strong className="text-foreground">{weeklyForecast[0].wind} km/h</strong></p>
                <p className="flex justify-between pt-0.5"><span>☁️ Conditions:</span><strong className="text-foreground">{weeklyForecast[0].description}</strong></p>
              </div>
            </div>

            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary shrink-0" />
                <span className="font-bold text-foreground">Dipa Decision Intelligence</span>
              </div>
              <p className="text-muted-foreground leading-relaxed text-[11px]">
                Backing dynamic climate risk evaluation, crop suitability rankings, flight advisories &amp; market matches globally.
              </p>
              <Button size="sm" variant="default" className="w-full text-xs h-8 mt-1" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                Sign Up for Intelligence <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* What's New Section */}
      <section className="container mx-auto px-4 py-4 -mt-4">
        <div className="max-w-3xl mx-auto bg-card border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">{WHATS_NEW.title}</h3>
            <span className="text-xs font-semibold text-primary border border-primary/30 rounded-full px-2 py-0.5">{APP_VERSION_LABEL}</span>
          </div>
          <ul className="space-y-2">
            {WHATS_NEW.items.map((item) => (
              <li key={item} className="flex gap-2 text-sm">
                <span className="text-primary">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="container mx-auto px-4 py-6 text-center text-xs text-muted-foreground space-y-1">
        <div>{APP_FOOTER}</div>
        <div className="font-mono text-[10px] text-primary/80">{APP_VERSION_LABEL}</div>
      </footer>
    </div>
  );
}
