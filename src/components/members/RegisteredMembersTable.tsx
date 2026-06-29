"use client";

import * as React from "react";
import {
  TableWrapper,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { formatTimeAgo } from "@/lib/utils/date";
import { bulkApproveMembers, bulkSuspendMembers } from "@/lib/actions/member.actions";
import {
  Eye,
  Mail,
  ShieldCheck,
  Loader2,
  CheckSquare,
  Square,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";

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

interface Member {
  id: string;
  full_name: string;
  email: string;
  matric_number: string | null;
  department: string | null;
  faculty: string | null;
  organ: string | null;
  status: string;
  role: string;
  position?: string | null;
  passport_photo_url: string | null;
  created_at: string;
}

interface RegisteredMembersTableProps {
  initialMembers: Member[];
  currentExcoId: string;
  currentUserRole: string;
  sort: string;
  status: string;
  organ: string;
  search: string;
}

export function RegisteredMembersTable({
  initialMembers,
  currentExcoId,
  currentUserRole,
  sort,
  status,
  organ,
  search,
}: RegisteredMembersTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [processingAction, setProcessingAction] = React.useState<"approve" | "suspend" | null>(null);

  // Sync selected IDs if list of members changes (deselecting invalid items)
  React.useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      const currentIds = new Set(initialMembers.map((m) => m.id));
      prev.forEach((id) => {
        if (currentIds.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [initialMembers]);

  const toggleSelectAll = () => {
    if (selectedIds.size === initialMembers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(initialMembers.map((m) => m.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    setProcessingAction("approve");

    try {
      const result = await bulkApproveMembers(Array.from(selectedIds), currentExcoId);
      if (result.error) {
        toast({
          title: "Bulk Approval Failed",
          description: result.error,
          variant: "error",
        });
      } else {
        toast({
          title: "Bulk Approval Successful",
          description: `Successfully approved ${result.count} member(s).`,
          variant: "success",
        });
        setSelectedIds(new Set());
        router.refresh();
      }
    } catch (err: any) {
      toast({
        title: "Unexpected Error",
        description: err?.message || "Failed to perform bulk approval",
        variant: "error",
      });
    } finally {
      setIsProcessing(false);
      setProcessingAction(null);
    }
  };

  const handleBulkSuspend = async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    setProcessingAction("suspend");

    try {
      const result = await bulkSuspendMembers(Array.from(selectedIds), currentExcoId);
      if (result.error) {
        toast({
          title: "Bulk Suspension Failed",
          description: result.error,
          variant: "error",
        });
      } else {
        toast({
          title: "Bulk Suspension Successful",
          description: `Successfully suspended ${result.count} member(s).`,
          variant: "success",
        });
        setSelectedIds(new Set());
        router.refresh();
      }
    } catch (err: any) {
      toast({
        title: "Unexpected Error",
        description: err?.message || "Failed to perform bulk suspension",
        variant: "error",
      });
    } finally {
      setIsProcessing(false);
      setProcessingAction(null);
    }
  };

  const isAllSelected = initialMembers.length > 0 && selectedIds.size === initialMembers.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < initialMembers.length;

  return (
    <div className="relative">
      <TableWrapper>
        <Table>
          <TableHeader>
            <TableRow>
              {/* Checkbox Header */}
              <TableHead className="w-12 text-center select-none">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center justify-center text-text-secondary hover:text-brand-accent transition-colors animate-fade-in"
                >
                  {isAllSelected ? (
                    <CheckSquare className="h-4 w-4 text-brand-accent" />
                  ) : isSomeSelected ? (
                    <div className="h-4 w-4 rounded border border-brand-accent bg-brand-light flex items-center justify-center">
                      <div className="h-0.5 w-2 bg-brand-accent" />
                    </div>
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
              </TableHead>
              <TableHead>
                <Link
                  href={`/admin/members?tab=registered&status=${status}&organ=${organ}&sort=${sort === "name" ? "newest" : "name"}&search=${search}`}
                  className="flex items-center gap-1 hover:text-brand-accent transition-colors select-none"
                >
                  Member Details {sort === "name" && "↓"}
                </Link>
              </TableHead>
              <TableHead>Matric Number</TableHead>
              <TableHead>Department / Faculty</TableHead>
              <TableHead>Assigned Organ</TableHead>
              <TableHead>
                <Link
                  href={`/admin/members?tab=registered&status=${status}&organ=${organ}&sort=${sort === "newest" ? "oldest" : "newest"}&search=${search}`}
                  className="flex items-center gap-1 hover:text-brand-accent transition-colors select-none"
                >
                  Date Joined {sort === "newest" ? "↓" : sort === "oldest" ? "↑" : ""}
                </Link>
              </TableHead>
              <TableHead>Status & Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialMembers.map((member) => {
              const isSelected = selectedIds.has(member.id);
              return (
                <TableRow
                  key={member.id}
                  className={cn(
                    "transition-colors",
                    isSelected && "bg-brand-light/20 dark:bg-brand-accent/5"
                  )}
                >
                  {/* Checkbox Cell */}
                  <TableCell className="w-12 text-center select-none">
                    <button
                      type="button"
                      onClick={() => toggleSelect(member.id)}
                      className="flex items-center justify-center text-text-secondary hover:text-brand-accent transition-colors animate-fade-in"
                    >
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-brand-accent" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </TableCell>

                  {/* Name and avatar info */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={member.passport_photo_url}
                        name={member.full_name}
                        size="md"
                        className="border border-neutrals-borderLight"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-text-primary truncate flex items-center gap-1">
                          {member.full_name}
                          {member.status === "active" && (
                            <ShieldCheck className="h-4 w-4 text-brand-accent shrink-0" />
                          )}
                        </span>
                        <span className="text-xs text-text-tertiary truncate flex items-center gap-1 select-all">
                          <Mail className="h-3 w-3 shrink-0" /> {member.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  {/* Matric number monospace */}
                  <TableCell variant="mono">{member.matric_number || "—"}</TableCell>

                  {/* Department & Faculty */}
                  <TableCell variant="secondary">
                    <div className="flex flex-col">
                      <span className="font-medium text-text-primary text-[13px]">
                        {member.department || "—"}
                      </span>
                      <span className="text-text-tertiary text-xs">{member.faculty || "—"}</span>
                    </div>
                  </TableCell>

                  {/* Assigned Organ */}
                  <TableCell variant="secondary">
                    <span className="capitalize">
                      {member.organ ? member.organ.replace("_", " ") : "Not assigned"}
                    </span>
                  </TableCell>

                  {/* Date Joined */}
                  <TableCell variant="secondary">{formatTimeAgo(member.created_at)}</TableCell>

                  {/* Status & Role Badges */}
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={getStatusBadgeVariant(member.status)}>{member.status}</Badge>
                      <Badge variant={getRoleBadgeVariant(member.role)}>{member.role}</Badge>
                      {member.role === "exco" && member.position && (
                        <span className="text-[10px] font-semibold text-brand-accent bg-brand-light px-2 py-0.5 rounded-full border border-brand-border">
                          {member.position}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Actions column */}
                  <TableCell className="text-right">
                    <Button asChild variant="secondary" size="sm" className="h-8 px-2.5">
                      <Link
                        href={`/admin/members/${member.id}`}
                        className="gap-1.5 text-xs font-semibold"
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableWrapper>

      {/* Floating Bulk Operations Toolbar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-lg bg-white/95 dark:bg-prussian-blue-2/95 border border-neutrals-borderLight shadow-dropdown rounded-2xl px-5 py-3.5 flex items-center justify-between gap-4 backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center gap-2.5 select-none">
            <span className="h-5 min-w-5 px-1.5 flex items-center justify-center rounded-full bg-brand text-white text-[11px] font-bold">
              {selectedIds.size}
            </span>
            <span className="text-xs font-semibold text-text-primary">selected</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Bulk Approve button */}
            <Button
              onClick={handleBulkApprove}
              disabled={isProcessing}
              variant="primary"
              size="sm"
              className="h-8 gap-1.5 text-xs font-semibold px-3"
            >
              {isProcessing && processingAction === "approve" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserCheck className="h-3.5 w-3.5" />
              )}
              Approve
            </Button>

            {/* Bulk Suspend button */}
            <Button
              onClick={handleBulkSuspend}
              disabled={isProcessing}
              variant="secondary"
              size="sm"
              className="h-8 gap-1.5 text-xs font-semibold px-3 text-danger border-danger/25 hover:bg-red-50 hover:text-danger dark:hover:bg-red-950/20"
            >
              {isProcessing && processingAction === "suspend" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserX className="h-3.5 w-3.5" />
              )}
              Suspend
            </Button>

            <button
              onClick={() => setSelectedIds(new Set())}
              disabled={isProcessing}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-text-secondary hover:bg-surface-page transition-colors disabled:opacity-50"
              title="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
