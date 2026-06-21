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
import aminevaLogo from "@/assets/amineva-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION_LABEL, WHATS_NEW } from "@/config/version";

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
    
    // 1. Clean the input
    const email = loginEmail.trim().toLowerCase();

    // 2. Attempt Sign In
    const { error } = await signIn(email, loginPassword);

    if (error) {
      // 3. AUTO-FIX for non-tech users: 
      // If login fails, clear old session data that might be causing the "Inconsistency"
      await supabase.auth.signOut();
      sessionStorage.clear();
      
      const errorMessage = error.message?.toLowerCase() || "";
      const isNetworkError = errorMessage.includes("fetch") || errorMessage.includes("network") || !navigator.onLine;

      if (isNetworkError) {
        toast({
          title: "Network Connection Error",
          description: "Please check your internet connection and try again. The server could not be reached.",
          variant: "destructive"
        });
      } else {
        toast({ 
          title: "Login failed", 
          description: error.message || "Invalid credentials. Please try again or use 'Forgot Password'.", 
          variant: "destructive" 
        });
      }
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!loginEmail) {
      toast({ title: "Email required", description: "Type your email first.", variant: "destructive" });
      return;
    }

    setLoading(true);
    // Force a clean state before requesting reset
    localStorage.removeItem('supabase.auth.token');

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
      drone_type: (accountType === "farmer" && droneOwnership) ? droneType : null,
      phone: regPhone
    };
    const { error } = await signUp(regEmail.trim(), regPassword, regName, extraData);
    if (error) {
      const errorMessage = error.message?.toLowerCase() || "";
      const isNetworkError = errorMessage.includes("fetch") || errorMessage.includes("network") || !navigator.onLine;

      if (isNetworkError) {
        toast({
          title: "Network Connection Error",
          description: "Please check your internet connection and try again.",
          variant: "destructive"
        });
      } else {
        toast({ title: "Registration failed", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: "Account created!", description: "Please check your email to verify your account." });
    }
    setLoading(false);
  };

  const features = [
    { icon: Bot, title: "Odeneho", desc: "Voice-first AI farming assistant powered by Amineva" },
    { icon: Cloud, title: "Climate Intelligence", desc: "Hyperlocal weather, rainfall prediction, disaster alerts" },
    { icon: Sprout, title: "Crop Advisory", desc: "AI-powered planting windows, irrigation, pest risk" },
    { icon: Fish, title: "Aquaculture", desc: "Fish pond monitoring with water quality tracking" },
    { icon: Plane, title: "Flight Advisory", desc: "Flight safety evaluation and mission planning" },
    { icon: Leaf, title: "Environmental Monitor", desc: "Air quality, heat stress, turbulence modeling" },
    { icon: Bell, title: "Smart Alerts", desc: "Real-time disaster warnings and crop risk alerts" },
    { icon: Shield, title: "Multi-Sector", desc: "Agriculture, forestry, surveying, and agribusiness" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="container mx-auto px-4 py-8 lg:py-16">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <img src={aminevaLogo} alt="AgroClimate" className="h-10 w-10 rounded-full" />
                  <h1 className="text-2xl font-extrabold text-foreground">AgroClimate</h1>
                </div>
                <Link to="/marketplace/auth">
                  <Button size="sm" variant="outline" className="gap-1">
                    🛒 Market Link
                  </Button>
                </Link>
              </div>
              <p className="text-xs font-semibold text-primary mb-2">AGC V1.0</p>
              <h2 className="text-3xl lg:text-5xl font-extrabold text-foreground leading-tight mb-4">
                Smart Insights for <span className="text-gradient-primary">Agriculture and Climate</span>
              </h2>
              <p className="text-muted-foreground text-lg mb-8 max-w-lg">
                Climate-first, prediction-driven, AI-powered platform for farmers, extension officers, surveyors, and forestry agents across Africa.
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
                  <CardDescription>Join the AgroClimate community</CardDescription>
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
          <h3 className="text-2xl font-bold mb-2">Live Weather Updates</h3>
          <p className="text-muted-foreground">Real-time 24-hour weather data for your region</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TodayWeather weather={weeklyForecast[0]} />
            <div className="bg-card rounded-xl p-4 shadow-sm mt-4">
              {weeklyForecast.map((day) => (
                <ForecastRow key={day.day} day={day} />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-card rounded-xl p-4 shadow-sm">
              <h4 className="font-bold text-sm mb-3">📅 {new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</h4>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>🌡️ High: {weeklyForecast[0].tempHigh}°C / Low: {weeklyForecast[0].tempLow}°C</p>
                <p>💧 Humidity: {weeklyForecast[0].humidity}%</p>
                <p>🌧️ Rain probability: {weeklyForecast[0].rainProb}%</p>
                <p>💨 Wind: {weeklyForecast[0].wind} km/h</p>
                <p>☁️ Conditions: {weeklyForecast[0].description}</p>
              </div>
            </div>

            <div className="bg-primary/10 rounded-xl p-5 text-center">
              <BookOpen className="h-8 w-8 mx-auto text-primary mb-3" />
              <h4 className="font-bold text-sm mb-1">Agro Learning</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Free educational guides on smart farming, pest management, climate adaptation, and post-harvest handling.
              </p>
              <Link to="/learning">
                <Button size="sm" variant="default">
                  Start Learning <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>

            <div className="bg-gradient-to-br from-primary/15 to-accent/10 rounded-xl p-5 text-center border border-primary/20">
              <h4 className="font-bold text-sm mb-1">🛒 Market Link</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Buyers must register before browsing supply or contacting farmers. Subscription unlocks live chat & negotiation.
              </p>
              <Link to="/marketplace/auth">
                <Button size="sm" variant="default">
                  Sign in to Market Link <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <Button size="lg" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            Sign up for personalized data <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* What's New */}
      <section className="container mx-auto px-4 py-10">
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

      <footer className="container mx-auto px-4 py-6 text-center text-xs text-muted-foreground">
        {APP_VERSION_LABEL}
      </footer>
    </div>
  );
}

