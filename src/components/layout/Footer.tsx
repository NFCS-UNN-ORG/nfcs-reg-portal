import * as React from "react";
import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="w-full border-t border-neutrals-borderLight bg-surface py-6 px-4 select-none">
      <div className="max-w-[850px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-xs text-text-tertiary">
        <div>
          &copy; {new Date().getFullYear()} NFCS UNN. All rights reserved.
        </div>
        <div className="flex items-center gap-6 font-medium text-text-secondary">
          <Link href="/privacy" className="hover:text-brand transition-colors">
            Privacy Policy
          </Link>
          <span className="text-neutrals-borderLight">•</span>
          <Link href="/terms" className="hover:text-brand transition-colors">
            Terms of Service
          </Link>
        </div>
      </div>
    </footer>
  );
}
