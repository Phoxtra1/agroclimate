import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import aminevaLogo from "@/assets/amineva-logo.png";

type VerificationState = {
  success: boolean;
  title: string;
  message: string;
};

function getVerificationState(): VerificationState {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const queryParams = new URLSearchParams(window.location.search);
  const error = hashParams.get("error") || queryParams.get("error");

  if (error) {
    const errorDescription = hashParams.get("error_description") || queryParams.get("error_description");
    return {
      success: false,
      title: "Verification Failed",
      message: errorDescription || "We could not verify your email. Please request a new verification link and try again.",
    };
  }

  return {
    success: true,
    title: "Verification Successful",
    message: "Verification Successful, login to access your account",
  };
}

export default function VerifyEmail() {
  const state = useMemo(getVerificationState, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <img src={aminevaLogo} alt="AgroClimate" className="h-12 w-12 rounded-full mx-auto" />
          <CardTitle>{state.title}</CardTitle>
          <CardDescription>{state.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/">
            <Button className="w-full">Go to Home</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
