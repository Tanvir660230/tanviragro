"use client";

import { useEffect } from "react";
import { trackRecentCattle } from "@/components/shared/SearchBox";

export function TrackCattleView({ id, tagId }: { id: string; tagId: string }) {
  useEffect(() => {
    trackRecentCattle(id, tagId);
  }, [id, tagId]);
  return null;
}
