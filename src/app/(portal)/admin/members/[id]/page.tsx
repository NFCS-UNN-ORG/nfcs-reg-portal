import * as React from "react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  approveMember,
  rejectMember,
  suspendMember,
  upgradeMemberToAlumnus
} from "@/lib/actions/member.actions";
import { redirect } from "next/navigation";
import {
  ChevronLeft,
  ShieldCheck,
  Mail,
  Phone,
  Calendar,
  MapPin,
  School,
  Church,
  UserX,
  UserCheck,
  ArrowUpCircle
} from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils/date";
import { formatNaira } from "@/lib/utils/money";
import { MemberProfileEditor } from "./MemberProfileEditor";

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case "active": return "active";
    case "pending": return "pending";
    case "suspended": return "unpaid";
    case "legacy": return "inactive";
    default: return "inactive";
  }
}

function getRoleBadgeVariant(role: string) {
  switch (role) {
    case "student": return "student";
    case "alumnus": return "alumnus";
    case "exco": return "exco";
    case "super_admin": return "superAdmin";
    default: return "inactive";
  }
}

interface PageProps {
  params: { id: string };
}

export default async function MemberDetailPage({ params }: PageProps) {
  const supabase = await createClient();
  const memberId = params.id;

  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) return redirect("/login");

  // Get current user's role
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", currentUser.id)
    .single();

  const isSuperAdmin = currentProfile?.role === "super_admin";

  // Retrieve member profile
  const { data: member, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", memberId)
    .single();

  if (error || !member) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center gap-3">
        <ChevronLeft className="h-10 w-10 text-text-tertiary" />
        <h2 className="text-base font-bold text-text-primary">Member Not Found</h2>
        <Link href="/admin/members" className="text-xs text-brand-accent hover:underline">
          Return to Member Directory
        </Link>
      </div>
    );
  }

  // Fetch member payments
  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .eq("profile_id" as any, memberId)
    .order("created_at", { ascending: false });

  // Server action wrappers
  const handleApprove = async () => {
    "use server";
    await approveMember(memberId, currentUser.id);
  };
  const handleReject = async () => {
    "use server";
    await rejectMember(memberId, currentUser.id);
  };
  const handleSuspend = async () => {
    "use server";
    await suspendMember(memberId, currentUser.id);
  };
  const handleUpgrade = async () => {
    "use server";
    await upgradeMemberToAlumnus(memberId, currentUser.id);
  };

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <div className="flex items-center justify-between select-none">
        <Link
          href="/admin/members"
          className="inline-flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-brand-accent transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Directory
        </Link>
      </div>

      {/* Main Grid: Info card & Side profile */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Side: Avatar, Name, Main Actions */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="border border-neutrals-borderLight shadow-card bg-white dark:bg-prussian-blue-2">
            <CardContent className="p-6 flex flex-col items-center text-center gap-4">
              {/* Photo */}
              <Avatar
                src={member.passport_photo_url}
                name={member.full_name}
                size="xl"
                className="h-28 w-28 border-4 border-neutrals-border"
              />

              {/* Name Info */}
              <div className="space-y-1 w-full">
                <h2 className="text-base font-bold text-text-primary truncate flex items-center justify-center gap-1">
                  {member.full_name}
                  {member.status === "active" && (
                    <ShieldCheck className="h-5 w-5 text-brand-accent shrink-0" />
                  )}
                </h2>
                <p className="text-xs text-text-tertiary select-all truncate">{member.email}</p>
                <div className="flex justify-center gap-1.5 mt-2">
                  <Badge variant={getStatusBadgeVariant(member.status)}>{member.status}</Badge>
                  <Badge variant={getRoleBadgeVariant(member.role)}>{member.role}</Badge>
                </div>
              </div>

              {/* Quick Contact Details */}
              <div className="w-full border-t border-neutrals-borderLight pt-4 space-y-2 text-left">
                <div className="flex items-center gap-2 text-xs text-text-secondary select-all">
                  <Phone className="h-3.5 w-3.5 text-text-tertiary" />
                  <span>{member.phone || "No phone added"}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-text-secondary select-all">
                  <Mail className="h-3.5 w-3.5 text-text-tertiary" />
                  <span>{member.email}</span>
                </div>
                {member.date_of_birth && (
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <Calendar className="h-3.5 w-3.5 text-text-tertiary" />
                    <span>DOB: {member.date_of_birth}</span>
                  </div>
                )}
                {member.address && (
                  <div className="flex items-center gap-2 text-xs text-text-secondary truncate">
                    <MapPin className="h-3.5 w-3.5 text-text-tertiary" />
                    <span>{member.address}</span>
                  </div>
                )}
                {member.created_at && (
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <Calendar className="h-3.5 w-3.5 text-text-tertiary" />
                    <span>Joined: {formatDate(member.created_at)}</span>
                  </div>
                )}
              </div>

              {/* Admin Action Buttons */}
              <div className="w-full border-t border-neutrals-borderLight pt-4 space-y-2">
                <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider block text-left mb-2 select-none">
                  Admin Actions
                </span>

                <form className="flex flex-col gap-2">
                  {member.status === "pending" && (
                    <>
                      <Button formAction={handleApprove} variant="primary" className="w-full gap-2 text-xs font-semibold h-10">
                        <UserCheck className="h-4 w-4" /> Approve Registration
                      </Button>
                      <Button formAction={handleReject} variant="danger" className="w-full gap-2 text-xs font-semibold h-10">
                        <UserX className="h-4 w-4" /> Reject Registration
                      </Button>
                    </>
                  )}

                  {member.status === "active" && (
                    <>
                      {member.role === "student" && (
                        <Button formAction={handleUpgrade} variant="secondary" className="w-full gap-2 text-xs font-semibold h-10 text-brand-accent hover:bg-brand-light border-brand-border">
                          <ArrowUpCircle className="h-4 w-4" /> Upgrade to Alumnus
                        </Button>
                      )}
                      <Button formAction={handleSuspend} variant="danger" className="w-full gap-2 text-xs font-semibold h-10">
                        <UserX className="h-4 w-4" /> Suspend Member
                      </Button>
                    </>
                  )}

                  {member.status === "suspended" && (
                    <Button formAction={handleApprove} variant="primary" className="w-full gap-2 text-xs font-semibold h-10">
                      <UserCheck className="h-4 w-4" /> Reactivate Account
                    </Button>
                  )}
                </form>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Detailed Profiling cards */}
        <div className="space-y-6 lg:col-span-2">
          {/* Super Admin: editable biodata editor */}
          {isSuperAdmin ? (
            <MemberProfileEditor member={member} adminId={currentUser.id} />
          ) : (
            <>
              {/* Academic Profile (read-only for Exco) */}
              <Card className="border border-neutrals-borderLight shadow-card bg-white dark:bg-prussian-blue-2">
                <div className="p-6 flex items-center justify-between border-b border-neutrals-borderLight">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-text-primary">Academic Profile</h3>
                    <p className="text-xs text-text-secondary">University details</p>
                  </div>
                  <School className="h-5 w-5 text-brand-accent" />
                </div>
                <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-text-tertiary uppercase font-semibold">Faculty</span>
                    <p className="text-sm font-medium text-text-primary">{member.faculty || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-text-tertiary uppercase font-semibold">Department</span>
                    <p className="text-sm font-medium text-text-primary">{member.department || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-text-tertiary uppercase font-semibold">Matric Number</span>
                    <p className="text-sm font-mono text-text-primary">{member.matric_number || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-text-tertiary uppercase font-semibold">Academic Level</span>
                    <p className="text-sm font-medium text-text-primary">{member.academic_level || "—"}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Catholic & Organ Profile (read-only for Exco) */}
              <Card className="border border-neutrals-borderLight shadow-card bg-white dark:bg-prussian-blue-2">
                <div className="p-6 flex items-center justify-between border-b border-neutrals-borderLight">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-text-primary">NFCS Organ & Parish details</h3>
                    <p className="text-xs text-text-secondary">Communal details</p>
                  </div>
                  <Church className="h-5 w-5 text-brand-accent" />
                </div>
                <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-text-tertiary uppercase font-semibold">Assigned Organ(s)</span>
                    <p className="text-sm font-medium text-text-primary capitalize">
                      {member.organ
                        ? member.organ
                            .split(",")
                            .map((o: string) => o.trim().replace(/_/g, " "))
                            .join(", ")
                        : "Not assigned"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-text-tertiary uppercase font-semibold">Society / Association</span>
                    <p className="text-sm font-medium text-text-primary">{member.society || "None listed"}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-text-tertiary uppercase font-semibold">Home Parish</span>
                    <p className="text-sm font-medium text-text-primary">{member.parish || "None listed"}</p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Payment History — visible to exco and super admin */}
          <Card className="border border-neutrals-borderLight shadow-card bg-white dark:bg-prussian-blue-2">
            <div className="p-6 flex items-center justify-between border-b border-neutrals-borderLight">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-text-primary">Payment History</h3>
                <p className="text-xs text-text-secondary">Full dues & payment record</p>
              </div>
            </div>
            <CardContent className="p-6">
              {!payments || payments.length === 0 ? (
                <p className="text-xs text-text-secondary text-center py-4">No payment records found for this member.</p>
              ) : (
                <div className="space-y-3">
                  {payments.map((payment: any) => (
                    <div key={payment.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-page border border-neutrals-borderLight">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-text-primary">
                          {payment.description || `Dues – ${payment.academic_session || "N/A"}`}
                        </span>
                        <span className="text-[11px] text-text-tertiary">
                          {formatDate(payment.created_at)} · {payment.channel || "online"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-text-primary">
                          {formatNaira(payment.amount)}
                        </span>
                        <Badge
                          variant={payment.status === "confirmed" ? "active" : payment.status === "pending" ? "pending" : "unpaid"}
                        >
                          {payment.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
