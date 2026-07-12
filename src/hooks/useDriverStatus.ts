import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type DriverApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "more_info";

export interface DriverStatus {
  exists: boolean;
  approvalStatus: DriverApprovalStatus | null;
  adminSuspended: boolean;
  rejectionReason?: string;
  loading: boolean;
}

export function useDriverStatus(): DriverStatus {
  const { user } = useAuth();
  const [status, setStatus] = useState<DriverStatus>({
    exists: false,
    approvalStatus: null,
    adminSuspended: false,
    loading: true,
  });

  useEffect(() => {
    if (!user) {
      setStatus({ exists: false, approvalStatus: null, adminSuspended: false, loading: false });
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("agtrans_drivers")
          .select("approval_status, admin_suspended, rejection_reason")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error loading driver status:", error);
          if (!cancelled) {
            setStatus((prev) => ({ ...prev, loading: false }));
          }
          return;
        }

        if (cancelled) return;
        if (!data) {
          setStatus({ exists: false, approvalStatus: null, adminSuspended: false, loading: false });
        } else {
          setStatus({
            exists: true,
            approvalStatus: (data.approval_status as DriverApprovalStatus) || "pending",
            adminSuspended: data.admin_suspended || false,
            rejectionReason: data.rejection_reason || undefined,
            loading: false,
          });
        }
      } catch (err) {
        console.error("Uncaught error in useDriverStatus:", err);
        if (!cancelled) {
          setStatus((prev) => ({ ...prev, loading: false }));
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [user]);

  return status;
}
