import {
  parseLivestockCsv,
  validateLivestockRow,
  validateBatchImport,
  generateSequentialTags,
  getBulkLivestockCsvTemplate,
  type RawLivestockRow,
} from "@/lib/livestock/bulk-import";

describe("Bulk Livestock Import Engine", () => {
  describe("CSV Parsing and Column Mapping", () => {
    it("parses standard CSV with header normalization", () => {
      const csv = `Tag_ID,Breed,Gender,Purchase_Date,Initial_Weight_KG,Purchase_Price,Transport_Cost,Haat_Hasil,Notes
TAG-101,Shahiwal,bull,2026-09-01,320,120000,2000,500,Good prospect
TAG-102,Sindhi,cow,2026-09-02,280,95000,1500,400,Dairy cow`;

      const { rows, headers } = parseLivestockCsv(csv);
      expect(headers).toHaveLength(9);
      expect(rows).toHaveLength(2);
      expect(rows[0].tagId).toBe("TAG-101");
      expect(rows[0].breed).toBe("Shahiwal");
      expect(rows[0].gender).toBe("bull");
      expect(rows[0].initialWeightKg).toBe("320");
      expect(rows[0].purchasePrice).toBe("120000");
      expect(rows[0].transportCost).toBe("2000");
      expect(rows[0].haatHasil).toBe("500");
      expect(rows[0].notes).toBe("Good prospect");
    });

    it("handles tab-delimited text and Bengali synonym headers", () => {
      const tsv = `ট্যাগ\tজাত\tলিঙ্গ\tওজন\tক্রয়_মূল্য
TAG-301\tLocal\tষাঁড়\t250\t80000`;

      const { rows } = parseLivestockCsv(tsv);
      expect(rows).toHaveLength(1);
      expect(rows[0].tagId).toBe("TAG-301");
      expect(rows[0].breed).toBe("Local");
      expect(rows[0].gender).toBe("ষাঁড়");
      expect(rows[0].initialWeightKg).toBe("250");
      expect(rows[0].purchasePrice).toBe("80000");
    });

    it("handles empty or whitespace-only csv input safely", () => {
      expect(parseLivestockCsv("").rows).toEqual([]);
      expect(parseLivestockCsv("   \n  \n").rows).toEqual([]);
    });
  });

  describe("Row Validation", () => {
    it("validates a clean, complete row correctly", () => {
      const raw: RawLivestockRow = {
        tagId: "TAG-001",
        breed: "Brahman",
        gender: "bull",
        purchaseDate: "2026-09-01",
        purchasePrice: 120000,
        initialWeightKg: 350,
        transportCost: 2000,
        haatHasil: 500,
      };

      const result = validateLivestockRow(raw, 0, [], new Set());
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.tagId).toBe("TAG-001");
      expect(result.gender).toBe("bull");
      expect(result.purchasePrice).toBe(120000);
      expect(result.initialWeightKg).toBe(350);
    });

    it("flags missing tag and invalid weight", () => {
      const raw: RawLivestockRow = {
        tagId: "",
        initialWeightKg: 0,
      };

      const result = validateLivestockRow(raw, 0, [], new Set());
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Tag ID is required");
      expect(result.errors).toContain("Initial live weight must be greater than 0 kg");
    });

    it("flags database duplicate tags and batch internal duplicates", () => {
      const raw1: RawLivestockRow = { tagId: "TAG-EXISTING", initialWeightKg: 200 };
      const res1 = validateLivestockRow(raw1, 0, ["tag-existing"], new Set());
      expect(res1.isValid).toBe(false);
      expect(res1.errors.some((e) => e.includes("already exists in database"))).toBe(true);

      const seen = new Set(["tag-dup"]);
      const raw2: RawLivestockRow = { tagId: "TAG-DUP", initialWeightKg: 200 };
      const res2 = validateLivestockRow(raw2, 1, [], seen);
      expect(res2.isValid).toBe(false);
      expect(res2.errors.some((e) => e.includes("duplicated in this file"))).toBe(true);
    });

    it("normalizes diverse date formats (DD/MM/YYYY to YYYY-MM-DD)", () => {
      const raw: RawLivestockRow = {
        tagId: "TAG-002",
        purchaseDate: "15/08/2026",
        dob: "01/01/2024",
        initialWeightKg: 250,
      };

      const res = validateLivestockRow(raw, 0, [], new Set());
      expect(res.purchaseDate).toBe("2026-08-15");
      expect(res.dob).toBe("2024-01-01");
    });
  });

  describe("Batch Validation and Metrics", () => {
    it("computes batch acquisition costs and live weight totals", () => {
      const rawRows: RawLivestockRow[] = [
        { tagId: "T1", purchasePrice: 100000, initialWeightKg: 250, transportCost: 2000, haatHasil: 500 },
        { tagId: "T2", purchasePrice: 120000, initialWeightKg: 300, transportCost: 2000, haatHasil: 500 },
        { tagId: "", initialWeightKg: 0 }, // invalid row
      ];

      const { validatedRows, summary } = validateBatchImport(rawRows, []);
      expect(summary.totalRows).toBe(3);
      expect(summary.validRows).toBe(2);
      expect(summary.invalidRows).toBe(1);
      expect(summary.totalInitialWeightKg).toBe(550);
      expect(summary.totalEstimatedAcquisitionCost).toBe(100000 + 2000 + 500 + 120000 + 2000 + 500);
      expect(validatedRows).toHaveLength(3);
    });
  });

  describe("Sequential Tag Generation", () => {
    it("generates correctly padded sequential tags", () => {
      const tags = generateSequentialTags("BATCH-", 4, 1, 3);
      expect(tags).toEqual(["BATCH-001", "BATCH-002", "BATCH-003", "BATCH-004"]);
    });

    it("respects startNumber parameter", () => {
      const tags = generateSequentialTags("COW-", 3, 50, 4);
      expect(tags).toEqual(["COW-0050", "COW-0051", "COW-0052"]);
    });
  });

  describe("Template Generation", () => {
    it("returns valid CSV template string with headers and sample rows", () => {
      const template = getBulkLivestockCsvTemplate();
      expect(template).toContain("Tag_ID,Breed,Gender,Purchase_Date");
      expect(template).toContain("TAG-201");
      expect(template).toContain("TAG-204");
    });
  });
});
