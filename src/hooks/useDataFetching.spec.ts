import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDataFetchingCache,
  inspectDataFetchingCache,
  useDataFetching,
} from "./useDataFetching"; // Adjust path if needed

// --- Mocks ---

// Mock data
const MOCK_DATA_1 = { id: 1, name: "Test Data 1" };
const MOCK_DATA_2 = { id: 2, name: "Test Data 2" };
const MOCK_ERROR_MESSAGE = "Failed to fetch";

// Mock fetch function
const mockFetch = vi.fn();
global.fetch = mockFetch; // Assign the mock to global fetch

// Helper to create mock fetch responses
const createMockResponse = (
  data: unknown,
  ok: boolean,
  status: number = 200
) => ({
  ok,
  status,
  json: async () => data,
  text: async () => JSON.stringify(data), // For error parsing attempt
});

// --- Tests ---

describe("useDataFetching", () => {
  // Reset mocks and cache before each test
  beforeEach(() => {
    vi.useFakeTimers(); // Use fake timers for cacheTime/dedupingInterval
    mockFetch.mockClear();
    clearDataFetchingCache(); // Clear the hook's global cache
  });

  // Restore real timers and potentially other mocks after each test
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks(); // Restore any spies or other mocks
  });

  // --- Basic Fetching ---

  it("should return initial loading state and fetch data successfully", async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(MOCK_DATA_1, true));

    const { result } = renderHook(() =>
      useDataFetching<typeof MOCK_DATA_1>("/api/data")
    );

    // Initial state
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isValidating).toBe(false);

    // Wait for the fetch promise to resolve and state update
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Final state
    expect(result.current.data).toEqual(MOCK_DATA_1);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isValidating).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/data");
  });

  it("should return error state when fetch fails", async () => {
    const errorResponse = { message: MOCK_ERROR_MESSAGE };
    mockFetch.mockResolvedValueOnce(
      createMockResponse(errorResponse, false, 500)
    );
    const onErrorMock = vi.fn();

    const { result } = renderHook(() =>
      useDataFetching("/api/error", { onError: onErrorMock })
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain(MOCK_ERROR_MESSAGE); // Check if message from json is included
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isValidating).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(onErrorMock).toHaveBeenCalledTimes(1);
    expect(onErrorMock).toHaveBeenCalledWith(expect.any(Error));
  });

  it("should not fetch if url is null or undefined", () => {
    const { result } = renderHook(() => useDataFetching(null));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isValidating).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // --- Caching ---

  it("should return cached data immediately if fresh", async () => {
    // First fetch
    mockFetch.mockResolvedValueOnce(createMockResponse(MOCK_DATA_1, true));
    const { result: result1 } = renderHook(() => useDataFetching("/api/cache"));
    await waitFor(() => expect(result1.current.isLoading).toBe(false));
    expect(result1.current.data).toEqual(MOCK_DATA_1);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second fetch (should hit cache) - immediately render
    const { result: result2 } = renderHook(() => useDataFetching("/api/cache"));

    // Should immediately have data, no loading state
    expect(result2.current.data).toEqual(MOCK_DATA_1);
    expect(result2.current.error).toBeNull();
    expect(result2.current.isLoading).toBe(false);
    expect(result2.current.isValidating).toBe(false);

    // Fetch should not be called again yet (within deduping interval)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should revalidate stale data in the background", async () => {
    const dedupingInterval = 2000; // Match default or pass in options
    // First fetch
    mockFetch.mockResolvedValueOnce(createMockResponse(MOCK_DATA_1, true));
    const { result: result1 } = renderHook(() =>
      useDataFetching("/api/stale", { dedupingInterval })
    );
    await waitFor(() => expect(result1.current.isLoading).toBe(false));
    expect(result1.current.data).toEqual(MOCK_DATA_1);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Advance time past deduping interval but before cache expiry
    act(() => {
      vi.advanceTimersByTime(dedupingInterval + 100);
    });

    // Second fetch (should show stale data, then revalidate)
    mockFetch.mockResolvedValueOnce(createMockResponse(MOCK_DATA_2, true)); // Prepare for revalidation fetch
    const { result: result2 } = renderHook(() =>
      useDataFetching("/api/stale", { dedupingInterval })
    );

    // Should immediately have stale data, but start validating
    expect(result2.current.data).toEqual(MOCK_DATA_1);
    expect(result2.current.isLoading).toBe(false);
    expect(result2.current.isValidating).toBe(true); // Revalidating!

    // Wait for the revalidation fetch to complete
    await waitFor(() => expect(result2.current.isValidating).toBe(false));

    // State after revalidation
    expect(result2.current.data).toEqual(MOCK_DATA_2); // Updated data
    expect(result2.current.isLoading).toBe(false);
    expect(result2.current.isValidating).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(2); // Fetch called again
  });

  it("should refetch data when cache expires", async () => {
    const cacheTime = 1000; // Use a short cache time for testing
    // First fetch
    mockFetch.mockResolvedValueOnce(createMockResponse(MOCK_DATA_1, true));
    const { result: result1 } = renderHook(() =>
      useDataFetching("/api/expired", { cacheTime })
    );
    await waitFor(() => expect(result1.current.isLoading).toBe(false));
    expect(result1.current.data).toEqual(MOCK_DATA_1);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Advance time past cache expiry
    act(() => {
      vi.advanceTimersByTime(cacheTime + 100);
    });

    // Second fetch (should refetch as cache is expired)
    mockFetch.mockResolvedValueOnce(createMockResponse(MOCK_DATA_2, true));
    const { result: result2 } = renderHook(() =>
      useDataFetching("/api/expired", { cacheTime })
    );

    // Should show stale data initially (if available) but start loading/validating
    // The hook implementation keeps stale data while loading/validating
    expect(result2.current.data).toEqual(MOCK_DATA_1); // Shows stale data
    expect(result2.current.isLoading).toBe(false); // Not initial load
    expect(result2.current.isValidating).toBe(true); // Is validating because data exists

    // Wait for the fetch to complete
    await waitFor(() => expect(result2.current.isValidating).toBe(false));

    // State after fetch
    expect(result2.current.data).toEqual(MOCK_DATA_2); // Updated data
    expect(result2.current.isLoading).toBe(false);
    expect(result2.current.isValidating).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(2); // Fetch called again
  });

  // --- Deduplication ---

  it("should deduplicate requests made close together", async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(MOCK_DATA_1, true));

    // Render two hooks for the same URL quickly
    const { result: result1 } = renderHook(() =>
      useDataFetching("/api/dedupe")
    );
    const { result: result2 } = renderHook(() =>
      useDataFetching("/api/dedupe")
    );

    // Both should be loading initially
    expect(result1.current.isLoading).toBe(true);
    expect(result2.current.isLoading).toBe(true); // Or validating if one renders slightly after the other starts fetch

    // Wait for the single fetch to complete
    await waitFor(() => expect(result1.current.isLoading).toBe(false));
    await waitFor(() => expect(result2.current.isLoading).toBe(false)); // Or validating false

    // Both should have the same data
    expect(result1.current.data).toEqual(MOCK_DATA_1);
    expect(result2.current.data).toEqual(MOCK_DATA_1);

    // Fetch should only have been called once
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // --- Manual Fetching & Refetch ---

  it("should not fetch automatically when manual is true", () => {
    const { result } = renderHook(() =>
      useDataFetching("/api/manual", { manual: true })
    );

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isValidating).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should fetch when refetch is called manually", async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(MOCK_DATA_1, true));
    const { result } = renderHook(() =>
      useDataFetching("/api/manual", { manual: true })
    );

    // Initially not loading
    expect(result.current.isLoading).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();

    // Trigger refetch
    // Use act to wrap state updates triggered by refetch
    await act(async () => {
      await result.current.refetch();
    });

    // Should have loaded data now
    expect(result.current.data).toEqual(MOCK_DATA_1);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isValidating).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should refetch data using the refetch function even if data exists", async () => {
    // Initial fetch
    mockFetch.mockResolvedValueOnce(createMockResponse(MOCK_DATA_1, true));
    const { result } = renderHook(() => useDataFetching("/api/refetch"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(MOCK_DATA_1);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Prepare for refetch
    mockFetch.mockResolvedValueOnce(createMockResponse(MOCK_DATA_2, true));

    // Trigger refetch
    await act(async () => {
      await result.current.refetch();
    });

    // Should show validating during refetch
    // Note: State updates happen fast, checking intermediate state needs careful waitFor
    // We'll check the final state after the await act completes.

    // Final state after refetch
    expect(result.current.data).toEqual(MOCK_DATA_2);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isValidating).toBe(false); // Should be false after refetch completes
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // --- Mutate ---

  it("should update data immediately using mutate", async () => {
    // Initial fetch
    mockFetch.mockResolvedValueOnce(createMockResponse(MOCK_DATA_1, true));
    const { result } = renderHook(() =>
      useDataFetching<typeof MOCK_DATA_1>("/api/mutate")
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(MOCK_DATA_1);

    const MUTATED_DATA = { id: 3, name: "Mutated Data" };

    // Mutate the data
    act(() => {
      result.current.mutate(MUTATED_DATA);
    });

    // State should update immediately
    expect(result.current.data).toEqual(MUTATED_DATA);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isValidating).toBe(false);

    // Fetch should not be called again by default mutate
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Verify cache was updated
    const cache = inspectDataFetchingCache();
    const cacheEntry = cache.get("/api/mutate");
    expect(cacheEntry?.data).toEqual(MUTATED_DATA);
  });

  it("should update data using mutate with an updater function", async () => {
    mockFetch.mockResolvedValueOnce(createMockResponse(MOCK_DATA_1, true));
    const { result } = renderHook(() =>
      useDataFetching<typeof MOCK_DATA_1>("/api/mutate-fn")
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.mutate((currentData) => ({
        ...currentData!,
        name: "Updated Name",
      }));
    });

    expect(result.current.data).toEqual({ id: 1, name: "Updated Name" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("should revalidate after mutate if shouldRevalidate is true", async () => {
    // Initial fetch
    mockFetch.mockResolvedValueOnce(createMockResponse(MOCK_DATA_1, true));
    const { result } = renderHook(() =>
      useDataFetching<typeof MOCK_DATA_1>("/api/mutate-revalidate")
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const MUTATED_DATA = { id: 3, name: "Mutated Data" };
    // Prepare for revalidation fetch
    mockFetch.mockResolvedValueOnce(createMockResponse(MOCK_DATA_2, true));

    // Mutate the data and trigger revalidation
    act(() => {
      result.current.mutate(MUTATED_DATA, true);
    });

    // State should update immediately with mutated data, and start validating
    expect(result.current.data).toEqual(MUTATED_DATA);
    expect(result.current.isValidating).toBe(true);

    // Wait for the revalidation fetch to complete
    await waitFor(() => expect(result.current.isValidating).toBe(false));

    // Final state after revalidation (data from the revalidation fetch)
    expect(result.current.data).toEqual(MOCK_DATA_2);
    expect(result.current.isValidating).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(2); // Initial fetch + revalidation
  });
});
