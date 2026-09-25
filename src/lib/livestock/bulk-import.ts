import { todayDhaka } from "@/lib/dates";
/**
 * Enterprise Livestock Bulk Import Engine
 */

export interface RawLivestockRow {
  tagId?: string;
  breed?: string;
  gender?: string;
  dob?: string;
  purchaseDate?: string;
  purchasePrice?: number | string;
  initialWeightKg?: number | string;
  targetWeightKg?: number | string;
  expectedDailyGainKg?: number | string;
  penId?: string;
  penName?: string;
  notes?: string;
  transportCost?: number | string;
  haatHasil?: number | string;
}

export interface ValidatedLivestockRow {
  rowIndex: number;
  tagId: string;
  breed: string;
  gender: "bull" | "cow" | "heifer" | "calf";
  dob: string | null;
  purchaseDate: string;
  purchasePrice: number;
  initialWeightKg: number;
  targetWeightKg: number | null;
  expectedDailyGainKg: number | null;
  penId: string | null;
  notes: string | null;
  transportCost: number;
  haatHasil: number;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface BatchImportSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateTagsCount: number;
  totalEstimatedAcquisitionCost: number;
  totalInitialWeightKg: number;
}

export interface ParseOptions {
  delimiter?: string;
  defaultGender?: "bull" | "cow" | "heifer" | "calf";
  defaultPurchaseDate?: string;
  defaultBreed?: string;
}

const COLUMN_SYNONYMS: Record<string, keyof RawLivestockRow> = {
  tag: "tagId",
  tagid: "tagId",
  tag_id: "tagId",
  ear_tag: "tagId",
  eartag: "tagId",
  id: "tagId",
  code: "tagId",
  "গরুর নম্বর": "tagId",
  "ট্যাগ": "tagId",
  breed: "breed",
  cattle_breed: "breed",
  জাত: "breed",
  gender: "gender",
  sex: "gender",
  type: "gender",
  লিঙ্গ: "gender",
  dob: "dob",
  birth_date: "dob",
  birthdate: "dob",
  জন্ম_তারিখ: "dob",
  purchase_date: "purchaseDate",
  purchasedate: "purchaseDate",
  date: "purchaseDate",
  ক্রয়_তারিখ: "purchaseDate",
  purchase_price: "purchasePrice",
  purchaseprice: "purchasePrice",
  price: "purchasePrice",
  cost: "purchasePrice",
  rate: "purchasePrice",
  দাম: "purchasePrice",
  ক্রয়_মূল্য: "purchasePrice",
  weight: "initialWeightKg",
  initial_weight: "initialWeightKg",
  weight_kg: "initialWeightKg",
  live_weight: "initialWeightKg",
  initial_weight_kg: "initialWeightKg",
  ওজন: "initialWeightKg",
  target_weight: "targetWeightKg",
  target_weight_kg: "targetWeightKg",
  adg: "expectedDailyGainKg",
  expected_adg: "expectedDailyGainKg",
  daily_gain: "expectedDailyGainKg",
  pen: "penName",
  pen_id: "penId",
  shed: "penName",
  notes: "notes",
  note: "notes",
  transport_cost: "transportCost",
  freight: "transportCost",
  haat_hasil: "haatHasil",
  hasil: "haatHasil",
};

export function parseLivestockCsv(
  csvText: string,
  options?: ParseOptions
): { rows: RawLivestockRow[]; headers: string[]; rawRowCount: number } {
  if (!csvText || !csvText.trim()) return { rows: [], headers: [], rawRowCount: 0 };
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return { rows: [], headers: [], rawRowCount: 0 };

  let delimiter = options?.delimiter;
  if (!delimiter) {
    const commas = (lines[0].match(/,/g) || []).length;
    const tabs = (lines[0].match(/\t/g) || []).length;
    const semicolons = (lines[0].match(/;/g) || []).length;
    delimiter = tabs > commas && tabs > semicolons ? "\t" : semicolons > commas && semicolons > tabs ? ";" : ",";
  }

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (char === delimiter && !inQuotes) {
        result.push(cur.trim()); cur = "";
      } else { cur += char; }
    }
    result.push(cur.trim());
    return result;
  };

  const rawHeaders = parseLine(lines[0]);
  const headerMapping = rawHeaders.map((h) => {
    const cleanKey = h.toLowerCase().replace(/[\s\-_#]+/g, "_").trim();
    return COLUMN_SYNONYMS[cleanKey] || COLUMN_SYNONYMS[h.toLowerCase().trim()] || null;
  });

  const parsedRows: RawLivestockRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.every((v) => !v)) continue;
    const rowObj: RawLivestockRow = {};
    values.forEach((val, colIdx) => {
      const mappedKey = headerMapping[colIdx];
      if (mappedKey) (rowObj as Record<string, unknown>)[mappedKey] = val;
    });
    parsedRows.push(rowObj);
  }

  return { rows: parsedRows, headers: rawHeaders, rawRowCount: lines.length - 1 };
}

export function validateLivestockRow(
  raw: RawLivestockRow,
  index: number,
  existingTagIds: string[],
  seenTagsInBatch: Set<string>,
  defaultOptions?: ParseOptions
): ValidatedLivestockRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  const tagId = (raw.tagId || "").trim().toUpperCase();
  if (!tagId) {
    errors.push("Tag ID is required");
  } else {
    if (existingTagIds.some((t) => t.toLowerCase() === tagId.toLowerCase())) {
      errors.push(`Tag ID '${tagId}' already exists in database`);
    }
    if (seenTagsInBatch.has(tagId.toLowerCase())) {
      errors.push(`Tag ID '${tagId}' is duplicated in this file`);
    }
  }

  const rawGender = (raw.gender || defaultOptions?.defaultGender || "bull").toLowerCase().trim();
  let gender: "bull" | "cow" | "heifer" | "calf" = "bull";
  if (["bull", "ox", "steer", "ষাঁড়", "বলদ"].includes(rawGender)) {
    gender = "bull";
  } else if (["cow", "গাভী"].includes(rawGender)) {
    gender = "cow";
  } else if (["heifer", "বকনা", "দামড়া"].includes(rawGender)) {
    gender = "heifer";
  } else if (["calf", "বাছুর"].includes(rawGender)) {
    gender = "calf";
  } else if (rawGender) {
    warnings.push(`Unrecognized gender '${raw.gender}', defaulted to Bull`);
  }

  const breed = (raw.breed || defaultOptions?.defaultBreed || "Local").trim();
  const today = todayDhaka();
  let purchaseDate = (raw.purchaseDate || defaultOptions?.defaultPurchaseDate || today).trim();
  if (purchaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
    const match = purchaseDate.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (match) {
      purchaseDate = `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    } else {
      errors.push(`Invalid purchase date format '${raw.purchaseDate}'`);
    }
  }

  let dob: string | null = (raw.dob || "").trim() || null;
  if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    const match = dob.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (match) {
      dob = `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    } else {
      dob = null;
    }
  }

  const cleanPrice = String(raw.purchasePrice ?? "").replace(/[^\d.]/g, "");
  const purchasePrice = parseFloat(cleanPrice) || 0;
  if (purchasePrice < 0) errors.push("Purchase price cannot be negative");

  const cleanWeight = String(raw.initialWeightKg ?? "").replace(/[^\d.]/g, "");
  const initialWeightKg = parseFloat(cleanWeight) || 0;
  if (initialWeightKg <= 0) {
    errors.push("Initial live weight must be greater than 0 kg");
  }

  const targetWeightKg = raw.targetWeightKg ? parseFloat(String(raw.targetWeightKg)) || null : null;
  const expectedDailyGainKg = raw.expectedDailyGainKg ? parseFloat(String(raw.expectedDailyGainKg)) || null : null;
  const transportCost = parseFloat(String(raw.transportCost ?? "").replace(/[^\d.]/g, "")) || 0;
  const haatHasil = parseFloat(String(raw.haatHasil ?? "").replace(/[^\d.]/g, "")) || 0;

  return {
    rowIndex: index + 1,
    tagId,
    breed,
    gender,
    dob,
    purchaseDate,
    purchasePrice,
    initialWeightKg,
    targetWeightKg,
    expectedDailyGainKg,
    penId: raw.penId || null,
    notes: raw.notes ? String(raw.notes).trim() : null,
    transportCost,
    haatHasil,
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateBatchImport(
  rawRows: RawLivestockRow[],
  existingTagIds: string[],
  defaultOptions?: ParseOptions
): { validatedRows: ValidatedLivestockRow[]; summary: BatchImportSummary } {
  const seenTagsInBatch = new Set<string>();
  const validatedRows: ValidatedLivestockRow[] = [];
  let totalAcquisitionCost = 0;
  let totalWeight = 0;
  let duplicateTagsCount = 0;

  rawRows.forEach((raw, idx) => {
    const validated = validateLivestockRow(raw, idx, existingTagIds, seenTagsInBatch, defaultOptions);
    if (validated.tagId) {
      if (seenTagsInBatch.has(validated.tagId.toLowerCase())) duplicateTagsCount++;
      else seenTagsInBatch.add(validated.tagId.toLowerCase());
    }
    if (validated.isValid) {
      totalAcquisitionCost += validated.purchasePrice + validated.transportCost + validated.haatHasil;
      totalWeight += validated.initialWeightKg;
    }
    validatedRows.push(validated);
  });

  const validRows = validatedRows.filter((r) => r.isValid).length;
  return {
    validatedRows,
    summary: {
      totalRows: rawRows.length,
      validRows,
      invalidRows: rawRows.length - validRows,
      duplicateTagsCount,
      totalEstimatedAcquisitionCost: totalAcquisitionCost,
      totalInitialWeightKg: totalWeight,
    },
  };
}

export function generateSequentialTags(
  prefix: string,
  count: number,
  startNumber: number = 1,
  padLength: number = 3
): string[] {
  const tags: string[] = [];
  for (let i = 0; i < count; i++) {
    tags.push(`${prefix}${String(startNumber + i).padStart(padLength, "0")}`);
  }
  return tags;
}

export function getBulkLivestockCsvTemplate(): string {
  const headers = [
    "Tag_ID", "Breed", "Gender", "Purchase_Date",
    "Initial_Weight_KG", "Purchase_Price", "Transport_Cost", "Haat_Hasil",
    "DOB", "Target_Weight_KG", "ADG_KG", "Notes"
  ];
  const sampleRows = [
    ["TAG-201", "Shahiwal Cross", "bull", "2026-09-01", "280", "115000", "2500", "500", "2024-03-15", "450", "0.85", "Healthy fattening prospect"],
    ["TAG-202", "Sindhi", "bull", "2026-09-01", "310", "130000", "2500", "500", "2024-01-20", "500", "0.90", "Qurbani premium target"],
    ["TAG-203", "Holstein Friesian", "heifer", "2026-09-02", "220", "95000", "2000", "400", "2024-05-10", "380", "0.70", "Dairy breeding line"],
    ["TAG-204", "Brahman Cross", "bull", "2026-09-02", "340", "145000", "2500", "500", "2023-11-05", "550", "1.05", "High-growth feedlot bull"]
  ];
  return [headers.join(","), ...sampleRows.map((r) => r.join(","))].join("\n");
}
