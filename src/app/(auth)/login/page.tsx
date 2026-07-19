import type { Metadata } from "next";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Login — Chowdhury Agro ERP" };

const messages: Record<string, { text: string; type: "success" | "error" }> = {
  password_updated: { text: "Password updated successfully. Please sign in.", type: "success" },
  invalid_link: { text: "Reset link is invalid or expired. Please try again.", type: "error" },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const params = await searchParams;
  const key = params.message ?? params.error;
  const banner = key ? messages[key] : null;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-mesh-light dark:bg-mesh-dark p-4">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary shadow-lg">
          <span className="text-2xl">🌿</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Chowdhury Agro ERP
        </h1>
        <p className="text-sm text-muted-foreground">
          Cattle Fattening Management
        </p>
      </div>

      <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-floating border border-border/60">
        {banner && (
          <div
            className={`mb-5 flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm ${
              banner.type === "success"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {banner.type === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            {banner.text}
          </div>
        )}
        <h2 className="mb-6 text-lg font-semibold text-card-foreground">
          Sign in to your account
        </h2>
        <LoginForm />
      </div>
    </div>
  );
}
