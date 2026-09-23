/**
 * @jest-environment jsdom
 */
import React, { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useUndoStack } from "@/hooks/use-undo-stack";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Stack = ReturnType<typeof useUndoStack<string>>;
let latest: Stack;
function Probe({ onValue }: { onValue: (v: Stack) => void }) {
  const value = useUndoStack<string>();
  useEffect(() => {
    onValue(value);
  });
  return null;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Probe onValue={(v) => (latest = v)} />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const entry = (label: string) => ({ label, affectedCount: 1, affectedIds: [label], snapshot: label });

describe("useUndoStack", () => {
  test("canRedo becomes true after undo and false after redo", () => {
    act(() => latest.push(entry("a")));
    expect(latest.canUndo).toBe(true);
    expect(latest.canRedo).toBe(false);

    act(() => {
      latest.undo();
    });
    expect(latest.canRedo).toBe(true);

    let redone: ReturnType<Stack["redo"]> = null;
    act(() => {
      redone = latest.redo();
    });
    expect(redone).toMatchObject({ label: "a" });
    expect(latest.canRedo).toBe(false);
  });

  test("pushing a new entry clears the redo stack", () => {
    act(() => latest.push(entry("a")));
    act(() => {
      latest.undo();
    });
    expect(latest.canRedo).toBe(true);
    act(() => latest.push(entry("b")));
    expect(latest.canRedo).toBe(false);
  });

  test("clear resets everything", () => {
    act(() => latest.push(entry("a")));
    act(() => {
      latest.undo();
    });
    act(() => latest.clear());
    expect(latest.canUndo).toBe(false);
    expect(latest.canRedo).toBe(false);
    expect(latest.depth).toBe(0);
  });
});
