import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EnterprisePage,
  EnterprisePageTemplate,
  EnterprisePageHeader,
  PageHeader,
  ActionBar,
  FilterBar,
  PageSection,
  StickyFooterAction,
  ResponsivePageContainer,
  PageContainer,
  PageContent,
  PageFooter,
} from "@/components/layout";
import { Plus, Trash2, Layers } from "lucide-react";

jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/cattle",
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), refresh: jest.fn() }),
}));

describe("Universal Enterprise Page Template Suite (Sprint 04)", () => {
  test("renders EnterprisePage and EnterprisePageTemplate with complete layout hierarchy", () => {
    const markup = renderToStaticMarkup(
      <EnterprisePage
        title="Herd Management"
        subtitle="Manage cattle inventory"
        summary={<div id="kpi-summary">Active: 120</div>}
        filters={<div id="filters">Status: All</div>}
        stickyFooter={{ isDirty: true, primaryLabel: "Save Cattle", onPrimaryClick: () => {} }}
      >
        <div id="content-table">Cattle Records</div>
      </EnterprisePage>
    );

    expect(markup).toContain("Herd Management");
    expect(markup).toContain("Manage cattle inventory");
    expect(markup).toContain("id=\"kpi-summary\"");
    expect(markup).toContain("id=\"filters\"");
    expect(markup).toContain("id=\"content-table\"");
    expect(markup).toContain("Unsaved changes detected");
    expect(markup).toContain("Save Cattle");
  });

  test("EnterprisePageHeader renders title, badge, icon, and utility buttons", () => {
    const markup = renderToStaticMarkup(
      <EnterprisePageHeader
        title="Financial Ledger"
        subtitle="Trial balance entries"
        badge="Reconciled"
        badgeVariant="success"
        icon={Layers}
        isFavorite={true}
        onShare={() => {}}
        onPrint={() => {}}
        onExport={() => {}}
      />
    );

    expect(markup).toContain("Financial Ledger");
    expect(markup).toContain("Reconciled");
    expect(markup).toContain("Share link");
    expect(markup).toContain("Print page");
    expect(markup).toContain("Export data");
  });

  test("ActionBar renders primary, secondary, and bulk selection states", () => {
    const normalMarkup = renderToStaticMarkup(
      <ActionBar
        primaryAction={{ id: "add", label: "Add Cattle", icon: Plus, shortcut: "N" }}
        secondaryActions={[{ id: "export", label: "Export CSV" }]}
      />
    );
    expect(normalMarkup).toContain("Add Cattle");
    expect(normalMarkup).toContain("Export CSV");
    expect(normalMarkup).toContain("N");

    const bulkMarkup = renderToStaticMarkup(
      <ActionBar
        selectedCount={4}
        selectedIds={["id-1", "id-2"]}
        bulkActions={[{ id: "del", label: "Delete Selected", icon: Trash2, variant: "destructive", onClick: () => {} }]}
      />
    );
    expect(bulkMarkup).toContain("4 selected");
    expect(bulkMarkup).toContain("Delete Selected");
  });

  test("FilterBar renders search input, chips, and reset trigger", () => {
    const markup = renderToStaticMarkup(
      <FilterBar
        searchValue="Holstein"
        onSearchChange={() => {}}
        searchPlaceholder="Filter cattle..."
        activeFilterCount={2}
        onClearFilters={() => {}}
        chips={[{ id: "b", label: "Breed: Holstein", onRemove: () => {} }]}
        showAdvancedToggle={true}
        onToggleAdvanced={() => {}}
      />
    );
    expect(markup).toContain("value=\"Holstein\"");
    expect(markup).toContain("Filter cattle...");
    expect(markup).toContain("Breed: Holstein");
    expect(markup).toContain("Reset");
  });

  test("PageSection renders section headers, badges, and variants", () => {
    const markup = renderToStaticMarkup(
      <PageSection title="Vaccination" badge="3 Pending" variant="card" collapsible={true}>
        <p>Protocol Details</p>
      </PageSection>
    );
    expect(markup).toContain("Vaccination");
    expect(markup).toContain("3 Pending");
    expect(markup).toContain("Protocol Details");
  });

  test("StickyFooterAction renders unsaved state and buttons", () => {
    const markup = renderToStaticMarkup(
      <StickyFooterAction
        isDirty={true}
        primaryLabel="Commit Changes"
        secondaryLabel="Preview"
        onPrimaryClick={() => {}}
        onSecondaryClick={() => {}}
        onDiscardClick={() => {}}
      />
    );
    expect(markup).toContain("Unsaved changes detected");
    expect(markup).toContain("Commit Changes");
    expect(markup).toContain("Preview");
    expect(markup).toContain("Discard");
  });

  test("exports all required layout primitives", () => {
    expect(typeof EnterprisePage).toBe("function");
    expect(typeof EnterprisePageTemplate).toBe("function");
    expect(typeof EnterprisePageHeader).toBe("function");
    expect(typeof PageHeader).toBe("function");
    expect(typeof ActionBar).toBe("function");
    expect(typeof FilterBar).toBe("function");
    expect(typeof PageSection).toBe("function");
    expect(typeof StickyFooterAction).toBe("function");
    expect(typeof ResponsivePageContainer).toBe("function");
    expect(typeof PageContainer).toBe("function");
    expect(typeof PageContent).toBe("function");
    expect(typeof PageFooter).toBe("function");

    const wideMarkup = renderToStaticMarkup(
      <ResponsivePageContainer maxWidth="wide">
        <div>Content</div>
      </ResponsivePageContainer>
    );
    expect(wideMarkup).toContain("max-w-[1600px]");
  });
});


