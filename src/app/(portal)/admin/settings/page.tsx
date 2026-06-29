import * as React from "react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  TableWrapper,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from "@/components/ui/table";
import {
  ShieldAlert,
  UserCheck,
  UserX,
  Search,
  Settings,
  History,
  ArrowRightLeft,
  DollarSign,
  CreditCard,
  ShieldCheck,
  Bell,
  RefreshCw
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  updateMemberRole,
  suspendMember,
  approveMember
} from "@/lib/actions/member.actions";
import { getDuesConfig } from "@/lib/actions/dues-config.actions";
import { DuesConfigEditor } from "./DuesConfigEditor";
import { PaymentMethodsEditor } from "./PaymentMethodsEditor";
import { SecuritySettingsEditor } from "./SecuritySettingsEditor";
import { NotificationSettingsEditor } from "./NotificationSettingsEditor";
import { SessionRolloverEditor } from "./SessionRolloverEditor";
import { formatTimeAgo } from "@/lib/utils/date";

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "active": return "active";
    case "pending": return "pending";
    case "suspended": return "unpaid";
    case "legacy": return "inactive";
    default: return "inactive";
  }
}

interface PageProps {
  searchParams: {
    tab?: string;
    search?: string;
  };
}

export default async function AdminSettingsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const activeTab = searchParams.tab || "roles";
  const search = searchParams.search || "";

  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return redirect("/login");

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", currentUser.id)
    .single();

  if (!myProfile || myProfile.role !== "super_admin") {
    return redirect("/dashboard");
  }

  // 1. Roles management query (only loaded if on roles tab to save performance)
  let profiles: any[] = [];
  if (activeTab === "roles") {
    let profilesQuery = supabase
      .from("profiles")
      .select("*")
      .order("full_name", { ascending: true });

    if (search) {
      profilesQuery = profilesQuery.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,matric_number.ilike.%${search}%`
      );
    }
    const { data } = await profilesQuery;
    profiles = data || [];
  }

  // 2. Audit logs query (only loaded if on audit tab to save performance)
  let auditLogs: any[] = [];
  if (activeTab === "audit") {
    const { data } = await supabase
      .from("audit_log")
      .select(`id, action, target_type, target_id, metadata, created_at, profiles(full_name, email)`)
      .order("created_at", { ascending: false })
      .limit(100);
    auditLogs = data || [];
  }

  // 3. Dues config
  const duesConfig = activeTab === "dues" ? (await getDuesConfig()) as any[] : [];

  // Form action handlers
  const handleUpdateRole = async (formData: FormData) => {
    "use server";
    const memberId = formData.get("memberId") as string;
    const role = formData.get("role") as any;
    if (memberId && role) {
      await updateMemberRole(memberId, role, currentUser.id);
    }
  };

  const handleToggleSuspend = async (formData: FormData) => {
    "use server";
    const memberId = formData.get("memberId") as string;
    const currentStatus = formData.get("currentStatus") as string;
    if (memberId) {
      if (currentStatus === "suspended") {
        await approveMember(memberId, currentUser.id);
      } else {
        await suspendMember(memberId, currentUser.id);
      }
    }
  };

  const tabs = [
    { id: "roles", label: "Exco & Roles", icon: ArrowRightLeft },
    { id: "dues", label: "Dues Config", icon: DollarSign },
    { id: "payments", label: "Payment Methods", icon: CreditCard },
    { id: "security", label: "Security", icon: ShieldCheck },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "rollover", label: "Session Rollover", icon: RefreshCw },
    { id: "audit", label: "Audit Logs", icon: History },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 select-none">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Settings className="h-5 w-5 text-brand" /> System Settings
          </h1>
          <p className="text-xs text-text-secondary">
            Manage administrative permissions, dues configurations, portal policies, and monitor audit log records.
          </p>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex gap-0 border-b border-neutrals-borderLight select-none overflow-x-auto pb-px">
        {tabs.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            href={`/admin/settings?tab=${id}&search=${search}`}
            className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === id
                ? "border-brand text-brand font-bold"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </Link>
        ))}
      </div>

      {/* TAB: Roles */}
      {activeTab === "roles" && (
        <div className="space-y-6">
          <Card className="border border-neutrals-borderLight shadow-card bg-white dark:bg-prussian-blue-2">
            <CardContent className="p-4">
              <form method="GET" className="flex items-center gap-2">
                <input type="hidden" name="tab" value="roles" />
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-[10px] h-4 w-4 text-text-tertiary" />
                  <input
                    type="text"
                    name="search"
                    defaultValue={search}
                    placeholder="Search members to change role or suspend..."
                    className="h-9 w-full rounded-lg bg-surface-page border border-transparent pl-9 pr-4 text-[13px] text-text-primary placeholder:text-text-tertiary transition-all focus:border-brand-accent focus:bg-white dark:focus:bg-prussian-blue-3 focus:outline-none"
                  />
                </div>
                <Button type="submit" variant="secondary" className="h-9 px-4 text-xs font-semibold">
                  Search
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border border-neutrals-borderLight shadow-card bg-white dark:bg-prussian-blue-2">
            <CardHeader>
              <CardTitle>Member Access Control</CardTitle>
              <CardDescription>
                Assign administrative privileges, update profiles to Exco or Alumnus status, or suspend/restore portal access.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <TableWrapper>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member Details</TableHead>
                      <TableHead>Portal Role</TableHead>
                      <TableHead>Account Status</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead className="text-right">Action controls</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profiles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-xs text-text-tertiary">
                          No matching portal accounts found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      profiles.map((profile) => (
                        <TableRow key={profile.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar
                                src={profile.passport_photo_url}
                                name={profile.full_name}
                                size="md"
                              />
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-semibold text-text-primary truncate">
                                  {profile.full_name} {profile.id === currentUser.id && "(You)"}
                                </span>
                                <span className="text-xs text-text-tertiary truncate">
                                  {profile.email}
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <form action={handleUpdateRole} className="flex items-center gap-2">
                              <input type="hidden" name="memberId" value={profile.id} />
                              <select
                                name="role"
                                defaultValue={profile.role}
                                disabled={profile.id === currentUser.id}
                                className="h-8 rounded-md border border-neutrals-border bg-white dark:bg-prussian-blue-2 px-2 py-0.5 text-xs text-text-primary focus:border-brand-accent focus:outline-none disabled:opacity-60 disabled:bg-surface-page"
                              >
                                <option value="student">Student</option>
                                <option value="alumnus">Alumnus</option>
                                <option value="exco">Exco</option>
                                <option value="super_admin">Super Admin</option>
                              </select>
                              {profile.id !== currentUser.id && (
                                <Button type="submit" variant="secondary" size="sm" className="h-8 px-2 font-semibold text-xs text-brand-accent hover:bg-brand-light">
                                  Save Role
                                </Button>
                              )}
                            </form>
                          </TableCell>

                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(profile.status)}>{profile.status}</Badge>
                          </TableCell>

                          <TableCell variant="secondary">
                            {formatTimeAgo(profile.updated_at || profile.created_at)}
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
                                <Link href={`/admin/members/${profile.id}`}>View</Link>
                              </Button>
                              {profile.id !== currentUser.id && (
                                <form action={handleToggleSuspend}>
                                  <input type="hidden" name="memberId" value={profile.id} />
                                  <input type="hidden" name="currentStatus" value={profile.status} />
                                  {profile.status === "suspended" ? (
                                    <Button type="submit" variant="primary" size="sm" className="h-8 px-3 text-xs gap-1.5 font-semibold">
                                      <UserCheck className="h-3.5 w-3.5" /> Restore
                                    </Button>
                                  ) : (
                                    <Button type="submit" variant="danger" size="sm" className="h-8 px-3 text-xs gap-1.5 font-semibold">
                                      <UserX className="h-3.5 w-3.5" /> Suspend
                                    </Button>
                                  )}
                                </form>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableWrapper>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB: Dues Config */}
      {activeTab === "dues" && (
        <div className="space-y-6">
          <DuesConfigEditor initialRows={duesConfig} adminId={currentUser.id} />

          {/* Info card about what dues_config affects */}
          <Card className="border border-neutrals-borderLight bg-indigo-50 dark:bg-indigo-950/20">
            <CardContent className="p-5 flex gap-4">
              <ShieldAlert className="h-5 w-5 text-indigo-700 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-indigo-700 dark:text-indigo-400">Note on dues_config database table</p>
                <p className="text-xs text-indigo-700 dark:text-indigo-400/80">
                  This feature requires a <code className="bg-white/60 dark:bg-black/40 px-1 rounded font-mono text-[10px]">dues_config</code> table 
                  in Supabase with columns: <code className="bg-white/60 dark:bg-black/40 px-1 rounded font-mono text-[10px]">year_ordinal, label, annual_dues, constitution, cgan, total</code>.
                  If the table doesn&apos;t exist yet, changes here will show an error and fall back to the hardcoded fee structure.
                  Run the migration SQL to enable this feature.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB: Payment Methods */}
      {activeTab === "payments" && (
        <PaymentMethodsEditor adminId={currentUser.id} />
      )}

      {/* TAB: Security Settings */}
      {activeTab === "security" && (
        <SecuritySettingsEditor adminId={currentUser.id} />
      )}

      {/* TAB: Notification Settings */}
      {activeTab === "notifications" && (
        <NotificationSettingsEditor adminId={currentUser.id} />
      )}

      {/* TAB: Audit Logs */}
      {activeTab === "audit" && (
        <div className="space-y-6">
          <Card className="border border-neutrals-borderLight shadow-card bg-white dark:bg-prussian-blue-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-[#6366F1]" /> System Audit Trails
              </CardTitle>
              <CardDescription>
                Review details of recent administrator and system updates.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <TableWrapper>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Admin (Actor)</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Details & Metadata</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-xs text-text-tertiary">
                          No audit log entries found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      auditLogs.map((log: any) => {
                        const actorName = log.profiles?.full_name || "System / Member";
                        const actorEmail = log.profiles?.email || "";
                        
                        let actionVariant = "neutral";
                        if (log.action.includes("approve") || log.action.includes("confirm")) {
                          actionVariant = "success";
                        } else if (log.action.includes("suspend") || log.action.includes("reject") || log.action.includes("delete") || log.action.includes("revoke")) {
                          actionVariant = "danger";
                        } else if (log.action.includes("create") || log.action.includes("migrate") || log.action.includes("update") || log.action.includes("save")) {
                          actionVariant = "primary";
                        }

                        return (
                          <TableRow key={log.id} className="hover:bg-surface-page transition-colors">
                            <TableCell className="whitespace-nowrap text-xs text-text-secondary">
                              {formatTimeAgo(log.created_at)}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-xs font-semibold text-text-primary">{actorName}</span>
                                {actorEmail && (
                                  <span className="text-[10px] text-text-tertiary">{actorEmail}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                actionVariant === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-500 dark:border-emerald-900/40" :
                                actionVariant === "danger" ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-500 dark:border-rose-900/40" :
                                actionVariant === "primary" ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-500 dark:border-blue-900/40" :
                                "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-800"
                              }`}>
                                {log.action.replace(/_/g, " ")}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-xs md:max-w-md">
                              <div className="flex flex-col gap-1 text-[11px] text-text-secondary font-mono">
                                <div>
                                  <span className="font-semibold text-text-tertiary">Target:</span> {log.target_type} ({log.target_id?.substring(0, 8) || "N/A"})
                                </div>
                                {log.metadata && Object.keys(log.metadata).length > 0 && (
                                  <div className="bg-surface-page dark:bg-prussian-blue-3 p-1.5 rounded border border-neutrals-borderLight text-[10px] overflow-x-auto whitespace-pre">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableWrapper>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "rollover" && (
        <SessionRolloverEditor currentExcoId={currentUser.id} />
      )}
    </div>
  );
}
