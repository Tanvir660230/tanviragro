import type { Business, UserRole, Profile, BusinessUser } from "./database";
import type { ExtendedUserRole, Permission } from "@/constants/roles";

export interface BusinessContext {
  businessId: string;
  business: Business;
  membership: BusinessUser | null;
  user: {
    id: string;
    email: string;
    profile: Profile | null;
  };
  role: ExtendedUserRole;
  permissions: readonly Permission[];
  locale: string;
  currency: string;
  timezone: string;
  isOwner: boolean;
  isAdmin: boolean;
  isManager: boolean;
  canManageFinance: boolean;
}

export interface TenantScope {
  businessId: string;
  userId: string;
}
