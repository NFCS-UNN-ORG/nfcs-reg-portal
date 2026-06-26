"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { LoginForm } from "@/components/forms/LoginForm";
import { RegistrationForm } from "@/components/forms/RegistrationForm";
import { cn } from "@/lib/utils/cn";
import { usePathname, useRouter } from "next/navigation";

interface AuthContainerProps {
  initialTab?: "login" | "register";
}

export function AuthContainer({ initialTab = "login" }: AuthContainerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = React.useState<"login" | "register">(initialTab);

  // Sync tab state with route changes (e.g. back button / direct link)
  React.useEffect(() => {
    if (pathname.includes("/register")) {
      setActiveTab("register");
    } else if (pathname.includes("/login")) {
      setActiveTab("login");
    }
  }, [pathname]);

  const handleTabChange = (tab: "login" | "register") => {
    setActiveTab(tab);
    if (tab === "login") {
      router.push("/login", { scroll: false });
    } else {
      router.push("/register", { scroll: false });
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 items-center">
      {/* Tab Switcher */}
      <div className="flex bg-surface-subtle p-1 rounded-xl border-thick border-brand select-none relative z-10 w-full max-w-[280px] justify-between">
        <button
          onClick={() => handleTabChange("login")}
          className={cn(
            "flex-1 py-2 text-xs font-semibold rounded-lg transition-all relative outline-none",
            activeTab === "login" ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
          )}
        >
          {activeTab === "login" && (
            <motion.div
              layoutId="activeTabIndicator"
              className="absolute inset-0 bg-brand shadow-pill-tab-active border border-neutrals-borderLight rounded-lg z-0"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          <span className="relative z-10">Sign In</span>
        </button>
        <button
          onClick={() => handleTabChange("register")}
          className={cn(
            "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all relative outline-none",
            activeTab === "register" ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
          )}
        >
          {activeTab === "register" && (
            <motion.div
              layoutId="activeTabIndicator"
              className="absolute inset-0 bg-brand shadow-pill-tab-active border border-neutrals-borderLight rounded-lg z-0"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          <span className="relative z-10">Create Account</span>
        </button>
      </div>

      {/* Dynamic Morphing Card */}
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className={cn(
          "bg-surface border border-neutrals-borderLight shadow-modal rounded-2xl overflow-hidden transition-all duration-300 w-full z-10",
          activeTab === "login" ? "max-w-[400px]" : "max-w-[850px]"
        )}
      >
        <motion.div layout className="p-0">
          <AnimatePresence mode="wait">
            {activeTab === "login" ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
                className="p-8"
              >
                <div className="flex flex-col gap-1 mb-6 text-left">
                  <h2 className="text-base font-bold text-text-primary">Welcome Back</h2>
                  <p className="text-xs text-text-tertiary">Enter your credentials to access your dashboard.</p>
                </div>
                <LoginForm />
              </motion.div>
            ) : (
              <motion.div
                key="register"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.2 }}
              >
                <RegistrationForm />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
}
