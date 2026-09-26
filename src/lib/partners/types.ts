/** Result of checking a partner or a partner entry before it is saved (lib/partners/partner-engine.ts). */
export interface PartnerValidationResult {
  isValid: boolean;
  errors: string[];
}
