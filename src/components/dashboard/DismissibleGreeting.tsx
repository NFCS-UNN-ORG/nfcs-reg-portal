"use client";

import * as React from "react";
import { Sparkles, X } from "lucide-react";

interface DismissibleGreetingProps {
  name: string;
}

export function DismissibleGreeting({ name }: DismissibleGreetingProps) {
  const [dismissed, setDismissed] = React.useState(false);

  // Check if already dismissed in this session
  React.useEffect(() => {
    const key = `greeting-dismissed-${new Date().toDateString()}`;
    if (sessionStorage.getItem(key)) {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    const key = `greeting-dismissed-${new Date().toDateString()}`;
    sessionStorage.setItem(key, "1");
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className="flex flex-col gap-1.5 bg-brand text-white p-6 md:p-8 rounded-[12px] shadow-card relative overflow-hidden select-none animate-in fade-in duration-300">
      <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-15 pointer-events-none flex items-center justify-center">
        <Sparkles className="h-32 w-32 text-white" />
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss greeting"
        className="absolute top-3 right-3 h-7 w-7 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors z-10"
      >
        <X className="h-4 w-4 text-white" />
      </button>
      <div className="z-10 flex flex-col gap-1">
        <span className="text-[11px] font-semibold tracking-[0.25rem] uppercase opacity-75">
          Overview
        </span>
        <h2 className="text-xl md:text-2xl font-bold tracking-tight">
          Peace be with you, {name.split(" ")[0]}!
        </h2>
        <p className="text-xs md:text-sm text-text-onAccent opacity-90 max-w-md">
          Welcome to the NFCS UNN Portal. Access your dues history, check calendar events, and view announcements.
        </p>
      </div>
    </div>
  );
}
