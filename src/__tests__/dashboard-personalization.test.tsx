/**
 * @jest-environment jsdom
 */
import React, { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  DashboardPersonalizationProvider,
  useDashboardPersonalization,
} from "@/components/dashboard/engine/PersonalizationContext";
import { ROLE_DEFAULT_WIDGETS } from "@/components/dashboard/engine/default-widgets";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Ctx = ReturnType<typeof useDashboardPersonalization>;
const STORAGE_KEY = "tanvir_agro_dashboard_personalization_v1_owner";

let latest: Ctx;
function Probe({ onValue }: { onValue: (v: Ctx) => void }) {
  const value = useDashboardPersonalization();
  useEffect(() => {
    onValue(value);
  });
  return null;
}

let container: HTMLDivElement;
let root: Root;

function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <DashboardPersonalizationProvider>
        <Probe onValue={(v) => (latest = v)} />
      </DashboardPersonalizationProvider>
    );
  });
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("DashboardPersonalizationProvider", () => {
  test("falls back to role defaults when nothing is saved", () => {
    mount();
    expect(latest.visibleWidgetIds).toEqual(ROLE_DEFAULT_WIDGETS.owner);
    expect(latest.pinnedWidgetIds).toEqual([]);
  });

  test("loads saved settings from localStorage", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ visibleWidgetIds: ["a"], pinnedWidgetIds: ["b"] }));
    mount();
    expect(latest.visibleWidgetIds).toEqual(["a"]);
    expect(latest.pinnedWidgetIds).toEqual(["b"]);
  });

  test("toggling visibility keeps existing pins and persists both lists", () => {
    mount();
    act(() => latest.togglePinWidget("pin-1"));
    act(() => latest.toggleWidgetVisibility("extra-widget"));

    expect(latest.pinnedWidgetIds).toEqual(["pin-1"]);
    expect(latest.visibleWidgetIds).toContain("extra-widget");

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(saved.pinnedWidgetIds).toEqual(["pin-1"]);
    expect(saved.visibleWidgetIds).toContain("extra-widget");
  });

  test("toggling a visible widget hides it", () => {
    mount();
    const first = ROLE_DEFAULT_WIDGETS.owner[0];
    act(() => latest.toggleWidgetVisibility(first));
    expect(latest.visibleWidgetIds).not.toContain(first);
  });

  test("resetToDefault restores role defaults and clears pins", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ visibleWidgetIds: ["a"], pinnedWidgetIds: ["b"] }));
    mount();
    act(() => latest.resetToDefault());
    expect(latest.visibleWidgetIds).toEqual(ROLE_DEFAULT_WIDGETS.owner);
    expect(latest.pinnedWidgetIds).toEqual([]);
  });

  test("ignores corrupt saved JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    mount();
    expect(latest.visibleWidgetIds).toEqual(ROLE_DEFAULT_WIDGETS.owner);
  });
});
