import { DLS_VACCINE_SCHEDULE } from "@/constants/health";
import type { HealthEvent } from "@/types/database";

export class HealthDomainService {
  /**
   * Identifies any health events that are overdue
   */
  public static getOverdueEvents(events: HealthEvent[]): HealthEvent[] {
    const today = new Date().toISOString().slice(0, 10);
    return events.filter(
      (ev) => !ev.completed_at && !ev.deleted_at && ev.scheduled_at < today
    );
  }

  /**
   * Retrieves official DLS vaccination protocol references
   */
  public static getDlsVaccineProtocol() {
    return DLS_VACCINE_SCHEDULE;
  }
}
