import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWebWorker } from "./useWebWorker";

// --- Mock Worker ---
// Store worker instance and handlers
let mockWorkerInstance: MockWorker | null = null;
let messageHandler: ((event: MessageEvent) => void) | null = null;
let errorHandler: ((event: ErrorEvent) => void) | null = null;

class MockWorker {
  url: string | URL;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn(() => {
    console.log("[MockWorker] terminate called");
    // Reset handlers on terminate
    this.onmessage = null;
    this.onerror = null;
    mockWorkerInstance = null;
    messageHandler = null;
    errorHandler = null;
  });

  constructor(url: string | URL) {
    console.log("[MockWorker] constructor called with:", url);
    this.url = url;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    mockWorkerInstance = this; // Store the instance
    // Assign handlers from the instance to module-level vars for simulation
    Object.defineProperty(this, "onmessage", {
      get: () => messageHandler,
      set: (handler) => {
        console.log("[MockWorker] onmessage assigned");
        messageHandler = handler;
      },
      configurable: true,
    });
    Object.defineProperty(this, "onerror", {
      get: () => errorHandler,
      set: (handler) => {
        console.log("[MockWorker] onerror assigned");
        errorHandler = handler;
      },
      configurable: true,
    });
  }
}

// Helper to simulate message from worker
const mockWorkerSendMessage = (data: unknown) => {
  if (messageHandler) {
    console.log("[MockWorker] Simulating message:", data);
    act(() => {
      messageHandler!(new MessageEvent("message", { data }));
    });
  } else {
    console.warn(
      "[MockWorker] Cannot send message, no onmessage handler attached."
    );
  }
};

// Helper to simulate error from worker
const mockWorkerSendError = (error: ErrorEvent) => {
  if (errorHandler) {
    console.log("[MockWorker] Simulating error event:", error);
    act(() => {
      errorHandler!(error);
    });
  } else {
    console.warn(
      "[MockWorker] Cannot send error event, no onerror handler attached."
    );
  }
};

// Mock URL.createObjectURL and revokeObjectURL
const mockCreateObjectURL = vi.fn(
  (blob) => `blob:${blob.type}/${Math.random()}`
);
const mockRevokeObjectURL = vi.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

// --- Tests ---

describe("useWebWorker", () => {
  beforeEach(() => {
    // Mock the Worker class before each test
    vi.stubGlobal("Worker", MockWorker);
  });

  afterEach(() => {
    // Clean up mocks and instance
    vi.unstubAllGlobals(); // Restore original Worker
    vi.clearAllMocks();
    mockWorkerInstance = null;
    messageHandler = null;
    errorHandler = null;
  });

  it("should initialize with correct default state", () => {
    const workerFn = (data: number) => data * 2;
    const { result } = renderHook(() => useWebWorker(workerFn));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isRunning).toBe(false);
    expect(mockWorkerInstance).not.toBeNull(); // Worker should be created
  });

  it("should run worker, post message, and receive result (function)", async () => {
    const workerFn = (data: number) => data * 2;
    const { result } = renderHook(() => useWebWorker(workerFn));

    expect(mockCreateObjectURL).toHaveBeenCalled(); // Check blob URL creation
    expect(mockWorkerInstance).not.toBeNull();

    act(() => {
      result.current.run(10);
    });

    expect(result.current.isRunning).toBe(true);
    expect(result.current.error).toBeNull();
    expect(mockWorkerInstance?.postMessage).toHaveBeenCalledTimes(1);
    expect(mockWorkerInstance?.postMessage).toHaveBeenCalledWith(10);

    // Simulate worker sending back result
    mockWorkerSendMessage({ type: "RESULT", payload: 20 });

    await waitFor(() => {
      expect(result.current.isRunning).toBe(false);
    });

    expect(result.current.data).toBe(20);
    expect(result.current.error).toBeNull();
  });

  it("should run worker, post message, and receive result (script path)", async () => {
    const scriptPath = "/workers/test.js";
    const { result } = renderHook(() =>
      useWebWorker<number, number>(scriptPath)
    );

    expect(mockCreateObjectURL).not.toHaveBeenCalled(); // No blob URL
    expect(mockWorkerInstance).not.toBeNull();
    expect(mockWorkerInstance?.url as string).toBe(scriptPath);

    act(() => {
      result.current.run(5);
    });

    expect(result.current.isRunning).toBe(true);
    expect(mockWorkerInstance?.postMessage).toHaveBeenCalledTimes(1);
    expect(mockWorkerInstance?.postMessage).toHaveBeenCalledWith(5);

    // Simulate worker sending back result
    mockWorkerSendMessage({ type: "RESULT", payload: 25 }); // Example: square

    await waitFor(() => {
      expect(result.current.isRunning).toBe(false);
    });

    expect(result.current.data).toBe(25);
    expect(result.current.error).toBeNull();
  });

  it("should handle errors sent from the worker", async () => {
    const workerFn = (data: number) => data * 2;
    const { result } = renderHook(() => useWebWorker(workerFn));

    act(() => {
      result.current.run(10);
    });

    expect(result.current.isRunning).toBe(true);

    // Simulate worker sending back an error message
    const errorMessage = "Calculation failed";
    mockWorkerSendMessage({ type: "ERROR", payload: errorMessage });

    await waitFor(() => {
      expect(result.current.isRunning).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe(errorMessage);
  });

  it("should handle uncaught errors in the worker via onerror", async () => {
    const workerFn = (data: number) => data * 2;
    const { result } = renderHook(() => useWebWorker(workerFn));

    act(() => {
      result.current.run(10);
    });
    expect(result.current.isRunning).toBe(true);

    // Simulate worker throwing an uncaught error
    const errorEvent = new ErrorEvent("error", {
      message: "Uncaught Worker Error",
    });
    mockWorkerSendError(errorEvent);

    await waitFor(() => {
      expect(result.current.isRunning).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe("Uncaught Worker Error");
  });

  it("should terminate the worker when terminate is called", () => {
    const workerFn = (data: number) => data * 2;
    const { result } = renderHook(() => useWebWorker(workerFn));

    expect(mockWorkerInstance?.terminate).not.toHaveBeenCalled();

    act(() => {
      result.current.terminate();
    });

    expect(mockWorkerInstance?.terminate).toHaveBeenCalledTimes(1);
    // Check if state reflects termination (optional, depends on desired behavior)
    expect(result.current.isRunning).toBe(false);
  });

  it("should terminate the worker on unmount", () => {
    const workerFn = (data: number) => data * 2;
    const { unmount } = renderHook(() => useWebWorker(workerFn));

    const terminateSpy = vi.spyOn(mockWorkerInstance!, "terminate");

    unmount();

    expect(terminateSpy).toHaveBeenCalledTimes(1);
    expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1); // For blob URL cleanup
  });

  it("should prevent concurrent runs", () => {
    const workerFn = (data: number) => data * 2;
    const { result } = renderHook(() => useWebWorker(workerFn));

    act(() => {
      result.current.run(10);
    });

    expect(result.current.isRunning).toBe(true);
    expect(mockWorkerInstance?.postMessage).toHaveBeenCalledTimes(1);

    // Try running again while already running
    act(() => {
      result.current.run(20);
    });

    // Should not post message again
    expect(mockWorkerInstance?.postMessage).toHaveBeenCalledTimes(1);
    expect(result.current.isRunning).toBe(true); // Still running the first one
  });

  it("should handle worker initialization errors (function)", async () => {
    // Make Worker constructor throw
    const originalWorker = global.Worker;
    vi.stubGlobal(
      "Worker",
      vi.fn(() => {
        throw new Error("Invalid Worker Script");
      })
    );
    vi.spyOn(global, "Worker").mockImplementationOnce(() => {
      throw new Error("Invalid Worker Script");
    });

    const workerFn = (data: number) => data * 2;
    const { result } = renderHook(() => useWebWorker(workerFn));

    expect(result.current.error).toContain("Failed to create worker");
    expect(result.current.isRunning).toBe(false);
    expect(result.current.data).toBeNull();
    vi.stubGlobal("Worker", originalWorker);
  });

  it("should handle worker initialization errors (script path)", async () => {
    // Make Worker constructor throw
    const originalWorker = global.Worker;
    vi.stubGlobal(
      "Worker",
      vi.fn(() => {
        throw new Error("Cannot load script");
      })
    );
    vi.spyOn(global, "Worker").mockImplementationOnce(() => {
      throw new Error("Cannot load script");
    });

    const scriptPath = "/workers/invalid.js";
    const { result } = renderHook(() => useWebWorker(scriptPath));

    expect(result.current.error).toContain("Failed to create worker");
    expect(result.current.isRunning).toBe(false);
    expect(result.current.data).toBeNull();
    vi.stubGlobal("Worker", originalWorker);
  });

  // Test for the named function requirement (already covered by implementation check)
  it("should set error if a non-named recursive function is passed", () => {
    const anonRecursiveFn = (n: number): number => {
      // Arrow function
      if (n <= 0) return 0;
      return n + anonRecursiveFn(n - 1);
    };
    const { result } = renderHook(() => useWebWorker(anonRecursiveFn));

    expect(result.current.error).toContain(
      "Worker function must be a named function"
    );
    expect(mockWorkerInstance).toBeNull(); // Worker creation should have bailed
  });
});
