import { Leaf, Sprout, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function LoadingScreen() {
  const [iconIndex, setIconIndex] = useState(0);
  
  // Cycle through icons to give a dynamic "growing" effect
  useEffect(() => {
    const interval = setInterval(() => {
      setIconIndex((prev) => (prev + 1) % 3);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md">
      <div className="relative flex items-center justify-center w-32 h-32">
        {/* Outer rotating dashed ring */}
        <div className="absolute inset-0 rounded-full border-t-2 border-r-2 border-primary/40 animate-[spin_3s_linear_infinite]" />
        
        {/* Middle pulsing and reverse rotating ring */}
        <div className="absolute inset-2 rounded-full border-b-2 border-l-2 border-emerald-500/60 animate-[spin_2s_reverse_infinite]" />
        
        {/* Inner solid ring */}
        <div className="absolute inset-4 rounded-full border border-primary/20 bg-gradient-to-tr from-primary/5 to-accent/5 animate-pulse" />

        {/* Center Dynamic Icon */}
        <div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary shadow-[0_0_15px_rgba(34,197,94,0.3)] transition-all duration-500 ease-in-out">
          {iconIndex === 0 && <Sprout className="h-6 w-6 animate-[bounce_1.5s_infinite]" />}
          {iconIndex === 1 && <Leaf className="h-6 w-6 animate-[pulse_1.5s_infinite]" />}
          {iconIndex === 2 && <Sun className="h-6 w-6 text-amber-500 animate-[spin_3s_linear_infinite]" />}
        </div>
      </div>
      
      {/* Loading Text */}
      <div className="mt-8 flex flex-col items-center space-y-2 text-center">
        <h2 className="text-xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-400 animate-pulse">
          AGROCLIMATE
        </h2>
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Cultivating data...
        </p>
      </div>
    </div>
  );
}
