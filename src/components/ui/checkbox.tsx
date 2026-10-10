"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: boolean;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, checked, defaultChecked, onChange, disabled, id, error, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <label
        htmlFor={inputId}
        className={cn(
          "relative flex items-start gap-2.5 select-none cursor-pointer group text-xs",
          disabled && "cursor-not-allowed opacity-60",
          className
        )}
      >
        <div className="relative flex items-center justify-center shrink-0 mt-0.5">
          <input
            type="checkbox"
            id={inputId}
            ref={ref}
            checked={checked}
            defaultChecked={defaultChecked}
            onChange={onChange}
            disabled={disabled}
            className="peer sr-only"
            {...props}
          />
          <div
            className={cn(
              "h-4 w-4 rounded border transition-all duration-150 flex items-center justify-center",
              "border-neutrals-border bg-surface shadow-xs",
              "peer-focus-visible:ring-2 peer-focus-visible:ring-brand-accent/30 peer-focus-visible:border-brand-accent",
              "peer-checked:bg-brand-accent peer-checked:border-brand-accent peer-checked:text-white",
              "peer-disabled:bg-surface-subtle peer-disabled:border-neutrals-border peer-disabled:cursor-not-allowed",
              error && "border-danger peer-focus-visible:ring-danger/30"
            )}
          >
            <Check className="h-3 w-3 stroke-[3] opacity-0 peer-checked:opacity-100 transition-opacity duration-150" />
          </div>
        </div>

        {(label || description) && (
          <div className="flex flex-col text-left">
            {label && (
              <span className="font-medium text-text-primary group-hover:text-brand-accent transition-colors">
                {label}
              </span>
            )}
            {description && (
              <span className="text-[11px] text-text-tertiary">
                {description}
              </span>
            )}
          </div>
        )}
      </label>
    );
  }
);

Checkbox.displayName = "Checkbox";

export { Checkbox };
