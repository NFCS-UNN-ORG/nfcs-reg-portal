import * as React from "react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  CreditCard,
  Calendar,
  AlertCircle,
  TrendingUp,
  UserCheck,
  Megaphone,
  Sparkles,
  FolderSync,
  User,
  Activity,
  ShieldAlert,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { AdminAnalytics } from "@/components/dashboard/AdminAnalytics";
import { DismissibleGreeting } from "@/components/dashboard/DismissibleGreeting";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Fetch member profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center gap-3">
        <AlertCircle className="h-10 w-10 text-danger" />
        <h2 className="text-base font-bold text-text-primary">Profile Not Found</h2>
        <p className="text-xs text-text-secondary max-w-xs">
          Your profile record could not be found. Please try logging out and registering again.
        </p>
      </div>
    );
  }

  const role = profile.role;
  const isSuperAdmin = role === "super_admin";
  const isExcoOrAbove = ["exco", "super_admin"].includes(role);

  // Fetch real counts/stats from Supabase
  const { count: eventsCount } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true });

  const { count: announcementsCount } = await supabase
    .from("announcements")
    .select("*", { count: "exact", head: true });

  const { count: totalMembers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  const { count: activeMembers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  const { count: pendingApprovals } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  // Additional admin stats
  const { count: legacyCount } = await supabase
    .from("legacy_members")
    .select("*", { count: "exact", head: true })
    .eq("claim_status", "unclaimed");

  // Payments stats for super-admin
  const { data: allPayments } = isSuperAdmin ? await supabase
    .from("payments")
    .select("amount, status, channel, created_at")
    .order("created_at", { ascending: false }) : { data: null };

  let totalCollected = 0;
  let onlineCollected = 0;
  let manualCollected = 0;
  let pendingCount = 0;

  if (allPayments) {
    allPayments.forEach((p) => {
      const amount = parseFloat(p.amount.toString());
      if (p.status === "confirmed") {
        totalCollected += amount;
        if (p.channel === "online") onlineCollected += amount;
        else if (p.channel === "manual") manualCollected += amount;
      } else if (p.status === "pending") {
        pendingCount++;
      }
    });
  }

  // Fetch announcements for dashboard (up to 3)
  const { data: announcements } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(3);

  // Fetch events for dashboard (up to 3)
  let eventsQuery = supabase.from("events").select("*");
  if (!isExcoOrAbove) {
    eventsQuery = eventsQuery.eq("is_published", true);
  }
  const { data: dbEvents } = await eventsQuery
    .order("starts_at", { ascending: true })
    .limit(3);

  // For super-admin charts: fetch profile created_at for growth chart
  const { data: profileDates } = isSuperAdmin ? await supabase
    .from("profiles")
    .select("created_at") : { data: null };

  const memberStats = {
    totalPaid: "₦15,000",
    outstanding: "₦5,000",
    session: "2024/2025",
    eventsCount: eventsCount || 0,
    announcementsCount: announcementsCount || 0,
  };

  const adminStats = {
    totalMembers: totalMembers || 0,
    activeMembers: activeMembers || 0,
    pendingApprovals: pendingApprovals || 0,
    legacyCount: legacyCount || 0,
    totalCollected,
    onlineCollected,
    manualCollected,
    pendingCount,
  };

  return (
    <div className="space-y-6">
      {/* Pending Account Alert Note Card */}
      {profile.status === "pending" && (
        <div className="flex gap-4 p-5 rounded-[12px] bg-status-pendingBackground border border-status-pendingBorder text-status-pendingText animate-in fade-in duration-300">
          <AlertCircle className="h-5 w-5 shrink-0 text-status-pendingText" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold">Registration Awaiting Approval</h3>
            <p className="text-xs leading-relaxed opacity-95">
              Welcome, <span className="font-semibold">{profile.full_name}</span>! Your registration is currently pending review. An Exco member will verify your department, faculty, and matric number before activating your full directory access.
            </p>
          </div>
        </div>
      )}

      {/* Profile Completion Warning Banner */}
      {!isExcoOrAbove && (!profile.phone || !profile.faculty || !profile.department || !profile.academic_level || !profile.organ) && (
        <div className="flex flex-col sm:flex-row gap-4 p-5 rounded-[12px] bg-status-warningBackground border border-status-warningBorder text-status-warningText animate-in fade-in duration-300 items-start sm:items-center justify-between">
          <div className="flex gap-4 items-start">
            <AlertCircle className="h-5 w-5 shrink-0 text-status-warningText mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold">Complete Your Profile Setup</h3>
              <p className="text-xs leading-relaxed opacity-95">
                Some details (Phone, Faculty, Department, Academic Level, or Scope Organ) are missing from your profile. Please complete them to ensure full chapter directory access.
              </p>
            </div>
          </div>
          <Button size="sm" asChild className="shrink-0 text-xs h-8 bg-white hover:bg-amber-50 text-status-warningText border border-status-warningBorder transition-colors">
            <Link href="/profile">Go to Profile</Link>
          </Button>
        </div>
      )}

      {/* Greeting Banner — hidden for super-admin, dismissible for others */}
      {!isSuperAdmin && (
        <DismissibleGreeting name={profile.full_name} />
      )}

      {/* Super Admin: Analytics Dashboard */}
      {isSuperAdmin ? (
        <AdminAnalytics
          adminStats={adminStats}
          profileDates={(profileDates || []).map((p) => p.created_at)}
          allPayments={(allPayments || []).map((p) => ({ ...p, created_at: p.created_at ?? "" }))}
        />
      ) : isExcoOrAbove ? (
        // Exco KPIs
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Card hoverable>
            <CardContent className="p-5 flex items-center gap-4 justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-text-secondary">Total Members</span>
                <h3 className="text-2xl font-bold text-text-primary">{adminStats.totalMembers}</h3>
              </div>
              <div className="h-10 w-10 rounded-lg bg-brand-light flex items-center justify-center text-brand">
                <Users className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card hoverable>
            <CardContent className="p-5 flex items-center gap-4 justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-text-secondary">Active Members</span>
                <h3 className="text-2xl font-bold text-text-primary">{adminStats.activeMembers}</h3>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
                <UserCheck className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card hoverable>
            <CardContent className="p-5 flex items-center gap-4 justify-between">
              <div className="space-y-1 flex flex-col">
                <span className="text-xs font-semibold text-text-secondary">Pending Approvals</span>
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-bold text-text-primary">{adminStats.pendingApprovals}</h3>
                  {adminStats.pendingApprovals > 0 && (
                    <Badge variant="pending">Review required</Badge>
                  )}
                </div>
              </div>
              <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                <AlertCircle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card hoverable>
            <CardContent className="p-5 flex items-center gap-4 justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-text-secondary">Dues Collected</span>
                <h3 className="text-2xl font-bold text-text-primary">₦{adminStats.totalCollected.toLocaleString()}</h3>
              </div>
              <div className="h-10 w-10 rounded-lg bg-brand-light flex items-center justify-center text-brand-accent">
                <TrendingUp className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        // Student/Alumnus KPIs
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Card hoverable>
            <CardContent className="p-5 flex items-center gap-4 justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-text-secondary">Dues Paid ({memberStats.session})</span>
                <h3 className="text-2xl font-bold text-text-primary">{memberStats.totalPaid}</h3>
              </div>
              <div className="h-10 w-10 rounded-lg bg-brand-light flex items-center justify-center text-brand">
                <CreditCard className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card hoverable>
            <CardContent className="p-5 flex items-center gap-4 justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-text-secondary">Outstanding Levy</span>
                <h3 className="text-2xl font-bold text-text-primary">{memberStats.outstanding}</h3>
              </div>
              <div className="h-10 w-10 rounded-lg bg-rose-50 flex items-center justify-center text-danger">
                <AlertCircle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card hoverable>
            <CardContent className="p-5 flex items-center gap-4 justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-text-secondary">Upcoming Events</span>
                <h3 className="text-2xl font-bold text-text-primary">{memberStats.eventsCount}</h3>
              </div>
              <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-700">
                <Calendar className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card hoverable>
            <CardContent className="p-5 flex items-center gap-4 justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-text-secondary">Announcements</span>
                <h3 className="text-2xl font-bold text-text-primary">{memberStats.announcementsCount}</h3>
              </div>
              <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-700">
                <Megaphone className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Dashboard Layout Panel Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content Area: Left/Center 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Access</CardTitle>
              <CardDescription>Shortcut links to key modules</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {isExcoOrAbove ? (
                  <>
                    <Button variant="secondary" asChild className="justify-start gap-2 h-11 text-xs">
                      <Link href="/admin/members">
                        <Users className="h-4 w-4 text-brand" />
                        Directory
                      </Link>
                    </Button>
                    <Button variant="secondary" asChild className="justify-start gap-2 h-11 text-xs">
                      <Link href="/admin/dues">
                        <CreditCard className="h-4 w-4 text-brand" />
                        Dues Records
                      </Link>
                    </Button>
                    <Button variant="secondary" asChild className="justify-start gap-2 h-11 text-xs">
                      <Link href="/admin/members/migrate">
                        <FolderSync className="h-4 w-4 text-brand" />
                        Migrate Members
                      </Link>
                    </Button>
                    {isSuperAdmin && (
                      <Button variant="secondary" asChild className="justify-start gap-2 h-11 text-xs">
                        <Link href="/admin/settings">
                          <ShieldAlert className="h-4 w-4 text-brand" />
                          System Settings
                        </Link>
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Button variant="secondary" asChild className="justify-start gap-2 h-11 text-xs">
                      <Link href="/dues">
                        <CreditCard className="h-4 w-4 text-brand" />
                        Pay Dues
                      </Link>
                    </Button>
                    <Button variant="secondary" asChild className="justify-start gap-2 h-11 text-xs">
                      <Link href="/profile">
                        <User className="h-4 w-4 text-brand" />
                        My Profile
                      </Link>
                    </Button>
                    <Button variant="secondary" asChild className="justify-start gap-2 h-11 text-xs">
                      <Link href="/events">
                        <Calendar className="h-4 w-4 text-brand" />
                        Events
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Announcements Feed Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="space-y-1">
                <CardTitle>Recent Announcements</CardTitle>
                <CardDescription>Latest updates from Chapter Exco</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild className="text-xs">
                <Link href="/announcements">View all</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              {!announcements || announcements.length === 0 ? (
                <p className="text-xs text-text-secondary py-4 text-center">No recent announcements posted.</p>
              ) : (
                announcements.map((ann, idx) => {
                  const cardColorStyles = [
                    {
                      bg: "bg-noteCards-green hover:bg-noteCards-greenSurface",
                      title: "text-noteCards-greenText",
                      body: "text-noteCards-greenSubtext",
                      meta: "text-noteCards-greenMeta",
                    },
                    {
                      bg: "bg-noteCards-purple hover:bg-noteCards-purpleSurface",
                      title: "text-noteCards-purpleText",
                      body: "text-noteCards-purpleSubtext",
                      meta: "text-noteCards-purpleMeta",
                    },
                    {
                      bg: "bg-noteCards-amber hover:bg-noteCards-amberSurface",
                      title: "text-noteCards-amberText",
                      body: "text-noteCards-amberSubtext",
                      meta: "text-noteCards-amberMeta",
                    },
                    {
                      bg: "bg-noteCards-blue hover:bg-[#EFF6FF]",
                      title: "text-noteCards-blueText",
                      body: "text-noteCards-blueText",
                      meta: "text-[#2563EB]",
                    },
                  ];
                  const style = cardColorStyles[idx % cardColorStyles.length];
                  const dateStr = new Date(ann.created_at || "").toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });

                  return (
                    <div
                      key={ann.id}
                      className={`flex flex-col gap-1 p-4 rounded-[12px] transition-colors ${style.bg}`}
                    >
                      <div className={`flex justify-between items-start gap-2 ${style.title}`}>
                        <h4 className="text-[13px] font-bold">{ann.title}</h4>
                        <span className={`text-[10px] uppercase font-semibold shrink-0 ${style.meta}`}>
                          {dateStr}
                        </span>
                      </div>
                      <p className={`text-[12px] leading-relaxed mt-1 line-clamp-3 ${style.body}`}>
                        {ann.body}
                      </p>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Side Panel: Right 1 column */}
        <div className="space-y-6">
          {/* Upcoming Event Schedule Panel */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="space-y-1">
                <CardTitle>Events</CardTitle>
                <CardDescription>Timetable &amp; meetings</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild className="text-xs">
                <Link href="/events">All</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <div className="flex flex-col gap-3">
                {!dbEvents || dbEvents.length === 0 ? (
                  <p className="text-xs text-text-secondary py-4 text-center">No upcoming events scheduled.</p>
                ) : (
                  dbEvents.map((evt) => {
                    const evtDate = new Date(evt.starts_at);
                    const monthStr = evtDate.toLocaleDateString(undefined, { month: "short" });
                    const dayStr = evtDate.toLocaleDateString(undefined, { day: "numeric" });
                    const timeStr = evtDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

                    return (
                      <div key={evt.id} className="flex gap-3 items-center border-b border-neutrals-borderLight pb-3 last:border-0 last:pb-0 text-left">
                        <div className="h-10 w-10 shrink-0 bg-brand-light text-brand rounded-[8px] flex flex-col items-center justify-center font-bold border border-brand-border">
                          <span className="text-[10px] leading-none uppercase">{monthStr}</span>
                          <span className="text-sm leading-none mt-0.5">{dayStr}</span>
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-xs font-semibold text-text-primary truncate">{evt.title}</span>
                          <span className="text-[11px] text-text-tertiary">{evt.location} &bull; {timeStr}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
