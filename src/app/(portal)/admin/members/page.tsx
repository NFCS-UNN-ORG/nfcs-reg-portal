import * as React from "react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, AlertCircle, Users, UserCheck, Search } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { LegacyMemberTable } from "@/components/members/LegacyMemberTable";
import { RegisteredMembersTable } from "@/components/members/RegisteredMembersTable";

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "active":
      return "active";
    case "pending":
      return "pending";
    case "suspended":
      return "unpaid";
    case "legacy":
      return "inactive";
    default:
      return "inactive";
  }
}

function getRoleBadgeVariant(role: string) {
  switch (role) {
    case "student":
      return "student";
    case "alumnus":
      return "alumnus";
    case "exco":
      return "exco";
    case "super_admin":
      return "superAdmin";
    default:
      return "inactive";
  }
}

interface PageProps {
  searchParams: {
    search?: string;
    status?: string;
    organ?: string;
    sort?: string;
    tab?: string;
  };
}

export default async function AdminMembersPage({ searchParams }: PageProps) {
  const supabase = await createClient();

  const search = searchParams.search || "";
  const status = searchParams.status || "all";
  const organ = searchParams.organ || "all";
  const sort = searchParams.sort || "newest";
  const tab = searchParams.tab || "registered";

  // Get current logged-in user to pass down as excoId
  const { data: { user } } = await supabase.auth.getUser();
  const currentExcoId = user?.id || "";

  // Get current user's role for permission gating in child components
  const { data: currentUserProfile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const currentUserRole = currentUserProfile?.role ?? "";

  // Fetch real counts/stats
  const { count: totalMembers } = await supabase.from("profiles").select("*", { count: "exact", head: true });
  const { count: activeMembers } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("status", "active");
  const { count: pendingApprovals } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("status", "pending");
  const { count: legacyCount } = await supabase.from("legacy_members").select("*", { count: "exact", head: true }).eq("claim_status", "unclaimed");

  // Fetch registered members if registered tab is active
  let members: any[] = [];
  let fetchError = null;

  if (tab === "registered") {
    let query = supabase.from("profiles").select("*");

    if (status !== "all") {
      if (status === "alumni") {
        query = query.eq("role", "alumnus");
      } else {
        query = query.eq("status", status as any);
      }
    }

    if (organ !== "all") {
      query = query.eq("organ", organ as any);
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,matric_number.ilike.%${search}%`);
    }

    // Sorting
    if (sort === "name") {
      query = query.order("full_name", { ascending: true });
    } else if (sort === "oldest") {
      query = query.order("created_at", { ascending: true });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const { data, error } = await query;
    members = data || [];
    fetchError = error;
  }

  // Fetch legacy members if legacy tab is active
  let legacyMembers: any[] = [];
  if (tab === "legacy") {
    let query = supabase.from("legacy_members").select("*");

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,matric_number.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Sorting
    if (sort === "name") {
      query = query.order("full_name", { ascending: true });
    } else if (sort === "oldest") {
      query = query.order("created_at", { ascending: true });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const { data, error } = await query;
    legacyMembers = data || [];
    fetchError = error;
  }

  return (
    <div className="space-y-6">
      {/* Directory Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 select-none">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            Member Directory
          </h1>
          <p className="text-xs text-text-secondary">
            View, approve, and manage chapter members and legacy archives.
          </p>
        </div>

        <Button asChild variant="primary" className="sm:self-end">
          <Link href="/admin/members/add" className="gap-2">
            <Plus className="h-4 w-4" /> Add Member
          </Link>
        </Button>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-prussian-blue-2 border border-neutrals-borderLight rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Total Members</p>
            <p className="text-xl font-bold text-text-primary">{totalMembers}</p>
          </div>
          <div className="h-8 w-8 rounded-lg bg-brand-light flex items-center justify-center text-brand">
            <Users className="h-4 w-4" />
          </div>
        </div>
        <div className="bg-white dark:bg-prussian-blue-2 border border-neutrals-borderLight rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Active Members</p>
            <p className="text-xl font-bold text-emerald-600">{activeMembers}</p>
          </div>
          <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <UserCheck className="h-4 w-4" />
          </div>
        </div>
        <div className="bg-white dark:bg-prussian-blue-2 border border-neutrals-borderLight rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Pending Approvals</p>
            <p className="text-xl font-bold text-amber-600">{pendingApprovals}</p>
          </div>
          <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
            <AlertCircle className="h-4 w-4" />
          </div>
        </div>
        <div className="bg-white dark:bg-prussian-blue-2 border border-neutrals-borderLight rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Legacy / Unclaimed</p>
            <p className="text-xl font-bold text-text-primary">{legacyCount}</p>
          </div>
          <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500">
            <Users className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Directory Tab Navigation */}
      <div className="flex border-b border-neutrals-borderLight gap-6 select-none">
        <Link
          href={`/admin/members?tab=registered&search=${search}&sort=${sort}&status=${status}&organ=${organ}`}
          className={cn(
            "pb-3 text-xs font-bold transition-all border-b-2 px-1",
            tab === "registered"
              ? "border-brand-accent text-brand-accent font-bold"
              : "border-transparent text-text-secondary hover:text-text-primary"
          )}
        >
          Registered Members
        </Link>
        <Link
          href={`/admin/members?tab=legacy&search=${search}&sort=${sort}`}
          className={cn(
            "pb-3 text-xs font-bold transition-all border-b-2 px-1",
            tab === "legacy"
              ? "border-brand-accent text-brand-accent font-bold"
              : "border-transparent text-text-secondary hover:text-text-primary"
          )}
        >
          Legacy Directory
        </Link>
      </div>

      {tab === "registered" ? (
        <>
          {/* Filters and Search Row */}
          <Card className="border border-neutrals-borderLight shadow-card bg-white dark:bg-prussian-blue-2">
            <CardContent className="p-4">
              <form method="GET" className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <input type="hidden" name="tab" value="registered" />

                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-[10px] h-4 w-4 text-text-tertiary" />
                  <input
                    type="text"
                    name="search"
                    defaultValue={search}
                    placeholder="Search name, email, matric..."
                    className="h-9 w-full rounded-lg bg-surface-page border border-transparent pl-9 pr-4 text-[13px] text-text-primary placeholder:text-text-tertiary transition-all focus:border-brand-accent focus:bg-white dark:focus:bg-prussian-blue-3 focus:outline-none"
                  />
                </div>

                {/* Filter Status Pilltabs */}
                <div className="flex gap-2 items-center overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                  <span className="text-xs font-semibold text-text-secondary select-none">Status:</span>
                  <div className="flex gap-1.5 bg-surface-page p-1 rounded-lg">
                    {[
                      { label: "All", value: "all" },
                      { label: "Pending", value: "pending" },
                      { label: "Active", value: "active" },
                      { label: "Alumni", value: "alumni" },
                    ].map((s) => {
                      const isActive = status === s.value;
                      return (
                        <Link
                          key={s.value}
                          href={`/admin/members?tab=registered&status=${s.value}&organ=${organ}&sort=${sort}&search=${search}`}
                          className={cn(
                            "px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all select-none whitespace-nowrap",
                            isActive
                              ? "bg-white dark:bg-prussian-blue-2 text-text-primary shadow-pillTabActive font-bold"
                              : "text-text-secondary hover:text-text-primary"
                          )}
                        >
                          {s.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {/* Organ Dropdown Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-text-secondary select-none">Organ:</span>
                  <select
                    name="organ"
                    defaultValue={organ}
                    className="h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-prussian-blue-2 px-2 py-1 text-xs text-text-primary focus:border-brand-accent focus:outline-none"
                  >
                    <option value="all">All Organs</option>
                    <option value="gospel_band">Gospel Band</option>
                    <option value="evangelical_committee">Evangelical Committee</option>
                    <option value="federation_theater">Federation Theater</option>
                    <option value="social_communications_commission">Social Communication Commission</option>
                    <option value="decency_and_disciplinary_committee">Decency & Disciplinary Committee</option>
                  </select>
                </div>

                <Button type="submit" variant="secondary" className="h-9 px-4 text-xs font-semibold">
                  Filter
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Directory Table Grid */}
          {fetchError ? (
            <div className="text-center py-10 bg-white dark:bg-prussian-blue-2 rounded-[12px] border border-neutrals-borderLight">
              <AlertCircle className="mx-auto h-10 w-10 text-danger mb-3" />
              <h3 className="text-sm font-bold text-text-primary">Failed to load directory</h3>
              <p className="text-xs text-text-secondary mt-1">{fetchError.message}</p>
            </div>
          ) : !members || members.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-prussian-blue-2 rounded-[12px] border border-neutrals-borderLight shadow-card">
              <Users className="mx-auto h-10 w-10 text-text-tertiary mb-3" />
              <h3 className="text-sm font-bold text-text-primary">No members found</h3>
              <p className="text-xs text-text-secondary mt-1 max-w-xs mx-auto">
                Try adjusting your search criteria or register a new member using the onsite form.
              </p>
            </div>
          ) : (
            <RegisteredMembersTable
              initialMembers={members}
              currentExcoId={currentExcoId}
              currentUserRole={currentUserRole}
              sort={sort}
              status={status}
              organ={organ}
              search={search}
            />
          )}
        </>
      ) : (
        /* Legacy tab view */
        <>
          {fetchError ? (
            <div className="text-center py-10 bg-white dark:bg-prussian-blue-2 rounded-[12px] border border-neutrals-borderLight">
              <AlertCircle className="mx-auto h-10 w-10 text-danger mb-3" />
              <h3 className="text-sm font-bold text-text-primary">Failed to load legacy directory</h3>
              <p className="text-xs text-text-secondary mt-1">{fetchError.message}</p>
            </div>
          ) : (
            <LegacyMemberTable initialMembers={legacyMembers} excoId={currentExcoId} currentUserRole={currentUserRole} />
          )}
        </>
      )}
    </div>
  );
}
