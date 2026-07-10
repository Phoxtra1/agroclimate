import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, FileText, AlertCircle, CheckCircle2, XCircle, HelpCircle, ArrowRight } from "lucide-react";
import { useDriverStatus } from "@/hooks/useDriverStatus";

export default function PendingApproval() {
  const { exists, approvalStatus, adminSuspended, rejectionReason, loading } = useDriverStatus();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && approvalStatus === "approved" && !adminSuspended) {
      navigate("/agtrans-partner/dashboard", { replace: true });
    }
  }, [loading, approvalStatus, adminSuspended, navigate]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statusContent = {
    pending: {
      title: "Pending Approval",
      description: "Your driver application is under review. We'll notify you once approved.",
      icon: <HelpCircle className="h-10 w-10 text-amber-500" />,
      variant: "secondary" as const,
    },
    approved: {
      title: "Approved",
      description: "Your account is approved. Redirecting to dashboard...",
      icon: <CheckCircle2 className="h-10 w-10 text-green-500" />,
      variant: "default" as const,
    },
    rejected: {
      title: "Rejected",
      description: "Your application was not approved. You can edit and resubmit.",
      icon: <XCircle className="h-10 w-10 text-red-500" />,
      variant: "destructive" as const,
    },
    more_info: {
      title: "More Information Required",
      description: "Please update your profile with the requested details.",
      icon: <AlertCircle className="h-10 w-10 text-amber-500" />,
      variant: "outline" as const,
    },
  };

  const current = statusContent[approvalStatus || "pending"];

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            {current.icon}
          </div>
          <CardTitle className="text-2xl">{current.title}</CardTitle>
          <CardDescription>{current.description}</CardDescription>
          <div className="mt-4 flex justify-center">
            <Badge variant={current.variant}>{(approvalStatus || "pending").replace("_", " ").toUpperCase()}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {adminSuspended && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 inline mr-2" />
              Your driver account is currently suspended. Contact support for more information.
            </div>
          )}

          {(approvalStatus === "rejected" || approvalStatus === "more_info") && rejectionReason && (
            <div className="rounded-lg border bg-muted p-4 text-sm">
              <span className="font-semibold">Reason / Request:</span>
              <p className="mt-1 text-muted-foreground">{rejectionReason}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <Button variant="outline" className="w-full" onClick={() => navigate("/agtrans-partner/onboarding")}>
              <FileText className="h-4 w-4 mr-2" />
              {approvalStatus === "rejected" || approvalStatus === "more_info" ? "Edit & Resubmit" : "View Onboarding Form"}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => navigate("/profile")}>
              <User className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          </div>

          {approvalStatus === "approved" && (
            <Button className="w-full" onClick={() => navigate("/agtrans-partner/dashboard")}>
              Go to Dashboard <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
