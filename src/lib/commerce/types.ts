export type CommerceOrderType = "purchase" | "sale" | "transfer" | "contract";
export type CounterpartyType = "vendor" | "customer" | "partner" | "internal_farm";
export type CommerceOrderStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "in_progress"
  | "in_transit"
  | "delivered"
  | "completed"
  | "cancelled";

export type CommercePaymentStatus = "unpaid" | "partially_paid" | "paid" | "refunded";
export type CommerceItemType = "livestock" | "feed" | "semen" | "equipment" | "service" | "other";

export type CommerceInvoiceType = "purchase_invoice" | "sale_invoice" | "transport_invoice" | "tax_invoice";
export type CommerceInvoiceStatus = "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "void" | "cancelled";

export type PaymentMethod = "cash" | "bank_transfer" | "cheque" | "mobile_banking" | "bKash" | "Nagad" | "other";
export type PaymentType = "receipt" | "disbursement" | "refund" | "installment";

export type TransferType =
  | "farm_to_farm"
  | "department"
  | "pen_to_pen"
  | "sale_delivery"
  | "purchase_inbound"
  | "temporary_exhibition";

export type TransitStatus =
  | "scheduled"
  | "dispatched"
  | "in_transit"
  | "arrived"
  | "inspected"
  | "completed"
  | "cancelled";

export type OwnershipTransferReason =
  | "purchase"
  | "sale"
  | "inheritance"
  | "internal_transfer"
  | "partner_allocation"
  | "lease"
  | "disposal";

export type OwnershipApprovalStatus = "pending" | "verified" | "contested" | "archived";

export type ContractType =
  | "purchase_agreement"
  | "sale_contract"
  | "supply_framework"
  | "ownership_transfer"
  | "transport_contract"
  | "custom_farming";

export type ContractStatus = "draft" | "active" | "fulfilled" | "terminated" | "expired";


export interface CommerceOrder {
  id: string;
  businessId: string;
  orderNumber: string;
  orderType: CommerceOrderType;
  counterpartyType: CounterpartyType;
  counterpartyId?: string | null;
  counterpartyName: string;
  counterpartyContact?: string | null;
  status: CommerceOrderStatus;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  currency: string;
  subtotalAmount: number;
  taxAmount: number;
  discountAmount: number;
  transportCost: number;
  commissionAmount: number;
  netTotalAmount: number;
  paidAmount: number;
  paymentStatus: CommercePaymentStatus;
  paymentTerms?: string | null;
  contractId?: string | null;
  notes?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: CommerceOrderItem[];
}

export interface CommerceInvoice {
  id: string;
  businessId: string;
  orderId?: string | null;
  invoiceNumber: string;
  invoiceType: CommerceInvoiceType;
  customerOrVendorName: string;
  customerOrVendorContact?: string | null;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: CommerceInvoiceStatus;
  paymentInstructions?: string | null;
  pdfUrl?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface CommercePayment {
  id: string;
  businessId: string;
  invoiceId?: string | null;
  orderId?: string | null;
  paymentNumber: string;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
  amount: number;
  paymentDate: string;
  referenceTxnId?: string | null;
  accountCode: string;
  receivedOrPaidBy?: string | null;
  notes?: string | null;
  receiptAttachmentUrl?: string | null;
  createdAt: string;
}

export interface CommerceTransfer {
  id: string;
  businessId: string;
  orderId?: string | null;
  transferNumber: string;
  transferType: TransferType;
  originName: string;
  originId?: string | null;
  destinationName: string;
  destinationId?: string | null;
  cattleIds: string[];
  vehicleType?: string | null;
  vehicleNumber?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  scheduledDeparture?: string | null;
  actualDeparture?: string | null;
  estimatedArrival?: string | null;
  actualArrival?: string | null;
  transportCost: number;
  transitStatus: TransitStatus;
  inspectionChecklist?: {
    health_ok: boolean;
    injuries: boolean;
    feed_provided: boolean;
    water_provided: boolean;
    weight_verified?: boolean;
    quarantine_recommended?: boolean;
  };
  inspectedBy?: string | null;
  inspectionNotes?: string | null;
  createdAt: string;
}

export interface OwnershipRecord {
  id: string;
  businessId: string;
  cattleId: string;
  tagId?: string | null;
  transferReason: OwnershipTransferReason;
  previousOwnerName: string;
  previousOwnerContact?: string | null;
  newOwnerName: string;
  newOwnerContact?: string | null;
  transferDate: string;
  transferPrice: number;
  legalDocumentRef?: string | null;
  digitalSignatureHash?: string | null;
  witnessName?: string | null;
  approvalStatus: OwnershipApprovalStatus;
  notes?: string | null;
  recordedBy?: string | null;
  createdAt: string;
}

export interface CommerceContract {
  id: string;
  businessId: string;
  contractNumber: string;
  title: string;
  contractType: ContractType;
  counterpartyName: string;
  counterpartyContact?: string | null;
  startDate: string;
  endDate?: string | null;
  totalContractValue: number;
  termsAndConditions?: string | null;
  status: ContractStatus;
  documentUrl?: string | null;
  signedAt?: string | null;
  createdAt: string;
}

export interface CommercialProfitLossSummary {
  cattleId: string;
  tagId: string;
  purchasePrice: number;
  feedCost: number;
  medicalCost: number;
  logisticsCost: number;
  totalCostBasis: number;
  salePrice: number;
  grossMarginBdt: number;
  netMarginPercentage: number;
  holdingDays: number;
  annualizedRoi: number;
}

export interface CommerceOrderItem {
  id?: string;
  orderId?: string;
  cattleId?: string;
  itemType: CommerceItemType;
  tagId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  initialWeightKg?: number;
  currentWeightKg?: number;
  finalWeightKg?: number;
  ratePerKg?: number;
  totalPrice: number;
  status?: "pending" | "inspected" | "received" | "delivered" | "rejected";
  inspectionNotes?: string;
  metadata?: Record<string, any>;
}
