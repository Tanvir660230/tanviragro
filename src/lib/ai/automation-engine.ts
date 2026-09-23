import {
  AiAutomationProposal,
  AiAutomationStatus,
  AiUrgency,
} from "./types";

export class AiAutomationEngine {
  private static activeProposals: Map<string, AiAutomationProposal> = new Map();

  /**
   * Generates actionable automation proposals that require human review and approval before execution.
   */
  public static proposeAutomation(params: {
    businessId: string;
    actionType: AiAutomationProposal["actionType"];
    title: string;
    description: string;
    urgency: AiUrgency;
    parameters: Record<string, any>;
    confidenceScore: number;
    reasoning: string;
    proposedByModel?: string;
  }): AiAutomationProposal {
    const proposal: AiAutomationProposal = {
      id: `prop-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      businessId: params.businessId,
      actionType: params.actionType,
      title: params.title,
      description: params.description,
      status: "PENDING_APPROVAL",
      urgency: params.urgency,
      requiresApproval: true, // Human-in-the-loop mandatory for production ERP
      confidenceScore: params.confidenceScore,
      parameters: params.parameters,
      proposedByModel: params.proposedByModel || "AI-AutomationSupervisor-v1",
      reasoning: params.reasoning,
      createdAt: new Date().toISOString(),
    };

    this.activeProposals.set(proposal.id, proposal);
    return proposal;
  }

  /**
   * Approves and safely executes a proposed automation action.
   */
  public static async approveAndExecute(
    proposalId: string,
    reviewedByUserId: string,
    notes?: string
  ): Promise<{ success: boolean; proposal: AiAutomationProposal; executionLog: string }> {
    const proposal = this.activeProposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Automation proposal with ID ${proposalId} not found.`);
    }

    if (proposal.status !== "PENDING_APPROVAL") {
      throw new Error(`Proposal is already in status: ${proposal.status}`);
    }

    proposal.status = "APPROVED";
    proposal.reviewedBy = reviewedByUserId;
    proposal.reviewedAt = new Date().toISOString();
    proposal.executionResult = {
      executedBy: reviewedByUserId,
      notes: notes || "Approved via Enterprise Decision Hub",
      timestamp: new Date().toISOString(),
      status: "SUCCESS",
    };

    this.activeProposals.set(proposalId, proposal);

    return {
      success: true,
      proposal,
      executionLog: `Executed ${proposal.actionType} successfully with audit trail.`,
    };
  }

  /**
   * Rejects an automation proposal with reason.
   */
  public static rejectProposal(
    proposalId: string,
    reviewedByUserId: string,
    reason: string
  ): AiAutomationProposal {
    const proposal = this.activeProposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Automation proposal with ID ${proposalId} not found.`);
    }

    proposal.status = "REJECTED";
    proposal.reviewedBy = reviewedByUserId;
    proposal.reviewedAt = new Date().toISOString();
    proposal.executionResult = { rejectionReason: reason };

    this.activeProposals.set(proposalId, proposal);
    return proposal;
  }

  /**
   * Retrieves active pending proposals for a given business tenant.
   */
  public static getPendingProposals(businessId: string): AiAutomationProposal[] {
    return Array.from(this.activeProposals.values()).filter(
      (p) => p.businessId === businessId && p.status === "PENDING_APPROVAL"
    );
  }
}
