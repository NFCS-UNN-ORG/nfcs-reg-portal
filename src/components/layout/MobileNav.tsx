"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { cn } from "@/lib/utils/cn";
import { Avatar } from "@/components/ui/avatar";
import { logout } from "@/lib/actions/auth.actions";
import { X, LogOut, ShieldCheck } from "lucide-react";
import {
  LayoutDashboard,
  User,
  CreditCard,
  Calendar,
  Megaphone,
  Users,
  Settings,
  FolderSync,
  ClipboardList
} from "lucide-react";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useUser();

  if (!isOpen) return null;

  const handleLogout = async () => {
    await logout();
    onClose();
    router.push("/login");
    router.refresh();
  };

  const role = profile?.role || "student";

  const navItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      roles: ["student", "alumnus", "exco", "super_admin"],
    },
    {
      name: "My Profile",
      href: "/profile",
      icon: User,
      roles: ["student", "alumnus", "exco", "super_admin"],
    },
    {
      name: "Dues & Payments",
      href: "/dues",
      icon: CreditCard,
      roles: ["student", "alumnus", "exco"],
    },
    {
      name: "Events",
      href: "/events",
      icon: Calendar,
      roles: ["student", "alumnus", "exco", "super_admin"],
    },
    {
      name: "Announcements",
      href: "/announcements",
      icon: Megaphone,
      roles: ["student", "alumnus", "exco", "super_admin"],
    },
    // Exco Items
    {
      name: "Member Directory",
      href: "/admin/members",
      icon: Users,
      roles: ["exco", "super_admin"],
    },
    {
      name: "Manage Dues",
      href: "/admin/dues",
      icon: ClipboardList,
      roles: ["exco", "super_admin"],
    },
    {
      name: "Legacy Migration",
      href: "/admin/members/migrate",
      icon: FolderSync,
      roles: ["exco", "super_admin"],
    },
    // Admin Settings
    {
      name: "System Settings",
      href: "/admin/settings",
      icon: Settings,
      roles: ["super_admin"],
    },
  ];

  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <div className="fixed inset-0 z-50 md:hidden flex">
      {/* Background Overlay */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-150 animate-in fade-in-0"
        onClick={onClose}
      />

      {/* Slide-in Content */}
      <div className="relative flex w-[240px] max-w-xs flex-col bg-surface p-[16px_12px] shadow-modal animate-in slide-in-from-left duration-200">
        {/* Header with logo & close */}
        <div className="flex items-center justify-between border-b border-neutrals-borderLight pb-4 mb-4 px-2">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-[6px] overflow-hidden select-none">
              <img src="/nfcs-unn-logo.png" alt="NFCS UNN Logo" className="h-full w-full object-cover" />
            </div>
            <span className="text-[13px] font-semibold text-text-primary">
              NFCS UNN
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-text-secondary hover:bg-surface-page transition-colors border-none bg-transparent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto space-y-1 py-1">
          <nav className="space-y-1">
            {visibleItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 select-none",
                    isActive
                      ? "bg-brand text-white font-semibold"
                      : "text-text-secondary hover:bg-surface-page hover:text-text-primary"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "text-white" : "text-text-tertiary"
                    )}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User profile footer */}
        <div className="mt-auto border-t border-neutrals-borderLight pt-4 space-y-3">
          {profile && (
            <div className="flex items-center gap-2.5 px-2 py-1">
              <Avatar
                src={profile.passport_photo_url}
                name={profile.full_name}
                size="sm"
              />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[12px] font-semibold text-text-primary truncate flex items-center gap-0.5">
                  {profile.full_name.split(" ")[0]}
                  {profile.status === "active" && (
                    <ShieldCheck className="h-3 w-3 text-brand-accent shrink-0" />
                  )}
                </span>
                <span className="text-[9px] text-text-tertiary uppercase font-semibold">
                  {profile.role.replace("_", " ")}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-text-secondary hover:bg-surface-page hover:text-danger hover:bg-rose-50 transition-all duration-150 select-none text-left"
          >
            <LogOut className="h-4 w-4 shrink-0 text-text-tertiary" />
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
