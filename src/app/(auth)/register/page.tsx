import * as React from "react";
import { AuthContainer } from "@/components/auth/AuthContainer";

export default function RegisterPage() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-surface-page py-12 px-4 relative overflow-hidden">
      <div className="w-full max-w-[850px] flex flex-col gap-6 relative z-10 animate-in fade-in duration-300 items-center">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-2 select-none">
          <div className="size-24 rounded-[12px] overflow-hidden">
            <img src="/nfcs-unn-logo.png" alt="NFCS UNN Logo" className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              NFCS UNN Portal
            </h1>
            <p className="text-xs text-text-secondary">
              Catholic Student & Alumni Member Portal
            </p>
          </div>
        </div>

        <AuthContainer initialTab="register" />

        {/* Footer info */}
        <p className="text-center text-[10px] text-text-tertiary">
          &copy; {new Date().getFullYear()} NFCS UNN. All rights reserved.
        </p>
      </div>
    </main>
  );
}
