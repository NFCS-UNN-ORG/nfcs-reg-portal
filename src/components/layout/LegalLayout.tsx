import * as React from "react";
import Link from "next/link";
import { PublicFooter } from "@/components/layout/Footer";
import { ArrowLeft, ShieldCheck } from "lucide-react";

interface LegalLayoutProps {
  children: React.ReactNode;
  title: string;
  lastUpdated: string;
}

export function LegalLayout({ children, title, lastUpdated }: LegalLayoutProps) {
  return (
    <div className="min-h-screen w-full bg-surface-page flex flex-col justify-between">
      {/* Top Header */}
      <header className="w-full border-b border-neutrals-borderLight bg-surface sticky top-0 z-30 shadow-sm">
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/login" className="flex items-center gap-3 group">
            <div className="size-9 rounded-lg overflow-hidden border border-neutrals-borderLight group-hover:scale-105 transition-transform">
              <img src="/nfcs-unn-logo.png" alt="NFCS UNN Logo" className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-text-primary leading-tight">
                NFCS UNN Portal
              </span>
              <span className="text-[10px] text-text-tertiary">
                University of Nigeria, Nsukka
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-subtle rounded-lg transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Back to Portal
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-brand hover:bg-brand-accent rounded-lg transition-colors shadow-sm"
            >
              Register
            </Link>
          </div>
        </div>
      </header>

      {/* Main Legal Content Container */}
      <main className="flex-1 w-full max-w-[900px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-surface border border-neutrals-borderLight shadow-card rounded-2xl p-6 sm:p-10 space-y-8">
          {/* Document Header Banner */}
          <div className="border-b border-neutrals-borderLight pb-6 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-brand bg-brand/10 border border-brand/20">
              <ShieldCheck className="size-3.5" />
              Legal Document
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
              {title}
            </h1>
            <p className="text-xs text-text-tertiary">
              Last updated: <span className="font-semibold text-text-secondary">{lastUpdated}</span>
            </p>
          </div>

          {/* Document Body */}
          <article className="prose prose-sm max-w-none text-text-secondary leading-relaxed space-y-6 text-xs sm:text-sm">
            {children}
          </article>
        </div>
      </main>

      {/* Footer */}
      <PublicFooter />
    </div>
  );
}
