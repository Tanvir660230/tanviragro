/**
 * Tanvir Agro ERP — Workflow Automation Platform
 * Unified Public API
 */

import { workflowEngine } from "./engine";
import { DEFAULT_WORKFLOW_RULES } from "./rules";

// Register default enterprise workflow rules automatically
workflowEngine.registerRules(DEFAULT_WORKFLOW_RULES);

export { workflowEngine } from "./engine";
export { DEFAULT_WORKFLOW_RULES } from "./rules";
export { eventBus } from "../events/event-bus";
export { deliveryService } from "../delivery/channels";
export * from "./types";
export * from "../events/types";
export * from "../alerts/hierarchy";
export * from "../notifications/types";
