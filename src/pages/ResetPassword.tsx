import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import aminevaLogo from "@/assets/amineva-logo.png";

type Status = "loading" | "ready" | "success" | "error";

export default function ResetPassword() {
  const navigate = useNavigate();

  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("Preparing password reset...");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Session error:", error.message);
          setStatus("error");
          setMessage("Invalid or expired reset link.");
          return;
        }

        if (data.session) {
          setStatus("ready");
          setMessage("Enter your new password below.");
        } else {
          setStatus("error");
          setMessage("Invalid or expired reset link.");
        }
      } catch (err) {
        console.error(err);
        setStatus("error");
        setMessage("Something went wrong. Please try again.");
      }
    };

    checkSession();
  }, []);

  const handleReset = async () => {
    if (!password || !confirmPassword) {
      setMessage("Please enter your password.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    setStatus("loading");
    setMessage("Updating your password...");

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      console.error(error.message);
      setStatus("error");
      setMessage("Failed to reset password. Try again.");
    } else {
      setStatus("success");
      setMessage("Password successfully updated. You can now log in.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <img
            src={aminevaLogo}
            alt="Amineva Logo"
            className="h-12 w-12 rounded-full mx-auto"
          />
          <CardTitle>
            {status === "loading" && "Reset Password"}
            {status === "ready" && "Create New Password"}
            {status === "success" && "Password Updated"}
            {status === "error" && "Reset Failed"}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          {status === "ready" && (
            <>
              <input
                type="password"
                placeholder="New Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 border rounded-md"
              />
              <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-2 border rounded-md"
              />
              <Button className="w-full" onClick={handleReset}>
                Reset Password
              </Button>
            </>
          )}

          {status === "success" && (
            <Button className="w-full" onClick={() => navigate("/login")}>
              Go to Login
            </Button>
          )}

          {status === "error" && (
            <Button variant="outline" className="w-full" onClick={() => navigate("/forgot-password")}>
              Request New Link
            </Button>
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
