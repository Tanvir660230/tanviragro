"use client"

import { toast as sonnerToast, type ExternalToast } from "sonner"

/**
 * Consistent toast notifications wrapping sonner.
 * All app toasts should use this for uniform behavior.
 */
export const toast = {
  success: (message: string, opts?: ExternalToast) =>
    sonnerToast.success(message, { duration: 4000, ...opts }),

  error: (message: string, opts?: ExternalToast) =>
    sonnerToast.error(message, { duration: 6000, ...opts }),

  warning: (message: string, opts?: ExternalToast) =>
    sonnerToast.warning(message, { duration: 5000, ...opts }),

  info: (message: string, opts?: ExternalToast) =>
    sonnerToast.info(message, { duration: 4000, ...opts }),

  default: (message: string, opts?: ExternalToast) =>
    sonnerToast(message, { duration: 4000, ...opts }),

  /** Show a promise-based toast with loading → success/error states */
  promise: <T,>(
    promise: Promise<T>,
    opts: {
      loading?: string
      success?: string | ((data: T) => string)
      error?: string | ((err: unknown) => string)
    } & ExternalToast
  ) => {
    const { loading, success, error, ...rest } = opts
    return sonnerToast.promise(promise, {
      loading: loading || "Loading...",
      success: success || "Done!",
      error: error || "Something went wrong",
      ...rest,
    })
  },

  /** Dismiss all toasts */
  dismiss: () => sonnerToast.dismiss(),

  /** Dismiss a specific toast by ID */
  dismissById: (id: string | number) => sonnerToast.dismiss(id),
}
