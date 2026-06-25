"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils/cn";
import {
  Bell,
  Search,
  ChevronDown,
  Menu,
  User as UserIcon,
  LogOut,
  ShieldCheck,
  Home,
  Moon,
  Sun,
  Laptop,
} from "lucide-react";
import { logout } from "@/lib/actions/auth.actions";
import Link from "next/link";
import { useTheme } from "@/lib/utils/theme";
import {
  SelectPrimitive,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select";

interface NavbarProps {
  onMenuToggle?: () => void;
}

export function Navbar({ onMenuToggle }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useUser();
  const { theme, setTheme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
    router.refresh();
  };

  // Generate breadcrumbs from pathname
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const label = segment.charAt(0).toUpperCase() + segment.slice(1).replace("-", " ");
    const isLast = index === segments.length - 1;

    return { label, href, isLast };
  });

  return (
    <header className="sticky top-0 z-30 flex h-[60px] w-full items-center justify-between border-b border-neutrals-borderLight bg-surface px-4 md:px-6 select-none shadow-none">
      {/* Left side: Mobile Toggle & Page Title / Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutrals-border text-text-secondary md:hidden hover:bg-surface-page transition-colors"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </button>

        {/* Breadcrumb / Title */}
        <div className="hidden items-center gap-1.5 text-[13px] text-text-tertiary md:flex">
          <Link href="/dashboard" className="hover:text-text-primary">
            <Home className="h-3.5 w-3.5" />
          </Link>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.href}>
              <span className="text-text-tertiary">/</span>
              {crumb.isLast ? (
                <span className="font-semibold text-text-primary truncate max-w-[150px]">
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className="hover:text-text-primary truncate max-w-[150px]">
                  {crumb.label}
                </Link>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Mobile Page Title */}
        <span className="text-sm font-bold text-text-primary md:hidden">
          {breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].label : "Portal"}
        </span>
      </div>

      {/* Right side: Search, Notifications, Profile Dropdown */}
      <div className="flex items-center gap-4">
        {/* Search Input */}
        <div className="relative hidden max-w-xs md:block">
          <Search className="absolute left-3 top-[10px] h-4 w-4 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search..."
            className="h-9 w-[200px] rounded-lg bg-surface-page border border-transparent pl-9 pr-4 text-[13px] text-text-primary placeholder:text-text-tertiary transition-all focus:border-brand-accent focus:bg-white focus:outline-none focus:shadow-inputFocus"
          />
        </div>

        {/* Theme Select Dropdown */}
        <SelectPrimitive.Root
          value={theme}
          onValueChange={(val) => setTheme(val as any)}
        >
          <SelectTrigger
            className="h-9 w-[110px] rounded-lg border-none bg-transparent px-2 text-xs hover:bg-surface-page focus:ring-0 focus:shadow-none gap-1 text-text-secondary"
            size="sm"
          >
            <span className="flex items-center gap-1.5">
              {theme === "light" && <Sun className="h-4 w-4 text-amber-honey" />}
              {theme === "dark" && <Moon className="h-4 w-4" />}
              {theme === "system" && <Laptop className="h-4 w-4" />}
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectPopup align="end" className="w-[125px]">
            <SelectItem value="light">
              <span className="flex items-center gap-1.5">
                <Sun className="h-3.5 w-3.5 text-amber-honey" />
                <span>Light</span>
              </span>
            </SelectItem>
            <SelectItem value="dark">
              <span className="flex items-center gap-1.5">
                <Moon className="h-3.5 w-3.5" />
                <span>Dark</span>
              </span>
            </SelectItem>
            <SelectItem value="system">
              <span className="flex items-center gap-1.5">
                <Laptop className="h-3.5 w-3.5" />
                <span>System</span>
              </span>
            </SelectItem>
          </SelectPopup>
        </SelectPrimitive.Root>

        {/* Notifications Icon Button */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-page transition-colors border-none bg-transparent">
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-[6px] top-[6px] h-2 w-2 rounded-full bg-danger border-2 border-white" />
          <span className="sr-only">Notifications</span>
        </button>

        {/* Profile Dropdown Trigger */}
        {profile && (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 rounded-lg p-1 hover:bg-surface-page transition-colors focus:outline-none"
            >
              <Avatar
                src={profile.passport_photo_url}
                name={profile.full_name}
                size="sm"
              />
              <span className="hidden text-[13px] font-semibold text-text-secondary md:block">
                {profile.full_name.split(" ")[0]}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-1.5 w-48 origin-top-right rounded-[10px] border border-neutrals-border bg-surface p-1.5 shadow-dropdown z-20 animate-in fade-in-50 slide-in-from-top-1 duration-100">
                  <div className="px-2.5 py-1.5 text-xs border-b border-neutrals-borderLight">
                    <p className="font-semibold text-text-primary truncate">
                      {profile.full_name}
                    </p>
                    <p className="text-[10px] text-text-tertiary truncate">
                      {profile.email}
                    </p>
                  </div>
                  
                  <Link
                    href="/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] text-text-secondary hover:bg-surface-page hover:text-text-primary transition-colors"
                  >
                    <UserIcon className="h-4 w-4 text-text-tertiary" />
                    <span>My Profile</span>
                  </Link>
                  
                  {["exco", "super_admin"].includes(profile.role) && (
                    <Link
                      href="/admin/settings"
                      onClick={() => setDropdownOpen(false)}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] text-text-secondary hover:bg-surface-page hover:text-text-primary transition-colors"
                    >
                      <ShieldCheck className="h-4 w-4 text-text-tertiary" />
                      <span>Admin Settings</span>
                    </Link>
                  )}
                  
                  <div className="my-1 border-t border-neutrals-borderLight" />
                  
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] text-danger hover:bg-rose-50 transition-colors"
                  >
                    <LogOut className="h-4 w-4 text-danger opacity-70" />
                    <span>Log Out</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
