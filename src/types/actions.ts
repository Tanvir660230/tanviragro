/**
 * Standardized Action State & Return Contracts for React Server Actions
 */

export interface ActionError {
  field?: string;
  code?: string;
  message: string;
}

export type ActionState<T = unknown> = {
  success?: boolean;
  error?: string;
  errors?: ActionError[];
  warning?: string;
  data?: T;
} | undefined;

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: ActionError[];
  warning?: string;
}
