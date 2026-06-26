"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { cn } from "@/lib/utils/cn";
import { motion, AnimatePresence } from "motion/react";
import {
    LayoutDashboard,
    User,
    CreditCard,
    Calendar,
    Megaphone,
    Users,
    ClipboardList,
    FolderSync,
    Settings,
} from "lucide-react";

interface NavItem {
    name: string;
    href: string;
    icon: React.ElementType;
    roles: string[];
}

const navItems: NavItem[] = [
    // Student / Alumnus
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["student", "alumnus", "exco", "super_admin"] },
    { name: "Events", href: "/events", icon: Calendar, roles: ["student", "alumnus", "exco", "super_admin"] },
    { name: "News", href: "/announcements", icon: Megaphone, roles: ["student", "alumnus", "exco", "super_admin"] },
    { name: "Profile", href: "/profile", icon: User, roles: ["student", "alumnus", "exco", "super_admin"] },
    // Exco extras
    { name: "Members", href: "/admin/members", icon: Users, roles: ["exco", "super_admin"] },
    { name: "Dues", href: "/admin/dues", icon: ClipboardList, roles: ["exco", "super_admin"] },
    // Super admin extras
    { name: "Migration", href: "/admin/members/migrate", icon: FolderSync, roles: ["super_admin"] },
    { name: "Settings", href: "/admin/settings", icon: Settings, roles: ["super_admin"] },
];

// Best nav combos per role (max 5 items for mobile comfort)
const roleNavMap: Record<string, string[]> = {
    student: ["/dashboard", "/events", "/announcements", "/profile"],
    alumnus: ["/dashboard", "/events", "/announcements", "/profile"],
    exco: ["/dashboard", "/events", "/admin/members", "/admin/dues", "/announcements"],
    super_admin: ["/dashboard", "/admin/members", "/admin/dues", "/admin/members/migrate", "/admin/settings"],
};

export function BottomNav() {
    const pathname = usePathname();
    const { profile } = useUser();
    const role = profile?.role ?? "student";

    const allowedHrefs = roleNavMap[role] ?? roleNavMap.student;
    const visibleItems = allowedHrefs
        .map((href) => navItems.find((item) => item.href === href))
        .filter(Boolean) as NavItem[];

    const activeIndex = visibleItems.findIndex(
        (item) => pathname === item.href || pathname.startsWith(item.href + "/")
    );

    return (
        <div className="fixed bottom-4 left-4 right-4 z-50 md:hidden flex justify-center">
            <div className="relative w-full bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md rounded-2xl shadow-2xl border border-brand-border px-2 py-2">
                <nav className="flex items-center justify-around w-full">
                    {/* Sliding pill background */}
                    {activeIndex >= 0 && (
                        <motion.div
                            className="absolute top-2 bottom-2 rounded-xl bg-brand/10"
                            layoutId="nav-pill"
                            style={{
                                width: `calc(${100 / visibleItems.length}% - 8px)`,
                                left: `calc(${(activeIndex / visibleItems.length) * 100}% + 4px)`,
                            }}
                            transition={{
                                type: "spring",
                                stiffness: 380,
                                damping: 32,
                            }}
                        />
                    )}

                    {visibleItems.map((item) => {
                        const isActive =
                            pathname === item.href ||
                            pathname.startsWith(item.href + "/");
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="relative flex flex-col items-center gap-0.5 flex-1 py-1 select-none"
                            >
                                {/* Icon container with its own micro spring */}
                                <motion.div
                                    className={cn(
                                        "flex items-center justify-center w-9 h-9 rounded-xl transition-colors",
                                        isActive
                                            ? "bg-brand text-white"
                                            : "text-text-muted"
                                    )}
                                    animate={isActive ? { scale: 1.08 } : { scale: 1 }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 500,
                                        damping: 30,
                                    }}
                                >
                                    <Icon className="size-[18px]" />
                                </motion.div>

                                <span
                                    className={cn(
                                        "text-[10px] mt-2 leading-none font-medium transition-colors",
                                        isActive ? "text-brand" : "text-text-secondary"
                                    )}
                                >
                                    {item.name}
                                </span>
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
}