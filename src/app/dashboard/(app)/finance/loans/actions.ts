"use server";

import { revalidatePath , revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBusinessId } from "@/lib/supabase/get-business";
import { calcAccruedInterest } from "@/lib/loan-utils";
import { checkFinancialLock } from "@/lib/utils/financialLock";

export type LoanFormState = { error?: string; success?: boolean } | undefined;

export async function createLoan(
  _prev: LoanFormState,
  formData: FormData
): Promise<LoanFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const lenderName   = (formData.get("lender_name") as string)?.trim();
  const principal    = parseFloat(formData.get("principal_amount") as string);
  const interestRateRaw = parseFloat(formData.get("interest_rate_pct") as string);
  const interestRate = isNaN(interestRateRaw) ? 0 : interestRateRaw;
  const loanDate     = formData.get("loan_date") as string;
  const dueDate      = (formData.get("due_date") as string) || null;
  const purpose      = (formData.get("purpose") as string)?.trim() || null;
  const notes        = (formData.get("notes") as string)?.trim() || null;

  if (!lenderName) return { error: "ঋণদাতার নাম দিন" };
  if (!principal || principal <= 0) return { error: "বৈধ পরিমাণ দিন" };
  if (interestRate < 0) return { error: "সুদের হার ঋণাত্মক হতে পারে না" };
  if (interestRate > 200) return { error: "সুদের হার ২০০%-এর বেশি হতে পারে না" };
  if (!loanDate) return { error: "তারিখ দিন" };
  const todayISO = new Date().toISOString().slice(0, 10);
  if (loanDate > todayISO) return { error: "ঋণের তারিখ ভবিষ্যতে হতে পারে না" };

  const lockErr = await checkFinancialLock(supabase, businessId, loanDate);
  if (lockErr) return { error: lockErr };

  const { error } = await supabase.from("loans").insert({
    business_id: businessId,
    lender_name: lenderName,
    principal_amount: principal,
    interest_rate_pct: interestRate,
    loan_date: loanDate,
    due_date: dueDate,
    purpose,
    notes,
    status: "active",
  });

  if (error) return { error: "সংরক্ষণ ব্যর্থ হয়েছে" };
  revalidatePath("/dashboard/finance/loans");
  revalidatePath("/dashboard/finance");
  revalidateTag("accounting", { expire: 0 });
  return { success: true };
}

export async function recordLoanPayment(
  _prev: LoanFormState,
  formData: FormData
): Promise<LoanFormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const loanId = formData.get("loan_id") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const paidAt = formData.get("paid_at") as string;
  const notes  = (formData.get("notes") as string)?.trim() || null;

  if (!loanId) return { error: "Loan ID missing" };
  if (!amount || amount <= 0) return { error: "বৈধ পরিমাণ দিন" };
  if (!paidAt) return { error: "তারিখ দিন" };

  // Ownership check
  const { data: loan } = await supabase
    .from("loans")
    .select("id, business_id, principal_amount, interest_rate_pct, loan_date")
    .eq("id", loanId)
    .maybeSingle();

  if (!loan || loan.business_id !== businessId) return { error: "Unauthorized" };

  const payLockErr = await checkFinancialLock(supabase, businessId, paidAt);
  if (payLockErr) return { error: payLockErr };

  const { error } = await supabase.from("loan_payments").insert({
    loan_id: loanId,
    amount,
    paid_at: paidAt,
    notes,
  });

  if (error) return { error: "পেমেন্ট সংরক্ষণ ব্যর্থ হয়েছে" };

  // Check if fully paid — sum all payments against principal + accrued interest
  // as of this payment's date (simple interest on the original principal).
  const { data: payments } = await supabase
    .from("loan_payments")
    .select("amount")
    .eq("loan_id", loanId);

  const totalPaid = (payments ?? []).reduce((s: number, p: { amount: number }) => s + Number(p.amount), 0);
  const accruedInterest = calcAccruedInterest(
    Number(loan.principal_amount),
    Number(loan.interest_rate_pct ?? 0),
    loan.loan_date,
    paidAt
  );
  const totalOwed = Number(loan.principal_amount) + accruedInterest;
  if (totalPaid >= totalOwed - 0.01) {
    await supabase.from("loans").update({ status: "paid" }).eq("id", loanId);
  }

  revalidatePath("/dashboard/finance/loans");
  revalidatePath("/dashboard/finance");
  revalidateTag("accounting", { expire: 0 });
  return { success: true };
}

export async function deleteLoan(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const businessId = await getCurrentBusinessId(supabase);
  if (!businessId) return { error: "Business not found" };

  const { data: loan } = await supabase
    .from("loans")
    .select("business_id")
    .eq("id", id)
    .maybeSingle();

  if (!loan || loan.business_id !== businessId) return { error: "Unauthorized" };

  // Block deletion if any loan payments exist to preserve cash flow history
  const { count } = await supabase
    .from("loan_payments")
    .select("id", { count: "exact", head: true })
    .eq("loan_id", id);
    
  if ((count ?? 0) > 0) {
    return { error: "This loan has recorded payments. You cannot delete it because doing so would break the cash flow history. Please contact support if you need to reverse payments." };
  }

  await supabase.from("loans").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/dashboard/finance/loans");
  revalidatePath("/dashboard/finance");
  revalidateTag("accounting", { expire: 0 });
  return {};
}
