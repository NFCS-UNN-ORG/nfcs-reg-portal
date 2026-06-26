import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold border select-none transition-colors",
  {
    variants: {
      variant: {
        pending: "bg-status-pendingBackground text-status-pendingText border-status-pendingBorder rounded-full",
        active: "bg-status-successBackground text-status-successText border-status-successBorder rounded-full",
        inactive: "bg-[#F3F4F6] text-text-secondary border-neutrals-border rounded-full",
        paid: "bg-status-successBackground text-status-successText border-status-successBorder rounded-full",
        unpaid: "bg-status-errorBackground text-status-errorText border-status-errorBorder rounded-full",
        partial: "bg-status-warningBackground text-status-warningText border-status-warningBorder rounded-full",
        student: "bg-roleAccents-studentBackground text-roleAccents-student border-[#93C5FD] rounded-full",
        alumnus: "bg-roleAccents-alumnusBackground text-[#5B21B6] border-[#C4B5FD] rounded-full",
        exco: "bg-roleAccents-excoBackground text-roleAccents-exco border-[#6EE7B7] rounded-full",
        superAdmin: "bg-roleAccents-superAdminBackground text-[#991B1B] border-[#FCA5A5] rounded-full",
        sessionLabel: "bg-brand-light text-brand-accent border-brand-border rounded-[6px] px-2 py-0.7 text-[11px] font-mono leading-none font-semibold",
      },
    },
    defaultVariants: {
      variant: "inactive",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
  VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
