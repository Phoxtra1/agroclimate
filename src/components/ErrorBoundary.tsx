import React, { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <Card className="max-w-md w-full border-destructive/40 shadow-lg">
            <CardHeader className="text-center pb-2">
              <ShieldAlert className="h-10 w-10 text-destructive mx-auto mb-2" />
              <CardTitle className="text-lg font-bold text-foreground">
                {this.props.fallbackTitle || "System Workspace Recovery"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-xs text-muted-foreground leading-relaxed">
                An unexpected system boundary exception occurred. The platform prevented a total screen collapse.
              </p>
              {this.state.error?.message && (
                <div className="bg-destructive/10 p-2.5 rounded-md text-[11px] font-mono text-destructive text-left overflow-x-auto">
                  {this.state.error.message}
                </div>
              )}
              <div className="flex items-center gap-2 pt-2">
                <Button size="sm" variant="default" onClick={this.handleReset} className="flex-1 text-xs">
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Reload Workspace
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.location.href = "/"} className="flex-1 text-xs">
                  <Home className="h-3.5 w-3.5 mr-1.5" /> Go Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
