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
    { icon: Fish, title: "Aquaculture", desc: "Water quality monitoring & dissolved oxygen tracking" },
    { icon: Plane, title: "Flight Advisory", desc: "Mission safety evaluation & aerial survey control" },
    { icon: Leaf, title: "Environmental Monitor", desc: "Ecological health scoring & turbulence modeling" },
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
              <p className="text-xs font-semibold text-primary mb-2">{APP_VERSION_LABEL} · by Amineva Global</p>
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
          <div className="lg:col-span-2">
            <TodayWeather weather={weeklyForecast[0]} />
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

            {/* Agro Learning and Market Link cards side-by-side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-primary/10 rounded-xl p-4 text-center flex flex-col justify-between">
                <div>
                  <BookOpen className="h-6 w-6 mx-auto text-primary mb-2" />
                  <h4 className="font-bold text-sm mb-1">Agro Learning</h4>
                  <p className="text-[11px] text-muted-foreground mb-3">
                    Educational guides on climate adaptation &amp; crop management.
                  </p>
                </div>
                <Link to="/learning">
                  <Button size="sm" variant="default" className="w-full text-xs h-8">
                    Start Learning <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>

              <div className="bg-gradient-to-br from-primary/15 to-accent/10 rounded-xl p-4 text-center border border-primary/20 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-sm mb-1">🛒 Market Link</h4>
                  <p className="text-[11px] text-muted-foreground mb-3">
                    Global marketplace for agricultural supply, demand &amp; logistics.
                  </p>
                </div>
                <Link to="/marketplace/auth">
                  <Button size="sm" variant="default" className="w-full text-xs h-8">
                    Open Marketplace <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <Button size="lg" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            Sign up for personalized intelligence <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* What's New Section */}
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

      <footer className="container mx-auto px-4 py-6 text-center text-xs text-muted-foreground space-y-1">
        <div>{APP_FOOTER}</div>
        <div className="font-mono text-[10px] text-primary/80">{APP_VERSION_LABEL}</div>
      </footer>
    </div>
  );
}
