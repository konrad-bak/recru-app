import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useUndo } from "./useUndo";

describe("useUndo", () => {
  it("should initialize with the correct initial state", () => {
    const initialState = "initial value";
    const { result } = renderHook(() => useUndo(initialState));

    expect(result.current.state).toBe(initialState);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("should update state and enable undo when set is called with a new value", () => {
    const { result } = renderHook(() => useUndo("initial"));

    act(() => {
      result.current.set("updated");
    });

    expect(result.current.state).toBe("updated");
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("should not update history if set is called with the same value", () => {
    const { result } = renderHook(() => useUndo("initial"));

    act(() => {
      result.current.set("initial"); // Same value
    });

    expect(result.current.state).toBe("initial");
    expect(result.current.canUndo).toBe(false); // History should not grow
    expect(result.current.canRedo).toBe(false);
  });

  it("should undo the last change", () => {
    const { result } = renderHook(() => useUndo("initial"));

    act(() => {
      result.current.set("updated 1");
    });
    act(() => {
      result.current.set("updated 2");
    });

    expect(result.current.state).toBe("updated 2");
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    act(() => {
      result.current.undo();
    });

    expect(result.current.state).toBe("updated 1");
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.undo();
    });

    expect(result.current.state).toBe("initial");
    expect(result.current.canUndo).toBe(false); // Back to initial
    expect(result.current.canRedo).toBe(true);
  });

  it("should do nothing if undo is called with no past history", () => {
    const { result } = renderHook(() => useUndo("initial"));

    act(() => {
      result.current.undo(); // Try to undo
    });

    expect(result.current.state).toBe("initial");
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("should redo the last undone change", () => {
    const { result } = renderHook(() => useUndo("initial"));

    act(() => result.current.set("updated 1"));
    act(() => result.current.set("updated 2"));
    act(() => result.current.undo()); // Back to 'updated 1'
    act(() => result.current.undo()); // Back to 'initial'

    expect(result.current.state).toBe("initial");
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.redo();
    });

    expect(result.current.state).toBe("updated 1");
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.redo();
    });

    expect(result.current.state).toBe("updated 2");
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false); // End of future history
  });

  it("should do nothing if redo is called with no future history", () => {
    const { result } = renderHook(() => useUndo("initial"));
    act(() => result.current.set("updated"));

    act(() => {
      result.current.redo(); // Try to redo
    });

    expect(result.current.state).toBe("updated");
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("should clear future history when set is called after undo", () => {
    const { result } = renderHook(() => useUndo("initial"));

    act(() => result.current.set("updated 1"));
    act(() => result.current.set("updated 2"));
    act(() => result.current.undo()); // Back to 'updated 1', future has ['updated 2']

    expect(result.current.state).toBe("updated 1");
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.set("updated 3"); // New change after undo
    });

    expect(result.current.state).toBe("updated 3");
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false); // Future history cleared

    // Cannot redo 'updated 2' anymore
    act(() => result.current.redo());
    expect(result.current.state).toBe("updated 3");
  });

  it("should reset the state and clear all history", () => {
    const { result } = renderHook(() => useUndo("initial"));

    act(() => result.current.set("updated 1"));
    act(() => result.current.set("updated 2"));
    act(() => result.current.undo());

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.reset("completely new");
    });

    expect(result.current.state).toBe("completely new");
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});
