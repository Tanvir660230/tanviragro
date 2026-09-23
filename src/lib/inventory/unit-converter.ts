import { UnitConversionError } from "./errors";
import type { UnitConversionRule } from "./types";

/**
 * Enterprise Multi-Unit Conversion Engine
 * Handles agricultural unit standards in Bangladesh & international metrics.
 */
export class UnitConverter {
  private static readonly STANDARD_CONVERSIONS: Record<string, Record<string, number>> = {
    // Mass
    kg: {
      kg: 1,
      gm: 1000,
      gram: 1000,
      mon: 0.025, // 1 mon (maund) = 40 kg -> 1 kg = 1/40 mon = 0.025 mon
      maund: 0.025,
      ton: 0.001,
      tonne: 0.001,
    },
    gm: {
      gm: 1,
      gram: 1,
      kg: 0.001,
      mon: 0.000025,
    },
    mon: {
      mon: 1,
      maund: 1,
      kg: 40,
      gm: 40000,
      ton: 0.04,
    },
    ton: {
      ton: 1,
      tonne: 1,
      kg: 1000,
      gm: 1000000,
      mon: 25,
    },
    // Volume
    ltr: {
      ltr: 1,
      liter: 1,
      litre: 1,
      ml: 1000,
    },
    ml: {
      ml: 1,
      ltr: 0.001,
      liter: 0.001,
    },
    // Discrete
    piece: { piece: 1, pcs: 1, nos: 1 },
    pcs: { piece: 1, pcs: 1, nos: 1 },
    vial: { vial: 1, dose: 1 },
    packet: { packet: 1, pkt: 1 },
    bag: { bag: 1 },
  };

  /**
   * Normalizes unit strings (e.g., "Kg", " KG ", "kilogram" -> "kg")
   */
  public static normalizeUnit(unit: string): string {
    const clean = (unit || "").trim().toLowerCase();
    if (clean === "kilogram" || clean === "kgs" || clean === "কেজি") return "kg";
    if (clean === "gram" || clean === "grams" || clean === "গ্রাম") return "gm";
    if (clean === "maund" || clean === "মণ" || clean === "মন") return "mon";
    if (clean === "tonne" || clean === "টন") return "ton";
    if (clean === "liter" || clean === "litre" || clean === "লিটার") return "ltr";
    if (clean === "milliliter" || clean === "মিলি") return "ml";
    if (clean === "pieces" || clean === "টি" || clean === "পিস") return "pcs";
    if (clean === "বস্তা" || clean === "ব্যাগ") return "bag";
    return clean;
  }

  /**
   * Converts a numeric quantity between two compatible units.
   * @param quantity The numeric quantity to convert
   * @param fromUnit Starting unit
   * @param toUnit Target unit
   * @param customBagWeightKg Optional bag weight in KG when converting to/from bags
   */
  public static convert(
    quantity: number,
    fromUnit: string,
    toUnit: string,
    customBagWeightKg?: number
  ): number {
    if (!Number.isFinite(quantity)) {
      throw new UnitConversionError(fromUnit, toUnit, "Quantity must be a finite number");
    }

    const normFrom = this.normalizeUnit(fromUnit);
    const normTo = this.normalizeUnit(toUnit);

    if (normFrom === normTo) return quantity;

    // Bag conversions with variable bag weight (e.g. 25kg or 50kg feed bag)
    if (normFrom === "bag" && normTo === "kg") {
      const bagKg = customBagWeightKg && customBagWeightKg > 0 ? customBagWeightKg : 50; // default 50kg bag
      return quantity * bagKg;
    }
    if (normFrom === "kg" && normTo === "bag") {
      const bagKg = customBagWeightKg && customBagWeightKg > 0 ? customBagWeightKg : 50;
      return quantity / bagKg;
    }

    const fromTable = this.STANDARD_CONVERSIONS[normFrom];
    if (fromTable && fromTable[normTo] !== undefined) {
      const factor = fromTable[normTo];
      return parseFloat((quantity * factor).toFixed(6));
    }

    // Attempt indirect conversion via Base KG if both are mass units
    if (this.isMassUnit(normFrom) && this.isMassUnit(normTo)) {
      const inKg = this.convert(quantity, normFrom, "kg");
      return this.convert(inKg, "kg", normTo);
    }

    // Attempt indirect conversion via Base LTR if both are volume units
    if (this.isVolumeUnit(normFrom) && this.isVolumeUnit(normTo)) {
      const inLtr = this.convert(quantity, normFrom, "ltr");
      return this.convert(inLtr, "ltr", normTo);
    }

    throw new UnitConversionError(
      fromUnit,
      toUnit,
      `Incompatible unit dimensions (${fromUnit} -> ${toUnit})`
    );
  }

  private static isMassUnit(unit: string): boolean {
    return ["kg", "gm", "mon", "ton"].includes(unit);
  }

  private static isVolumeUnit(unit: string): boolean {
    return ["ltr", "ml"].includes(unit);
  }
}