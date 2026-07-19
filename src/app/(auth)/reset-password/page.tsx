import type { Metadata } from "next";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Reset Password — Chowdhury Agro ERP" };

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-sidebar p-4">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary shadow-lg">
          <span className="text-2xl">🌿</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-sidebar-foreground">
          Chowdhury Agro ERP
        </h1>
        <p className="text-sm text-sidebar-foreground/60">
          Cattle Fattening Management
        </p>
      </div>

      <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-floating border border-border/60">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-card-foreground">
            Set new password
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a strong password for your account.
          </p>
        </div>
        <ResetPasswordForm />
      </div>
    </div>
  );
}
