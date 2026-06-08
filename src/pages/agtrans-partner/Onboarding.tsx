import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAGTrans } from "@/hooks/useAGTrans";
import { toast } from "sonner";
import { Truck, Upload, User, Briefcase, FileText, CheckCircle2, AlertCircle } from "lucide-react";

const splitCorridors = (value: string) => value.split(",").map((s) => s.trim()).filter(Boolean);

const validateDriverForm = (values: {
  fullName: string;
  phone: string;
  region: string;
  district: string;
  vehicle: string;
  plateNumber: string;
  capacity: string;
  licenseClass: string;
  corridors: string;
  licenseFile: File | null;
}) => {
  const missing: string[] = [];
  const capacityKg = Number(values.capacity);
  const routes = splitCorridors(values.corridors);

  if (!values.fullName.trim()) missing.push("Full Name");
  if (!values.phone.trim()) missing.push("Phone Number");
  if (!values.region.trim()) missing.push("Operational Region");
  if (!values.district.trim()) missing.push("Base District");
  if (!values.vehicle.trim()) missing.push("Vehicle Type");
  if (!values.plateNumber.trim()) missing.push("License Plate Number");
  if (!values.licenseClass.trim()) missing.push("Driver License Class");
  if (!Number.isFinite(capacityKg) || capacityKg <= 0) missing.push("Vehicle Capacity above 0 kg");
  if (routes.length === 0) missing.push("Preferred Transit Corridors");

  if (values.phone.trim() && !/^\+?[0-9\s().-]{7,20}$/.test(values.phone.trim())) missing.push("Valid phone number format");
  if (values.licenseFile && values.licenseFile.size > 10 * 1024 * 1024) missing.push("License file 10MB or smaller");
  if (values.licenseFile && !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(values.licenseFile.type)) {
    missing.push("License file as JPG, PNG, WebP, or PDF");
  }

  return missing.length ? `Please complete or correct: ${missing.join(", ")}.` : "";
};

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
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateDriverForm({ fullName, phone, region, district, vehicle, plateNumber, capacity, licenseClass, corridors, licenseFile });
    if (validationError) {
      setValidationMessage(validationError);
      toast.error(validationError);
      return;
    }

    setValidationMessage("");
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
        preferred_corridors: splitCorridors(corridors),
      }, licenseFile || undefined);
      toast.success("Profile submitted for verification");
      navigate("/agtrans-partner/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto my-12 px-4">
      <Card className="border-border/60 shadow-xl overflow-hidden bg-card/60 backdrop-blur-md transition-all duration-300 hover:shadow-2xl">
        <div className="h-2 bg-gradient-to-r from-emerald-500 via-primary to-teal-600" />
        <CardHeader className="text-center pt-8 pb-4">
          <div className="mx-auto bg-primary/10 w-16 h-16 flex items-center justify-center rounded-2xl mb-4 transition-transform duration-300 hover:scale-105">
            <Truck className="h-8 w-8 text-primary animate-pulse" />
          </div>
          <CardTitle className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
            Partner Onboarding
          </CardTitle>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto text-sm">
            Complete your profile to register your vehicle and begin receiving cargo transit orders.
          </p>
        </CardHeader>
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Section 1: Personal & Location Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2 mb-4 border-border/40">
                <User className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">Personal Details</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
                  <Input 
                    id="fullName" 
                    placeholder="e.g. John Koomson" 
                    value={fullName} 
                    onChange={(e) => setFullName(e.target.value)} 
                    required 
                    className="focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
                  <Input 
                    id="phone" 
                    placeholder="e.g. +233 24 123 4567" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    required 
                    className="focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="region" className="text-sm font-medium">Operational Region</Label>
                  <Input 
                    id="region" 
                    placeholder="e.g. Ashanti Region" 
                    value={region} 
                    onChange={(e) => setRegion(e.target.value)} 
                    required 
                    className="focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="district" className="text-sm font-medium">Base District</Label>
                  <Input 
                    id="district" 
                    placeholder="e.g. Kumasi Metropolitan" 
                    value={district} 
                    onChange={(e) => setDistrict(e.target.value)} 
                    required 
                    className="focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Vehicle & Cargo Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2 mb-4 border-border/40">
                <Truck className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">Vehicle Details</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="vehicle" className="text-sm font-medium">Vehicle Type</Label>
                  <Input 
                    id="vehicle" 
                    placeholder="e.g. 10-Ton Tipper Truck, 5-Ton Box Van" 
                    value={vehicle} 
                    onChange={(e) => setVehicle(e.target.value)} 
                    required 
                    className="focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capacity" className="text-sm font-medium">Vehicle Capacity (kg)</Label>
                  <Input 
                    id="capacity" 
                    type="number" 
                    placeholder="e.g. 10000" 
                    value={capacity} 
                    onChange={(e) => setCapacity(e.target.value)} 
                    required 
                    className="focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plateNumber" className="text-sm font-medium">License Plate Number</Label>
                  <Input 
                    id="plateNumber" 
                    placeholder="e.g. AS 4567-24" 
                    value={plateNumber} 
                    onChange={(e) => setPlateNumber(e.target.value)} 
                    required 
                    className="focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="licenseClass" className="text-sm font-medium">Driver License Class</Label>
                  <Input 
                    id="licenseClass" 
                    placeholder="e.g. Class F" 
                    value={licenseClass} 
                    onChange={(e) => setLicenseClass(e.target.value)} 
                    required 
                    className="focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Route Coverage & Verification Documents */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2 mb-4 border-border/40">
                <Briefcase className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">Logistics & Verification</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="corridors" className="text-sm font-medium">Preferred Transit Corridors</Label>
                  <Input 
                    id="corridors" 
                    placeholder="e.g. Kumasi ↔ Accra, Tamale ↔ Kumasi (comma-separated)" 
                    value={corridors} 
                    onChange={(e) => setCorridors(e.target.value)} 
                    required 
                    className="focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Specify major routes or paths you cover regularly.</p>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="licenseFile" className="text-sm font-medium">Upload Driver's License (Optional)</Label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-lg border-border/60 hover:border-primary/50 transition-all bg-muted/20 relative group">
                    <div className="space-y-2 text-center">
                      <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
                        {licenseFile ? (
                          <CheckCircle2 className="h-6 w-6 text-emerald-500 animate-bounce" />
                        ) : (
                          <Upload className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                        )}
                      </div>
                      <div className="flex text-sm text-muted-foreground justify-center">
                        <label
                          htmlFor="licenseFile"
                          className="relative cursor-pointer rounded-md font-medium text-primary hover:text-primary/80 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary"
                        >
                          <span>{licenseFile ? "Replace uploaded document" : "Upload a file"}</span>
                          <input 
                            id="licenseFile" 
                            type="file" 
                            accept="image/*,.pdf" 
                            onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
                            className="sr-only" 
                          />
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {licenseFile ? `Selected: ${licenseFile.name} (${(licenseFile.size / 1024).toFixed(1)} KB)` : "PNG, JPG, PDF up to 10MB"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/95 transition-all shadow-md hover:shadow-lg rounded-xl flex items-center justify-center gap-2 mt-4" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading Credentials & Registering...
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5" /> Submit Onboarding Profile
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
