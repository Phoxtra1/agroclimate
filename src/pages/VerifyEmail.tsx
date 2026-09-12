import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import agyenkwaIcon from "@/assets/agyenkwa-icon.png";

type Status = "loading" | "success" | "error";

export default function VerifyEmail() {
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("Verifying your account, please wait...");

  useEffect(() => {
    const handleVerification = async () => {
      try {
        // 1. Check if Supabase session exists (after clicking email link)
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Session error:", error.message);
          setStatus("error");
          setMessage("We could not verify your email. Please try again.");
          return;
        }

        if (data.session) {
          // Sign out immediately so they don't get auto-redirected to the dashboard
          // This enforces the "login tab to redirect main login page" requirement
          await supabase.auth.signOut();
          
          // SUCCESS
          setStatus("success");
          setMessage("Your account is ready. You can now log in and start using AgroClimate.");
        } else {
          // No session → fallback to URL error check
          const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
          const queryParams = new URLSearchParams(window.location.search);

          const errorParam =
            hashParams.get("error") || queryParams.get("error");

          const errorDescription =
            hashParams.get("error_description") ||
            queryParams.get("error_description");

          if (errorParam) {
            setStatus("error");
            setMessage(
              errorDescription ||
                "Verification failed. Please request a new verification link."
            );
          } else {
            setStatus("error");
            setMessage("Invalid or expired verification link.");
          }
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      }
    };

    handleVerification();
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <img
            src={agyenkwaIcon}
            alt="AgroClimate Logo"
            className="h-12 w-12 rounded-full mx-auto"
          />
          <CardTitle>
            {status === "loading" && "Verifying Email"}
            {status === "success" && "Verification Successful"}
            {status === "error" && "Verification Failed"}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {status === "success" && (
            <Link to="/">
              <Button className="w-full">Go to Login</Button>
            </Link>
          )}

          {status === "error" && (
            <Link to="/">
              <Button variant="outline" className="w-full">
                Try Again
              </Button>
            </Link>
          )}

          {status === "loading" && (
            <Button disabled className="w-full">
              Processing...
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
