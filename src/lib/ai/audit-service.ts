import {
  AiAuditLogEntry,
  AiModelTask,
  AiProviderType,
} from "./types";

export class AiAuditService {
  private static logs: AiAuditLogEntry[] = [];

  /**
   * Records an immutable audit log entry for every AI inference, prompt, and output summary.
   */
  public static logInference(entry: {
    businessId: string;
    userId?: string;
    task: AiModelTask;
    provider: AiProviderType;
    model: string;
    promptTokens?: number;
    completionTokens?: number;
    latencyMs: number;
    prompt: string;
    outputSummary: string;
    confidenceScore: number;
  }): AiAuditLogEntry {
    const sanitizedPrompt = this.sanitizePII(entry.prompt);
    const sanitizedOutputSummary = this.sanitizePII(entry.outputSummary);

    const auditEntry: AiAuditLogEntry = {
      id: `ai-audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      businessId: entry.businessId,
      userId: entry.userId,
      task: entry.task,
      provider: entry.provider,
      model: entry.model,
      promptTokens: entry.promptTokens || 0,
      completionTokens: entry.completionTokens || 0,
      latencyMs: entry.latencyMs,
      sanitizedPrompt,
      sanitizedOutputSummary,
      confidenceScore: entry.confidenceScore,
      createdAt: new Date().toISOString(),
    };

    this.logs.unshift(auditEntry);
    // Keep max 500 in memory for telemetry buffer
    if (this.logs.length > 500) {
      this.logs.pop();
    }

    return auditEntry;
  }

  /**
   * Submits user feedback (thumbs up / down) on an AI inference.
   */
  public static recordFeedback(logId: string, rating: 1 | -1, notes?: string): boolean {
    const log = this.logs.find((l) => l.id === logId);
    if (!log) return false;
    log.feedbackRating = rating;
    log.feedbackNotes = notes;
    return true;
  }

  /**
   * Retrieves recent AI audit trails for a business.
   */
  public static getLogs(businessId: string): AiAuditLogEntry[] {
    return this.logs.filter((l) => l.businessId === businessId);
  }

  /**
   * Masks Personally Identifiable Information (PII) before storage or audit ingestion.
   */
  public static sanitizePII(text: string): string {
    if (!text) return "";
    return text
      // Mask email addresses
      .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, "[REDACTED_EMAIL]")
      // Mask Bangladesh / International phone numbers
      .replace(/(\+?880|0)1[3-9]\d{8}/g, "[REDACTED_PHONE]")
      // Mask credit card numbers
      .replace(/\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, "[REDACTED_CARD]");
  }
}
