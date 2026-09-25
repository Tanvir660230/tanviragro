import type { CattleGender, CattleStatus, UserRole } from "@/types/database";
import {
  InvalidStatusTransitionError,
  WithdrawalPeriodActiveError,
  UnauthorizedLifecycleTransitionError,
  BreedingAgeViolationError,
  LifecycleBusinessRuleError,
  LifecycleDateSanityError,
} from "./errors";
import type {
  LivestockPermissionRules,
  LifecycleTransitionRule,
} from "./types";
import { todayDhaka } from "@/lib/dates";

/** Allowed livestock lifecycle status transitions based on biological and ERP constraints */
export const VALID_STATUS_TRANSITIONS: Record<CattleStatus, CattleStatus[]> = {
  active: ["quarantined", "sold", "dead", "stolen", "culled", "archived"],
  quarantined: ["active", "sold", "dead", "culled", "archived"],
  sold: ["archived"], // Terminal commercial state
  dead: ["archived"], // Terminal biological state
  stolen: ["active", "archived"], // Recovered or closed
  culled: ["dead", "sold", "archived"],
  archived: [], // Terminal historical state
};

/** Reusable transition configuration with metadata and role permissions */
export const LIFECYCLE_TRANSITIONS_CONFIG: LifecycleTransitionRule[] = [
  {
    from: "active",
    to: "quarantined",
    allowedRoles: ["owner", "manager", "veterinarian", "staff"],
    labelEn: "Move to Quarantine",
    labelBn: "কোয়ারেন্টাইনে স্থানান্তর",
    description: "Isolate animal due to disease symptoms, arrival, or bio-security protocols.",
    requiresReason: true,
  },
  {
    from: "active",
    to: "sold",
    allowedRoles: ["owner", "manager"],
    labelEn: "Record Sale",
    labelBn: "বিক্রয় রেকর্ড",
    description: "Liquidate animal through commercial sale or private slaughter contract.",
    requiresDrugWithdrawalClearance: true,
    financialLockCheck: true,
    requiresConfirmation: true,
  },
  {
    from: "active",
    to: "dead",
    allowedRoles: ["owner", "manager", "veterinarian"],
    labelEn: "Record Mortality",
    labelBn: "মৃত্যু রেকর্ড",
    description: "Log biological death, post-mortem diagnosis, and disposal.",
    requiresReason: true,
    requiresConfirmation: true,
  },
  {
    from: "active",
    to: "stolen",
    allowedRoles: ["owner", "manager"],
    labelEn: "Report Stolen / Missing",
    labelBn: "চুরি / নিখোঁজ রিপোর্ট",
    description: "Flag animal as missing from paddock or stolen during transit.",
    requiresReason: true,
    requiresConfirmation: true,
  },
  {
    from: "active",
    to: "culled",
    allowedRoles: ["owner", "manager", "veterinarian"],
    labelEn: "Mark as Culled",
    labelBn: "বাতিল হিসেবে চিহ্নিত",
    description: "Remove from breeding/dairy herd due to age, disease, or low productivity.",
    requiresReason: true,
  },
  {
    from: "active",
    to: "archived",
    allowedRoles: ["owner"],
    labelEn: "Archive Record",
    labelBn: "আর্কাইভ করুন",
    description: "Archive record permanently from active operational tracking.",
    requiresReason: true,
    requiresConfirmation: true,
  },
  {
    from: "quarantined",
    to: "active",
    allowedRoles: ["owner", "manager", "veterinarian"],
    labelEn: "Release from Quarantine",
    labelBn: "কোয়ারেন্টাইন থেকে মুক্তি",
    description: "Veterinarian clearance confirming animal is healthy and fit to rejoin herd.",
  },
  {
    from: "quarantined",
    to: "sold",
    allowedRoles: ["owner", "manager"],
    labelEn: "Sell from Quarantine",
    labelBn: "বিক্রয় রেকর্ড",
    description: "Emergency or salvage sale with strict drug withdrawal clearance.",
    requiresDrugWithdrawalClearance: true,
    financialLockCheck: true,
  },
  {
    from: "quarantined",
    to: "dead",
    allowedRoles: ["owner", "manager", "veterinarian"],
    labelEn: "Record Mortality",
    labelBn: "মৃত্যু রেকর্ড",
    description: "Log casualty during isolation.",
    requiresReason: true,
  },
  {
    from: "quarantined",
    to: "culled",
    allowedRoles: ["owner", "manager", "veterinarian"],
    labelEn: "Cull from Quarantine",
    labelBn: "বাতিল চিহ্নিত",
    description: "Cull animal failing isolation clearance.",
    requiresReason: true,
  },
  {
    from: "stolen",
    to: "active",
    allowedRoles: ["owner", "manager"],
    labelEn: "Recover Animal",
    labelBn: "পশু উদ্ধার",
    description: "Recover animal back to active status.",
  },
  {
    from: "culled",
    to: "sold",
    allowedRoles: ["owner", "manager"],
    labelEn: "Sell Culled Animal",
    labelBn: "বাতিল পশু বিক্রয়",
    description: "Commercial salvage sale of culled stock.",
    requiresDrugWithdrawalClearance: true,
  },
  {
    from: "culled",
    to: "dead",
    allowedRoles: ["owner", "manager", "veterinarian"],
    labelEn: "Record Mortality",
    labelBn: "মৃত্যু রেকর্ড",
    description: "Record death of culled animal.",
    requiresReason: true,
  },
  {
    from: "sold",
    to: "active",
    allowedRoles: ["owner", "manager"],
    labelEn: "Revert Sale (Undo)",
    labelBn: "বিক্রয় বাতিল (পূর্বাবস্থা)",
    description: "Revert sale transaction within audit grace period.",
    requiresConfirmation: true,
    requiresReason: true,
  },
  {
    from: "dead",
    to: "active",
    allowedRoles: ["owner", "manager"],
    labelEn: "Revert Mortality (Undo)",
    labelBn: "মৃত্যু বাতিল (পূর্বাবস্থা)",
    description: "Restore mistakenly recorded deceased animal.",
    requiresConfirmation: true,
    requiresReason: true,
  },
  {
    from: "sold",
    to: "archived",
    allowedRoles: ["owner"],
    labelEn: "Archive Sold Animal",
    labelBn: "আর্কাইভ করুন",
    description: "Lock historical profile.",
  },
  {
    from: "dead",
    to: "archived",
    allowedRoles: ["owner"],
    labelEn: "Archive Deceased Animal",
    labelBn: "আর্কাইভ করুন",
    description: "Lock historical profile.",
  },
];

export class LifecycleEngine {
  /**
   * Validates if a state transition is permitted under biological and ERP lifecycle rules.
   */
  public static validateTransition(
    currentStatus: CattleStatus,
    nextStatus: CattleStatus,
    userRole?: UserRole
  ): boolean {
    if (currentStatus === nextStatus) return true;

    const allowed = VALID_STATUS_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(nextStatus)) {
      throw new InvalidStatusTransitionError(currentStatus, nextStatus);
    }

    if (userRole) {
      const isAllowedRole = this.canRoleExecuteTransition(userRole, currentStatus, nextStatus);
      if (!isAllowedRole) {
        throw new UnauthorizedLifecycleTransitionError(userRole, nextStatus);
      }
    }

    return true;
  }

  /**
   * Evaluates if a given role has permissions to execute the transition.
   */
  public static canRoleExecuteTransition(
    role: UserRole,
    from: CattleStatus,
    to: CattleStatus
  ): boolean {
    if (from === to) return true;
    const rule = LIFECYCLE_TRANSITIONS_CONFIG.find(
      (r) => r.from === from && r.to === to
    );
    if (!rule) {
      const allowed = VALID_STATUS_TRANSITIONS[from];
      if (!allowed || !allowed.includes(to)) return false;
      return role === "owner" || role === "manager";
    }
    return rule.allowedRoles.includes(role);
  }

  /**
   * Gets list of permitted next states for an animal given current state and user role.
   */
  public static getAllowedNextStates(
    currentStatus: CattleStatus,
    userRole?: UserRole
  ): Array<{
    status: CattleStatus;
    labelEn: string;
    labelBn: string;
    description: string;
    requiresReason?: boolean;
    requiresConfirmation?: boolean;
    disabled?: boolean;
    disabledReason?: string;
  }> {
    const rules = LIFECYCLE_TRANSITIONS_CONFIG.filter((r) => r.from === currentStatus);
    return rules.map((r) => {
      const isAuthorized = !userRole || r.allowedRoles.includes(userRole);
      return {
        status: r.to as CattleStatus,
        labelEn: r.labelEn,
        labelBn: r.labelBn,
        description: r.description,
        requiresReason: r.requiresReason,
        requiresConfirmation: r.requiresConfirmation,
        disabled: !isAuthorized,
        disabledReason: !isAuthorized
          ? `Role '${userRole}' is not authorized to perform this transition`
          : undefined,
      };
    });
  }

  /**
   * Evaluates if animal is eligible for sale (not deceased, not under active drug withdrawal).
   */
  public static assertSaleEligibility(
    tagId: string,
    status: CattleStatus,
    withdrawalUntil?: string | null
  ): void {
    if (status === "sold" || status === "dead" || status === "stolen" || status === "archived") {
      throw new InvalidStatusTransitionError(status, "sold");
    }
    if (withdrawalUntil) {
      const today = todayDhaka();
      if (withdrawalUntil >= today) {
        throw new WithdrawalPeriodActiveError(tagId, withdrawalUntil);
      }
    }
  }

  /**
   * Evaluates if an animal meets minimum age and weight thresholds for breeding.
   */
  public static assertBreedingEligibility(
    tagId: string,
    gender: CattleGender,
    dob?: string | null,
    weightKg?: number | null
  ): void {
    if (dob) {
      const birthTime = new Date(dob).getTime();
      const now = Date.now();
      const ageInMonths = (now - birthTime) / (1000 * 60 * 60 * 24 * 30.4375);
      const minAgeMonths = gender === "female" ? 14 : 12;

      if (ageInMonths < minAgeMonths) {
        throw new BreedingAgeViolationError(tagId, ageInMonths, minAgeMonths);
      }
    }

    if (weightKg !== undefined && weightKg !== null && weightKg < 220) {
      throw new LifecycleBusinessRuleError(
        "BREEDING_WEIGHT_THRESHOLD",
        `Animal #${tagId} weight (${weightKg} kg) is below minimum breeding threshold (220 kg).`
      );
    }
  }

  /**
   * Validates date sanity constraints (e.g. no future dates, chronological sequence).
   */
  public static assertDateSanity(
    dob?: string | null,
    purchaseDate?: string | null,
    eventDate?: string | null
  ): void {
    const today = todayDhaka();

    if (dob && dob > today) {
      throw new LifecycleDateSanityError(`Date of birth (${dob}) cannot be in the future.`);
    }

    if (purchaseDate && purchaseDate > today) {
      throw new LifecycleDateSanityError(`Purchase date (${purchaseDate}) cannot be in the future.`);
    }

    if (eventDate && eventDate > today) {
      throw new LifecycleDateSanityError(`Event date (${eventDate}) cannot be in the future.`);
    }

    if (dob && purchaseDate && purchaseDate < dob) {
      throw new LifecycleDateSanityError(
        `Purchase date (${purchaseDate}) cannot precede date of birth (${dob}).`
      );
    }

    if (purchaseDate && eventDate && eventDate < purchaseDate) {
      throw new LifecycleDateSanityError(
        `Lifecycle event date (${eventDate}) cannot precede purchase date (${purchaseDate}).`
      );
    }
  }

  /**
   * Evaluates if an animal can be marked as deceased.
   */
  public static assertDeathEligibility(tagId: string, status: CattleStatus): void {
    if (status === "dead") {
      throw new LifecycleBusinessRuleError(
        "ALREADY_DECEASED",
        `Animal #${tagId} is already recorded as deceased.`
      );
    }
    if (status === "archived") {
      throw new LifecycleBusinessRuleError(
        "ARCHIVED_LOCKED",
        `Cannot record death for archived animal #${tagId}.`
      );
    }
  }

  /**
   * RBAC Matrix for Livestock domain operations.
   */
  public static getRolePermissions(role: UserRole): LivestockPermissionRules {
    switch (role) {
      case "owner":
        return {
          canCreateAnimal: true,
          canEditAnimal: true,
          canRecordWeight: true,
          canAdministerHealth: true,
          canManageBreeding: true,
          canRecordSale: true,
          canRecordDeath: true,
          canViewFinancials: true,
          canSoftDelete: true,
          canHardDelete: true,
          canManageFarmsAndPens: true,
          canChangeLifecycleStatus: true,
          canArchiveAnimal: true,
          canUnarchiveAnimal: true,
        };
      case "manager":
        return {
          canCreateAnimal: true,
          canEditAnimal: true,
          canRecordWeight: true,
          canAdministerHealth: true,
          canManageBreeding: true,
          canRecordSale: true,
          canRecordDeath: true,
          canViewFinancials: true,
          canSoftDelete: true,
          canHardDelete: false,
          canManageFarmsAndPens: true,
          canChangeLifecycleStatus: true,
          canArchiveAnimal: false,
          canUnarchiveAnimal: false,
        };
      case "veterinarian":
        return {
          canCreateAnimal: false,
          canEditAnimal: false,
          canRecordWeight: true,
          canAdministerHealth: true,
          canManageBreeding: true,
          canRecordSale: false,
          canRecordDeath: true,
          canViewFinancials: false,
          canSoftDelete: false,
          canHardDelete: false,
          canManageFarmsAndPens: false,
          canChangeLifecycleStatus: true,
          canArchiveAnimal: false,
          canUnarchiveAnimal: false,
        };
      case "staff":
      case "worker":
        return {
          canCreateAnimal: true,
          canEditAnimal: false,
          canRecordWeight: true,
          canAdministerHealth: false,
          canManageBreeding: false,
          canRecordSale: false,
          canRecordDeath: false,
          canViewFinancials: false,
          canSoftDelete: false,
          canHardDelete: false,
          canManageFarmsAndPens: false,
          canChangeLifecycleStatus: false,
          canArchiveAnimal: false,
          canUnarchiveAnimal: false,
        };
      case "viewer":
      default:
        return {
          canCreateAnimal: false,
          canEditAnimal: false,
          canRecordWeight: false,
          canAdministerHealth: false,
          canManageBreeding: false,
          canRecordSale: false,
          canRecordDeath: false,
          canViewFinancials: false,
          canSoftDelete: false,
          canHardDelete: false,
          canManageFarmsAndPens: false,
          canChangeLifecycleStatus: false,
          canArchiveAnimal: false,
          canUnarchiveAnimal: false,
        };
    }
  }
}