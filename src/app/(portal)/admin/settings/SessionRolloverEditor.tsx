"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AlertCircle, RefreshCw } from "lucide-react";
import { performSessionRollover } from "@/lib/actions/member.actions";
import { useToast } from "@/components/ui/toast";

interface SessionRolloverEditorProps {
  currentExcoId: string;
}

export function SessionRolloverEditor({ currentExcoId }: SessionRolloverEditorProps) {
  const { toast } = useToast();
  const [confirmText, setConfirmText] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  const handleRollover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText !== "ROLLOVER") return;

    setIsLoading(true);
    try {
      const result = await performSessionRollover(currentExcoId);
      if (result.error) {
        toast({
          title: "Rollover Failed",
          description: result.error,
          variant: "error",
        });
      } else {
        toast({
          title: "Rollover Successful",
          description: `Academic session has rolled over. Promoted ${result.count} students.`,
          variant: "success",
        });
        setConfirmText("");
      }
    } catch (err: any) {
      toast({
        title: "Unexpected Error",
        description: err?.message || "Failed to perform session rollover",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border border-neutrals-borderLight shadow-card bg-white dark:bg-prussian-blue-2">
      <CardHeader>
        <CardTitle className="text-base font-bold text-text-primary flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-brand" /> Academic Session Rollover
        </CardTitle>
        <CardDescription>
          Promote all active students to their next academic level and prepare the database for the new academic session.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 font-sans">
        {/* Warning card */}
        <div className="flex gap-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
          <div className="space-y-1 text-xs">
            <h4 className="font-bold text-sm">Critical Warning: Irreversible Action</h4>
            <p className="leading-relaxed opacity-95">
              Performing a session rollover does the following for all active students/excos in the database:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-1 opacity-90 pl-1 font-medium">
              <li>Increments their level by 1 year (e.g., 100 Level → 200 Level, 400 Level → 500 Level).</li>
              <li>Graduates students who have reached their program duration (e.g. 4 years for Arts, 5 years for Engineering) and upgrades their role to **Alumnus** (meaning they are no longer billed for annual session dues).</li>
              <li>Resets all Exco positions (President, Treasurer, etc.) to **null** and returns their roles to **Student** to clear the board for the new session elections.</li>
            </ul>
            <p className="mt-2 font-bold text-[11px]">
              Please ensure all payments for the current session are fully recorded before running this action.
            </p>
          </div>
        </div>

        {/* Form confirmation */}
        <form onSubmit={handleRollover} className="space-y-4 max-w-md pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">
              To proceed, please type <span className="font-bold text-text-primary select-all">ROLLOVER</span> in the input below:
            </label>
            <Input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type ROLLOVER to confirm"
              className="h-10"
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            disabled={confirmText !== "ROLLOVER" || isLoading}
            className="w-full sm:w-auto px-6 h-10 text-xs font-bold gap-1.5 bg-brand hover:bg-brand-accent text-white"
            isLoading={isLoading}
          >
            <RefreshCw className="h-4 w-4" /> Start Session Rollover
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
