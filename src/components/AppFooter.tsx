import { APP_FOOTER, APP_VERSION_LABEL } from "@/config/version";

export function AppFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer className={`w-full border-t border-border/60 bg-background/60 backdrop-blur-sm ${compact ? "py-2" : "py-3"} px-4 mt-6`}>
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="font-medium">{APP_FOOTER}</span>
        <span className="font-mono text-[10px] text-primary/80">{APP_VERSION_LABEL}</span>
      </div>
    </footer>
  );
}

export default AppFooter;
