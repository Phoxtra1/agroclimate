import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAGTrans } from "@/hooks/useAGTrans";
import { toast } from "sonner";
import { Truck } from "lucide-react";

export default function DriverOnboarding() {
  const { createDriverProfile } = useAGTrans();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState("");
  const [license, setLicense] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createDriverProfile({
        vehicle_type: vehicle,
        license_number: license,
      });
      toast.success("Profile submitted for verification");
      navigate("/agtrans-partner/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 w-12 h-12 flex items-center justify-center rounded-full mb-4">
            <Truck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Partner Onboarding</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Complete your profile to start accepting transport requests.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vehicle">Vehicle Type / Capacity</Label>
              <Input
                id="vehicle"
                placeholder="e.g. 10-Ton Truck, 5-Ton Van"
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="license">Driver's License Number</Label>
              <Input
                id="license"
                placeholder="Enter license number"
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Submitting..." : "Submit Application"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
