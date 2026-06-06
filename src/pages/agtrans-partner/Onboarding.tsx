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
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");
  const [district, setDistrict] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [capacity, setCapacity] = useState("");
  const [licenseClass, setLicenseClass] = useState("");
  const [corridors, setCorridors] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createDriverProfile({
        full_name: fullName,
        phone,
        region,
        district,
        vehicle_type: vehicle,
        plate_number: plateNumber,
        vehicle_capacity_kg: capacity ? Number(capacity) : 0,
        license_class: licenseClass || "D",
        preferred_corridors: corridors ? corridors.split(",").map((s) => s.trim()).filter(Boolean) : [],
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
    <div className="max-w-2xl mx-auto mt-10">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" placeholder="Your full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" placeholder="e.g. +233..." value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="region">Region</Label>
                <Input id="region" placeholder="Operational Region" value={region} onChange={(e) => setRegion(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="district">District</Label>
                <Input id="district" placeholder="Base District" value={district} onChange={(e) => setDistrict(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle">Vehicle Type</Label>
                <Input id="vehicle" placeholder="e.g. 10-Ton Truck, 5-Ton Van" value={vehicle} onChange={(e) => setVehicle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Vehicle Capacity (kg)</Label>
                <Input id="capacity" type="number" placeholder="e.g. 10000" value={capacity} onChange={(e) => setCapacity(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plateNumber">Plate Number</Label>
                <Input id="plateNumber" placeholder="e.g. GT 1234-24" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="corridors">Preferred Delivery Corridors</Label>
                <Input id="corridors" placeholder="e.g. Kumasi ↔ Accra, Tamale ↔ Accra" value={corridors} onChange={(e) => setCorridors(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="licenseClass">License Class</Label>
                <Input id="licenseClass" placeholder="e.g. C, D, E" value={licenseClass} onChange={(e) => setLicenseClass(e.target.value)} required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="licenseFile">Upload License Document (Optional)</Label>
                <Input id="licenseFile" type="file" accept="image/*,.pdf" />
              </div>

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
