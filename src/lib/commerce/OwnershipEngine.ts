import type { OwnershipRecord, OwnershipTransferReason } from "./types";

export class OwnershipEngine {
  /**
   * Generates a deterministic digital verification hash for ownership passport
   */
  public static generateOwnershipHash(params: {
    cattleId: string;
    tagId?: string | null;
    previousOwner: string;
    newOwner: string;
    transferDate: string;
    price: number;
    witness?: string | null;
  }): string {
    const raw = `${params.cattleId}|${params.tagId || "N/A"}|${params.previousOwner.trim().toLowerCase()}|${params.newOwner.trim().toLowerCase()}|${params.transferDate}|${params.price}|${params.witness || "NONE"}`;
    
    // Simple fast 64-character deterministic pseudo-hash (compatible across edge/Node/browser)
    let hash1 = 5381;
    let hash2 = 52711;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash1 = (hash1 * 33) ^ char;
      hash2 = (hash2 * 33) ^ char;
    }
    const part1 = Math.abs(hash1).toString(16).padStart(8, "0");
    const part2 = Math.abs(hash2).toString(16).padStart(8, "0");
    const part3 = Array.from(raw)
      .reverse()
      .map((c) => c.charCodeAt(0).toString(16))
      .slice(0, 16)
      .join("")
      .padEnd(32, "a");

    return `OWN-${part1}${part2}${part3}`.slice(0, 40).toUpperCase();
  }

  /**
   * Verifies the integrity of the linear ownership timeline
   */
  public static verifyOwnershipChain(history: OwnershipRecord[]): {
    isValid: boolean;
    brokenLinkIndex?: number;
    error?: string;
  } {
    if (history.length <= 1) return { isValid: true };

    // Sort chronologically ascending
    const sorted = [...history].sort(
      (a, b) => new Date(a.transferDate).getTime() - new Date(b.transferDate).getTime()
    );

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      const prevNewOwner = prev.newOwnerName.trim().toLowerCase();
      const currPrevOwner = curr.previousOwnerName.trim().toLowerCase();

      if (prevNewOwner !== currPrevOwner && curr.transferReason !== "inheritance") {
        return {
          isValid: false,
          brokenLinkIndex: i,
          error: `Chain discontinuity: Entry ${i} previous owner "${curr.previousOwnerName}" does not match prior record recipient "${prev.newOwnerName}"`,
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Generates standard legal bill of sale & ownership transfer text
   */
  public static generateBillOfSaleText(record: {
    tagId?: string | null;
    cattleId: string;
    breed?: string;
    transferReason: OwnershipTransferReason;
    previousOwnerName: string;
    newOwnerName: string;
    transferDate: string;
    transferPrice: number;
    witnessName?: string | null;
  }): string {
    return `
======================================================================
               OFFICIAL LIVESTOCK OWNERSHIP CERTIFICATE
======================================================================
Document Ref: CERT-${record.cattleId.slice(0, 8).toUpperCase()}
Date of Transfer: ${record.transferDate}
Transfer Reason: ${record.transferReason.toUpperCase()}

ANIMAL IDENTIFICATION:
Tag Identifier: ${record.tagId || "N/A"}
Unique UUID: ${record.cattleId}
Breed: ${record.breed || "Standard"}

PARTIES INVOLVED:
Transferor (Previous Owner): ${record.previousOwnerName}
Transferee (New Legal Owner): ${record.newOwnerName}

COMMERCIAL CONSIDERATION:
Agreed Settlement Amount: BDT ৳${record.transferPrice.toLocaleString()}
Witness / Verified By: ${record.witnessName || "Enterprise Agro System"}

DECLARATION:
The Transferor hereby relinquishes all legal ownership and claims over the
livestock identified above to the Transferee upon successful settlement.
======================================================================
`.trim();
  }
}
