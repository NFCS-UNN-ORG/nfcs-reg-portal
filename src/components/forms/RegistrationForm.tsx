"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupFormValues } from "@/lib/validations/member.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registerMember } from "@/lib/actions/member.actions";
import {
  AlertCircle,
  CheckCircle,
  User,
  Mail,
  Lock,
  Hash,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";
import { motion, AnimatePresence } from "motion/react";

const STEPS = [
  { id: "full_name", name: "Full Name", description: "Who are you?", placeholder: "John Doe" },
  { id: "matric_number", name: "Matric Number", description: "Your school ID", placeholder: "2019/123456" },
  { id: "email", name: "Email Address", description: "For portal access", placeholder: "john@example.com" },
  { id: "password", name: "Password", description: "Secure your account", placeholder: "••••••••" },
];

export function RegistrationForm() {
  const { toast } = useToast();
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState(0);

  const [minPasswordLength, setMinPasswordLength] = React.useState(6);
  const [requireNumbers, setRequireNumbers] = React.useState(false);
  const [requireSymbols, setRequireSymbols] = React.useState(false);

  React.useEffect(() => {
    const savedLength = localStorage.getItem("settings_sec_min_length");
    const savedNum = localStorage.getItem("settings_sec_req_num");
    const savedSym = localStorage.getItem("settings_sec_req_sym");

    if (savedLength) setMinPasswordLength(parseInt(savedLength, 10));
    if (savedNum !== null) setRequireNumbers(savedNum === "true");
    if (savedSym !== null) setRequireSymbols(savedSym === "true");
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    mode: "onChange",
    defaultValues: {
      full_name: "",
      matric_number: "",
      email: "",
      password: "",
    },
  });

  const watchedValues = watch();
  const passwordVal = watchedValues.password || "";

  // Password rules validation for checklist
  const passwordRules = {
    lowercase: /[a-z]/.test(passwordVal),
    uppercase: /[A-Z]/.test(passwordVal),
    numbers: /[0-9]/.test(passwordVal),
    special: /[^a-zA-Z0-9]/.test(passwordVal),
    length: passwordVal.length >= minPasswordLength,
  };

  const handleNext = async () => {
    const currentFieldName = STEPS[currentStep].id as keyof SignupFormValues;
    const isValid = await trigger(currentFieldName);
    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const onFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < STEPS.length - 1) {
      await handleNext();
    } else {
      await handleSubmit(onSubmit)();
    }
  };

  const onSubmit = async (values: SignupFormValues) => {
    setIsLoading(true);
    setError(null);

    if (values.password.length < minPasswordLength) {
      setError(`Password must be at least ${minPasswordLength} characters.`);
      setIsLoading(false);
      return;
    }
    if (requireNumbers && !/[0-9]/.test(values.password)) {
      setError("Password must contain at least one numeric digit.");
      setIsLoading(false);
      return;
    }
    if (requireSymbols && !/[^a-zA-Z0-9]/.test(values.password)) {
      setError("Password must contain at least one special character.");
      setIsLoading(false);
      return;
    }

    const formData = new FormData();
    Object.entries(values).forEach(([key, val]) => {
      formData.append(key, val);
    });

    try {
      const result = await registerMember(formData);
      console.log("[register/onSubmit] server action result:", result);
      if (result?.success === true) {
        setSuccess(true);
        toast({
          title: "Registration Submitted",
          description: "Your registration is awaiting exco approval.",
          variant: "success",
        });
      } else if (result?.error) {
        const errMsg = typeof result.error === "string"
          ? result.error
          : JSON.stringify(result.error) || "Registration failed. Please try again.";
        setError(errMsg);
        toast({
          title: "Registration Failed",
          description: errMsg,
          variant: "error",
        });
      } else {
        const errMsg = "Server error: could not complete registration. Please try again.";
        setError(errMsg);
        toast({ title: "Registration Failed", description: errMsg, variant: "error" });
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center text-center gap-6 py-12 px-6 bg-surface">
        <div className="h-20 w-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-100 shadow-sm animate-bounce">
          <CheckCircle className="h-10 w-10" />
        </div>
        <div className="space-y-3">
          <h3 className="text-2xl font-bold text-text-primary tracking-tight">Registration Submitted!</h3>
          <p className="text-sm text-text-secondary max-w-md leading-relaxed">
            Thank you for registering. Your profile has been created with a <strong className="text-brand-orange">pending</strong> status. An Exco member will review your credentials and approve your account shortly.
          </p>
        </div>
        <Button asChild variant="primary" className="mt-4 px-8 py-2.5 h-auto text-sm font-semibold rounded-xl bg-brand hover:bg-brand-accent transition-colors shadow-lg">
          <a href="/login">Go to Login</a>
        </Button>
      </div>
    );
  }

  const activeFieldId = STEPS[currentStep].id;

  return (
    <div className="flex flex-col md:flex-row bg-surface">
      {/* Sidebar Timeline (Desktop only) */}
      <div className="hidden md:flex md:w-[260px] bg-surface-subtle p-8 border-r border-border flex-col justify-between select-none">
        <div className="space-y-6">
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Registration</h4>
            <p className="text-[10px] text-text-tertiary">Complete the steps below to join the portal</p>
          </div>

          {/* Vertical Timeline */}
          <div className="relative flex flex-col gap-6">
            {STEPS.map((step, idx) => {
              const isCompleted = idx < currentStep;
              const isActive = idx === currentStep;
              const isUpcoming = idx > currentStep;

              return (
                <div key={step.id} className="flex gap-4 items-start relative select-none">
                  {/* Connector Line */}
                  {idx < STEPS.length - 1 && (
                    <div
                      className={cn(
                        "absolute left-[13px] top-[26px] w-[2px] h-[calc(100%+8px)] transition-all duration-300",
                        isCompleted ? "bg-brand" : "bg-border"
                      )}
                    />
                  )}

                  {/* Step Indicator Circle */}
                  <div
                    className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center border-2 text-xs font-bold transition-all duration-300 z-10 shrink-0",
                      isCompleted && "bg-brand border-brand text-white",
                      isActive && "border-brand text-brand bg-white shadow-inputFocus",
                      isUpcoming && "border-border text-text-muted bg-surface-subtle"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>

                  {/* Step Info */}
                  <div className="space-y-0.5 text-left">
                    <span
                      className={cn(
                        "text-xs font-bold block transition-all duration-300",
                        isActive ? "text-text-primary font-bold" : "text-text-secondary font-medium",
                        isUpcoming && "text-text-tertiary font-normal"
                      )}
                    >
                      {step.name}
                    </span>
                    <span className="text-[10px] text-text-tertiary block">
                      {step.description}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-[10px] text-text-tertiary leading-relaxed pt-6 border-t border-border">
          NFCS UNN Chapter Portal Enrollment. All user accounts require Exco verification.
        </div>
      </div>

      {/* Form Content Panel */}
      <div className="flex-1 p-6 md:p-8 flex flex-col justify-between min-h-[385px]">
        {/* Mobile Progress bar tracker (hidden on desktop) */}
        <div className="md:hidden space-y-2 mb-6">
          <div className="flex justify-between items-center text-xs font-bold text-text-secondary select-none">
            <span>Step {currentStep + 1} of {STEPS.length}</span>
            <span className="text-brand">{STEPS[currentStep].name}</span>
          </div>
          <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
            <div
              className="bg-brand h-full rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        <form onSubmit={onFormSubmit} className="space-y-5 flex-1 flex flex-col justify-between">
          <div className="space-y-5">
            {error && (
              <div className="flex items-center gap-2.5 rounded-xl bg-status-errorBackground p-3.5 text-xs font-medium text-status-errorText border border-status-errorBorder animate-in fade-in duration-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="min-h-[160px] flex flex-col justify-end">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ x: 15, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -15, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4"
                >
                  <div>
                    <h3 className="text-base font-bold text-text-primary tracking-tight">
                      {STEPS[currentStep].name}
                    </h3>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {STEPS[currentStep].description}
                    </p>
                  </div>

                  {activeFieldId === "full_name" && (
                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-semibold text-text-secondary">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
                        <Input
                          error={!!errors.full_name}
                          {...register("full_name")}
                          placeholder="John Doe"
                          className="pl-9 h-10 rounded-lg text-xs"
                          disabled={isLoading}
                          autoFocus
                        />
                      </div>
                      {errors.full_name && (
                        <p className="text-[11px] text-danger flex items-center gap-1 mt-1 font-semibold">
                          <AlertCircle className="h-3 w-3" />
                          {errors.full_name.message}
                        </p>
                      )}
                    </div>
                  )}

                  {activeFieldId === "matric_number" && (
                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-semibold text-text-secondary">Registration / Matric Number</label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
                        <Input
                          error={!!errors.matric_number}
                          {...register("matric_number")}
                          placeholder="2019/123456"
                          className="pl-9 h-10 rounded-lg text-xs"
                          disabled={isLoading}
                          autoFocus
                        />
                      </div>
                      {errors.matric_number && (
                        <p className="text-[11px] text-danger flex items-center gap-1 mt-1 font-semibold">
                          <AlertCircle className="h-3 w-3" />
                          {errors.matric_number.message}
                        </p>
                      )}
                    </div>
                  )}

                  {activeFieldId === "email" && (
                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-semibold text-text-secondary">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
                        <Input
                          error={!!errors.email}
                          type="email"
                          {...register("email")}
                          placeholder="john@example.com"
                          className="pl-9 h-10 rounded-lg text-xs"
                          disabled={isLoading}
                          autoFocus
                        />
                      </div>
                      {errors.email && (
                        <p className="text-[11px] text-danger flex items-center gap-1 mt-1 font-semibold">
                          <AlertCircle className="h-3 w-3" />
                          {errors.email.message}
                        </p>
                      )}
                    </div>
                  )}

                  {activeFieldId === "password" && (
                    <div className="space-y-1.5 text-left animate-in fade-in duration-200">
                      <label className="text-xs font-semibold text-text-secondary">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
                        <Input
                          error={!!errors.password}
                          type={showPassword ? "text" : "password"}
                          {...register("password")}
                          placeholder={`Minimum ${minPasswordLength} characters`}
                          className="pl-9 pr-9 h-10 rounded-lg text-xs"
                          disabled={isLoading}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary hover:text-slate-600 transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="text-[11px] text-danger flex items-center gap-1 mt-1 font-semibold">
                          <AlertCircle className="h-3 w-3" />
                          {errors.password.message}
                        </p>
                      )}

                      {/* Password requirements checklist */}
                      <div className="mt-2.5 p-3 bg-surface-subtle rounded-lg border border-border space-y-1.5">
                        <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Password must contain:</p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                          <div className="flex items-center gap-1.5 text-[10px] text-text-secondary">
                            <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", passwordRules.lowercase ? "bg-emerald-500" : "bg-text-muted")} />
                            <span>lower-case</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-text-secondary">
                            <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", passwordRules.numbers ? "bg-emerald-500" : "bg-text-muted")} />
                            <span>numbers {requireNumbers && <span className="text-danger">*</span>}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-text-secondary">
                            <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", passwordRules.uppercase ? "bg-emerald-500" : "bg-text-muted")} />
                            <span>upper-case</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-text-secondary">
                            <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", passwordRules.length ? "bg-emerald-500" : "bg-text-muted")} />
                            <span>{minPasswordLength}+ characters</span>
                          </div>
                          {requireSymbols && (
                            <div className="flex items-center gap-1.5 text-[10px] text-text-secondary col-span-2">
                              <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", passwordRules.special ? "bg-emerald-500" : "bg-text-muted")} />
                              <span>special character (e.g. !@#$) <span className="text-danger">*</span></span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Actions Row */}
          <div className="flex justify-between items-center pt-4 border-t border-border mt-6 select-none">
            {currentStep > 0 ? (
              <Button
                type="button"
                variant="secondary"
                onClick={handleBack}
                className="gap-1.5 h-9 rounded-lg text-xs font-semibold animate-in fade-in duration-200"
                disabled={isLoading}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            ) : (
              <div /> // Spacer
            )}

            {currentStep < STEPS.length - 1 ? (
              <Button
                type="button"
                variant="primary"
                onClick={handleNext}
                className="gap-1.5 h-9 rounded-lg text-xs font-semibold transition-transform duration-200"
              >
                Next
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                type="submit"
                variant="primary"
                className="gap-1.5 h-9 rounded-lg text-xs font-semibold"
                isLoading={isLoading}
              >
                Submit Registration
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
