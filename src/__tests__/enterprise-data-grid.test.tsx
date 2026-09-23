import { describe, it, expect } from "@jest/globals";
import {
  EnterpriseDataGrid,
  DataGridToolbar,
  DataGridHeader,
  DataGridBody,
  DataGridRow,
  DataGridCardView,
  DataGridPagination,
  DataGridExportModal,
  DataGridColumnCustomizer,
  DataGridAdvancedFilters,
  DataGridSavedViews,
} from "../components/data-grid";
import { UniversalDataTable } from "../components/shared/UniversalDataTable";

describe("Enterprise Data Grid Framework", () => {
  it("exports all core Data Grid components and subcomponents", () => {
    expect(EnterpriseDataGrid).toBeDefined();
    expect(typeof EnterpriseDataGrid).toBe("function");

    expect(DataGridToolbar).toBeDefined();
    expect(typeof DataGridToolbar).toBe("function");

    expect(DataGridHeader).toBeDefined();
    expect(typeof DataGridHeader).toBe("function");

    expect(DataGridBody).toBeDefined();
    expect(typeof DataGridBody).toBe("function");

    expect(DataGridRow).toBeDefined();
    expect(DataGridRow).toBeTruthy();

    expect(DataGridCardView).toBeDefined();
    expect(typeof DataGridCardView).toBe("function");

    expect(DataGridPagination).toBeDefined();
    expect(typeof DataGridPagination).toBe("function");

    expect(DataGridExportModal).toBeDefined();
    expect(typeof DataGridExportModal).toBe("function");

    expect(DataGridColumnCustomizer).toBeDefined();
    expect(typeof DataGridColumnCustomizer).toBe("function");

    expect(DataGridAdvancedFilters).toBeDefined();
    expect(typeof DataGridAdvancedFilters).toBe("function");

    expect(DataGridSavedViews).toBeDefined();
    expect(typeof DataGridSavedViews).toBe("function");
  });

  it("exports backward-compatible UniversalDataTable adapter", () => {
    expect(UniversalDataTable).toBeDefined();
    expect(typeof UniversalDataTable).toBe("function");
  });
});


