import type {
  CommerceOrderItem,
  CommerceOrderStatus,
  CommerceInvoiceStatus,
  CommerceInvoice,
  CommercePayment,
} from "./types";

export interface OrderTotalOptions {
  taxRatePercent?: number;
  discountAmount?: number;
  transportCost?: number;
  commissionAmount?: number;
}

export interface CalculatedOrderTotals {
  subtotalAmount: number;
  taxAmount: number;
  discountAmount: number;
  transportCost: number;
  commissionAmount: number;
  netTotalAmount: number;
  itemCount: number;
  totalWeightKg: number;
  averageRatePerKg: number;
}

export interface InstallmentScheduleItem {
  installmentNumber: number;
  dueDate: string;
  amount: number;
  status: "pending" | "paid";
}

export class CommerceEngine {
  /**
   * Calculates comprehensive order totals and metrics
   */
  public static calculateOrderTotals(
    items: CommerceOrderItem[],
    options: OrderTotalOptions = {}
  ): CalculatedOrderTotals {
    let subtotal = 0;
    let totalWeight = 0;

    for (const item of items) {
      let itemPrice = Number(item.totalPrice) || 0;

      // Dynamic rate-per-kg calculation if rate and weight are present
      if (item.ratePerKg && (item.finalWeightKg || item.currentWeightKg || item.initialWeightKg)) {
        const weight = item.finalWeightKg ?? item.currentWeightKg ?? item.initialWeightKg ?? 0;
        itemPrice = Math.round(Number(item.ratePerKg) * weight * 100) / 100;
        item.totalPrice = itemPrice;
      } else if (!itemPrice && item.unitPrice && item.quantity) {
        itemPrice = Math.round(Number(item.unitPrice) * Number(item.quantity) * 100) / 100;
        item.totalPrice = itemPrice;
      }

      subtotal += itemPrice;
      if (item.finalWeightKg || item.currentWeightKg || item.initialWeightKg) {
        totalWeight += item.finalWeightKg ?? item.currentWeightKg ?? item.initialWeightKg ?? 0;
      }
    }

    const taxRate = options.taxRatePercent ?? 0;
    const discount = Math.max(0, Number(options.discountAmount) || 0);
    const transport = Math.max(0, Number(options.transportCost) || 0);
    const commission = Math.max(0, Number(options.commissionAmount) || 0);

    const discountedSubtotal = Math.max(0, subtotal - discount);
    const taxAmount = Math.round(((discountedSubtotal * taxRate) / 100) * 100) / 100;
    const netTotal = Math.round((discountedSubtotal + taxAmount + transport + commission) * 100) / 100;

    const avgRatePerKg = totalWeight > 0 ? Math.round((subtotal / totalWeight) * 100) / 100 : 0;

    return {
      subtotalAmount: Math.round(subtotal * 100) / 100,
      taxAmount,
      discountAmount: discount,
      transportCost: transport,
      commissionAmount: commission,
      netTotalAmount: netTotal,
      itemCount: items.length,
      totalWeightKg: Math.round(totalWeight * 100) / 100,
      averageRatePerKg: avgRatePerKg,
    };
  }

  /**
   * Generates installment payment schedule
   */
  public static generateInstallmentSchedule(
    totalAmount: number,
    installmentsCount: number,
    startDateISO: string,
    intervalDays: number = 30
  ): InstallmentScheduleItem[] {
    if (installmentsCount <= 0 || totalAmount <= 0) return [];

    const baseAmount = Math.floor((totalAmount / installmentsCount) * 100) / 100;
    const remainder = Math.round((totalAmount - baseAmount * installmentsCount) * 100) / 100;

    const schedule: InstallmentScheduleItem[] = [];
    const baseDate = new Date(startDateISO);

    for (let i = 1; i <= installmentsCount; i++) {
      const dueDate = new Date(baseDate);
      dueDate.setDate(dueDate.getDate() + (i - 1) * intervalDays);

      let amt = baseAmount;
      if (i === installmentsCount) {
        amt = Math.round((amt + remainder) * 100) / 100;
      }

      schedule.push({
        installmentNumber: i,
        dueDate: dueDate.toISOString().split("T")[0],
        amount: amt,
        status: "pending",
      });
    }

    return schedule;
  }

  /**
   * Reconciles invoice balance and determines status
   */
  public static reconcileInvoice(
    invoice: Pick<CommerceInvoice, "totalAmount" | "dueDate">,
    payments: Pick<CommercePayment, "amount">[]
  ): {
    totalPaid: number;
    balanceDue: number;
    status: CommerceInvoiceStatus;
    isFullyPaid: boolean;
  } {
    const totalPaid = Math.round(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0) * 100) / 100;
    const balanceDue = Math.max(0, Math.round((invoice.totalAmount - totalPaid) * 100) / 100);
    const isFullyPaid = balanceDue <= 0.001;

    let status: CommerceInvoiceStatus = "issued";
    if (isFullyPaid) {
      status = "paid";
    } else if (totalPaid > 0) {
      status = "partially_paid";
    } else {
      const today = new Date().toISOString().split("T")[0];
      if (invoice.dueDate && invoice.dueDate < today) {
        status = "overdue";
      }
    }

    return {
      totalPaid,
      balanceDue,
      status,
      isFullyPaid,
    };
  }

  /**
   * Validates state transition for Commerce Order
   */
  public static isValidOrderStatusTransition(
    current: CommerceOrderStatus,
    next: CommerceOrderStatus
  ): boolean {
    const allowedTransitions: Record<CommerceOrderStatus, CommerceOrderStatus[]> = {
      draft: ["pending_approval", "approved", "cancelled"],
      pending_approval: ["approved", "draft", "cancelled"],
      approved: ["in_progress", "in_transit", "delivered", "completed", "cancelled"],
      in_progress: ["in_transit", "delivered", "completed", "cancelled"],
      in_transit: ["delivered", "completed", "cancelled"],
      delivered: ["completed", "cancelled"],
      completed: [],
      cancelled: [],
    };

    return allowedTransitions[current]?.includes(next) ?? false;
  }
}
