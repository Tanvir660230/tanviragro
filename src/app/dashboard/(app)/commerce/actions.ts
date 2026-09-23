"use server";

import {
  createCommerceOrderAction as _createCommerceOrderAction,
  type CommerceActionResult,
} from "./order-actions";
import {
  createCommerceInvoiceAction as _createCommerceInvoiceAction,
  recordCommercePaymentAction as _recordCommercePaymentAction,
} from "./payment-actions";
import {
  createCommerceTransferAction as _createCommerceTransferAction,
  updateTransferTransitAction as _updateTransferTransitAction,
} from "./logistics-actions";
import {
  recordOwnershipTransferAction as _recordOwnershipTransferAction,
  createCommerceContractAction as _createCommerceContractAction,
} from "./ownership-actions";

export type { CommerceActionResult };

export async function createCommerceOrderAction(
  ...args: Parameters<typeof _createCommerceOrderAction>
) {
  return _createCommerceOrderAction(...args);
}

export async function createCommerceInvoiceAction(
  ...args: Parameters<typeof _createCommerceInvoiceAction>
) {
  return _createCommerceInvoiceAction(...args);
}

export async function recordCommercePaymentAction(
  ...args: Parameters<typeof _recordCommercePaymentAction>
) {
  return _recordCommercePaymentAction(...args);
}

export async function createCommerceTransferAction(
  ...args: Parameters<typeof _createCommerceTransferAction>
) {
  return _createCommerceTransferAction(...args);
}

export async function updateTransferTransitAction(
  ...args: Parameters<typeof _updateTransferTransitAction>
) {
  return _updateTransferTransitAction(...args);
}

export async function recordOwnershipTransferAction(
  ...args: Parameters<typeof _recordOwnershipTransferAction>
) {
  return _recordOwnershipTransferAction(...args);
}

export async function createCommerceContractAction(
  ...args: Parameters<typeof _createCommerceContractAction>
) {
  return _createCommerceContractAction(...args);
}


