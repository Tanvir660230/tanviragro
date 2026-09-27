/**
 * What a cattle status means, in one place.
 *
 * Quarantine is a flag (is_quarantined) on an animal still on the farm. Old rows could carry
 * status "quarantined" (the 20260928090000 migration converts them and a trigger stops new
 * ones); until then such an animal still counts as on the farm, never as gone.
 */
export const isOnFarm = (status: string | null | undefined) => status === "active" || status === "quarantined";

/** left the farm: sold, dead, stolen, culled or archived */
export const hasLeft = (status: string | null | undefined) => !isOnFarm(status);

/** left without a sale — its whole cost is a loss, booked on the day it died / went missing */
export const isLossStatus = (status: string | null | undefined) => status === "dead" || status === "stolen";
