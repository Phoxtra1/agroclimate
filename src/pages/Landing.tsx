import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TodayWeather, ForecastRow } from "@/components/WeatherCard";
import { AlertCard } from "@/components/AlertCard";
import { weeklyForecast, alerts } from "@/data/mock-data";
import { Cloud, Sprout, Bell, Fish, ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Landing() {
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    if (error) toast({ title: "Login failed", description: error.message, variant: "destructive" });
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signUp(regEmail, regPassword, regName);
    if (error) {
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Account created!", description: "Please check your email to verify your account." });
    }
    setLoading(false);
  };

  const features = [
    { icon: Cloud, title: "Weather Intelligence", desc: "Localized 7-day forecasts with rainfall, temperature & wind data" },
    { icon: Sprout, title: "Crop Advisory", desc: "Planting windows, fertilizer timing & pest risk alerts" },
    { icon: Bell, title: "Smart Alerts", desc: "Real-time warnings via app and SMS for extreme weather" },
    { icon: Fish, title: "Aquaculture", desc: "Fish pond monitoring with water quality & feeding schedules" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="container mx-auto px-4 py-8 lg:py-16">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            {/* Left: branding + features */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                  <Sprout className="h-6 w-6 text-primary-foreground" />
                </div>
                <h1 className="text-2xl font-extrabold text-foreground">AgroClimate</h1>
              </div>
              <h2 className="text-3xl lg:text-5xl font-extrabold text-foreground leading-tight mb-4">
                Smart farming starts with <span className="text-gradient-primary">better weather data</span>
              </h2>
              <p className="text-muted-foreground text-lg mb-8 max-w-lg">
                Reduce crop failure with localized forecasts, crop-specific guidance, climate risk alerts, and aquaculture monitoring — all in one app.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {features.map((f) => (
                  <div key={f.title} className="flex gap-3 items-start">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <f.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{f.title}</p>
                      <p className="text-xs text-muted-foreground">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Auth card */}
            <div className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
              <Card className="shadow-xl border-border/50">
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl">Get Started</CardTitle>
                  <CardDescription>Join thousands of farmers using AgroClimate</CardDescription>
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
                        <Button type="submit" className="w-full" disabled={loading}>
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
                        </Button>
                      </form>
                    </TabsContent>

                    <TabsContent value="register">
                      <form onSubmit={handleRegister} className="space-y-3">
                        <Input placeholder="Full Name" value={regName} onChange={(e) => setRegName(e.target.value)} required />
                        <Input placeholder="Email" type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required />
                        <Input placeholder="Password (min 6 chars)" type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required minLength={6} />
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

      {/* Preview Section — accessible without login */}
      <section className="container mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold mb-2">Preview: What You'll Get</h3>
          <p className="text-muted-foreground">Live weather data and crop alerts, personalized for your region</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Weather preview */}
          <div className="lg:col-span-2">
            <TodayWeather weather={weeklyForecast[0]} />
            <div className="bg-card rounded-xl p-4 shadow-sm mt-4">
              {weeklyForecast.slice(0, 4).map((day) => (
                <ForecastRow key={day.day} day={day} />
              ))}
            </div>
          </div>

          {/* Alerts preview */}
          <div className="space-y-3">
            <h4 className="font-bold text-lg">Recent Alerts</h4>
            {alerts.slice(0, 3).map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>

        <div className="text-center mt-8">
          <Button size="lg" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            Sign up to get personalized data <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>
    </div>
  );
}
