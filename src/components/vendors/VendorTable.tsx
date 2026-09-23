"use client";

import type { Dictionary } from "@/i18n/getDictionary";
import { VendorTableRow } from "./VendorTableRow";
import type { EnrichedVendor } from "./vendor-types";

export function VendorTable({
  vendors,
  t,
}: {
  vendors: EnrichedVendor[];
  t: Dictionary;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40 font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Vendor Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3 text-right">Cattle</th>
              <th className="px-4 py-3 text-right">Items</th>
              <th className="px-4 py-3 text-right">Total Sourcing</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {vendors.map((v) => (
              <VendorTableRow key={v.id} vendor={v} t={t} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
