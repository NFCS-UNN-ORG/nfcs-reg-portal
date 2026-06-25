"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { cn } from "@/lib/utils/cn";
import { Avatar } from "@/components/ui/avatar";
import { logout } from "@/lib/actions/auth.actions";
import {
  LayoutDashboard,
  User,
  CreditCard,
  Calendar,
  Megaphone,
  Users,
  Settings,
  FolderSync,
  LogOut,
  ShieldCheck,
  ClipboardList
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  roles: string[];
  badge?: {
    count: number;
    variant: "primary" | "attention" | "success";
  };
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, isLoading } = useUser();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
    router.refresh();
  };

  const role = profile?.role || "student";

  // Navigation schema
  const navItems: NavItem[] = [
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
    // Exco & Admin Items
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
    // Super Admin Items
    {
      name: "System Settings",
      href: "/admin/settings",
      icon: Settings,
      roles: ["super_admin"],
    },
  ];

  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[220px] flex-col border-r border-neutrals-border bg-surface p-[16px_12px] md:flex">
      {/* Brand Header */}
      <div className="flex items-center gap-2.5 border-b border-neutrals-borderLight pb-5 mb-4 px-2">
        <div className="h-8 w-8 rounded-[8px] overflow-hidden select-none">
          <img src="/nfcs-unn-logo.png" alt="NFCS UNN Logo" className="h-full w-full object-cover" />
        </div>
        <div className="flex flex-col">
          <span className="text-[14px] font-semibold text-text-primary leading-tight">
            NFCS UNN Portal
          </span>
          <span className="text-[10px] text-text-tertiary">
            University of Nigeria
          </span>
        </div>
      </div>

      {/* Nav Menu */}
      <div className="flex-1 overflow-y-auto space-y-1 py-2">
        <div className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider px-2 mb-2 select-none">
          Menu
        </div>
        <nav className="space-y-1">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 select-none",
                  isActive
                    ? "bg-brand text-white font-semibold"
                    : "text-text-secondary hover:bg-surface-page hover:text-text-primary"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive
                      ? "text-white"
                      : "text-text-tertiary group-hover:text-text-secondary"
                  )}
                />
                <span>{item.name}</span>

                {item.badge && item.badge.count > 0 && (
                  <span
                    className={cn(
                      "ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-semibold min-w-5 text-center text-white",
                      item.badge.variant === "attention" && "bg-danger",
                      item.badge.variant === "success" && "bg-brand-accent",
                      item.badge.variant === "primary" && "bg-[#6366F1]"
                    )}
                  >
                    {item.badge.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Section / Bottom Navigation */}
      <div className="mt-auto border-t border-neutrals-borderLight pt-4 space-y-3">
        {/* User Card */}
        {profile && (
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg select-none">
            <Avatar
              src={profile.passport_photo_url}
              name={profile.full_name}
              size="sm"
              className="border-2 border-neutrals-border shrink-0"
            />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[13px] font-semibold text-text-primary truncate flex items-center gap-1">
                {profile.full_name.split(" ")[0]}
                {profile.status === "active" && (
                  <ShieldCheck className="h-3.5 w-3.5 text-brand-accent shrink-0" />
                )}
              </span>
              <span className="text-[10px] text-text-tertiary uppercase font-semibold">
                {profile.role.replace("_", " ")}
              </span>
            </div>
          </div>
        )}

        {/* Log Out Button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-text-secondary hover:bg-surface-page hover:text-danger hover:bg-rose-50 transition-all duration-150 select-none text-left"
        >
          <LogOut className="h-4 w-4 shrink-0 text-text-tertiary group-hover:text-danger" />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  );
}
