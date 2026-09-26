import { csvCell } from "@/lib/csv";

test("cells are quoted only when needed; # and Bangla pass through", () => {
  expect(csvCell("Cattle #C001")).toBe("Cattle #C001");
  expect(csvCell("খড় কাটা, ২ দিন")).toBe('"খড় কাটা, ২ দিন"');
  expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  expect(csvCell(1200.5)).toBe("1200.5");
  expect(csvCell(null)).toBe("");
});
