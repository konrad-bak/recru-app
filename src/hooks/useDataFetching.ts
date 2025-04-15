import { useCallback, useEffect, useRef, useState } from "react";

// --- Interfaces ---

/**
 * Represents an entry in the data cache.
 * @template DataType The type of the cached data.
 */
interface CacheEntry<DataType> {
  data: DataType;
  /** Timestamp (ms since epoch) when the data was fetched. */
  timestamp: number;
  /** Timestamp (ms since epoch) when the cache entry should be considered stale. */
  expiresAt: number;
}

/**
 * Configuration options for the useDataFetching hook.
 */
interface FetchOptions {
  /** How long the data should remain fresh in the cache (in milliseconds). Defaults to 5 minutes. */
  cacheTime?: number;
  /** Minimum time interval (in milliseconds) between consecutive fetches for the same URL, preventing rapid refetches. Defaults to 2 seconds. */
  dedupingInterval?: number;
  // TODO: Add retry options later if needed
  // retryCount?: number;
  // retryDelay?: number;
  /** Optional callback function invoked when a fetch error occurs. */
  onError?: (error: Error) => void;
  /** If true, the hook will not automatically fetch data on mount or URL change. Fetch must be triggered manually via refetch. Defaults to false. */
  manual?: boolean;
}

/**
 * Represents the state managed by the useDataFetching hook.
 * @template DataType The type of the fetched data.
 */
interface FetchState<DataType> {
  /** The fetched data, or null if no data has been fetched or an error occurred initially. */
  data: DataType | null;
  /** An error object if the fetch failed, otherwise null. */
  error: Error | null;
  /** True if the hook is currently fetching data for the first time (no data or cache available). */
  isLoading: boolean;
  /** True if the hook is currently fetching data in the background (e.g., revalidating stale cache or during a manual refetch when data already exists). */
  isValidating: boolean;
}

// --- Constants ---

const DEFAULT_CACHE_TIME = 5 * 60 * 1000; // 5 minutes
const DEFAULT_DEDUPING_INTERVAL = 2000; // 2 seconds

// --- Global Cache and Pending Requests ---
// Module-level Maps ensure cache and deduplication are shared across all hook instances.

/** Global cache storage. Maps URL strings to CacheEntry objects. */
const globalCache = new Map<string, CacheEntry<unknown>>();
/** Global map tracking pending fetch promises. Maps URL strings to Promises. */
const pendingRequests = new Map<string, Promise<unknown>>();

// --- Hook Implementation ---

/**
 * Custom hook for fetching data with caching and request deduplication.
 *
 * @template DataType The expected type of the data to be fetched.
 * @param {string | null | undefined} url The URL to fetch data from. If null or undefined, the fetch will not be executed.
 * @param {FetchOptions} [options={}] Configuration options for fetching behavior.
 * @returns {FetchState<DataType> & { refetch: () => Promise<void>; mutate: (newDataOrFn: DataType | ((currentData: DataType | null) => DataType), shouldRevalidate?: boolean) => void; }}
 *          An object containing the fetch state (`data`, `error`, `isLoading`, `isValidating`)
 *          and functions to manually `refetch` or `mutate` the data.
 */
export function useDataFetching<DataType>(
  url: string | null | undefined,
  options: FetchOptions = {}
): FetchState<DataType> & {
  refetch: () => Promise<void>;
  mutate: (
    newDataOrFn: DataType | ((currentData: DataType | null) => DataType),
    shouldRevalidate?: boolean // Option to trigger revalidation after mutation
  ) => void;
} {
  const {
    cacheTime = DEFAULT_CACHE_TIME,
    dedupingInterval = DEFAULT_DEDUPING_INTERVAL,
    onError,
    manual = false, // Default to automatic fetching
  } = options;

  // Use a ref to track mounted status to prevent state updates on unmounted components
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Key for cache and pending requests (handles null/undefined URL)
  const cacheKey = url ?? "__disabled__";

  // Initialize state, potentially from cache if URL is valid
  const [state, setState] = useState<FetchState<DataType>>(() => {
    if (!url) {
      return { data: null, error: null, isLoading: false, isValidating: false };
    }
    const cachedEntry = globalCache.get(cacheKey) as
      | CacheEntry<DataType>
      | undefined;
    const now = Date.now();
    if (cachedEntry && now < cachedEntry.expiresAt) {
      // Use valid cached data
      return {
        data: cachedEntry.data,
        error: null,
        isLoading: false,
        isValidating: false, // Will potentially validate based on dedupingInterval later
      };
    }
    // Otherwise, initial state indicates loading (if not manual)
    return {
      data: (cachedEntry?.data as DataType) ?? null, // Keep stale data if available
      error: null,
      isLoading: !manual && !cachedEntry, // Loading only if auto-fetch and no cache
      isValidating: false,
    };
  });

  // Internal function to perform the actual fetch and update state/cache
  // Wrapped in useCallback for stability
  const performFetch = useCallback(
    async (_isRefetch = false): Promise<DataType> => {
      // If URL is invalid, do nothing and return a rejected promise
      if (!url) {
        const error = new Error("Fetch URL is not provided.");
        if (isMounted.current) {
          setState((prev) => ({
            ...prev,
            error,
            isLoading: false,
            isValidating: false,
          }));
        }
        throw error;
      }

      const currentKey = url; // Use the valid URL as key here

      // --- Deduplication Check ---
      if (pendingRequests.has(currentKey)) {
        // A request is already in flight for this URL.
        // Update state to validating if not already loading/validating
        if (!state.isLoading && !state.isValidating && isMounted.current) {
          setState((prev) => ({ ...prev, isValidating: true }));
        }
        // Return the existing promise
        return pendingRequests.get(currentKey)! as Promise<DataType>;
      }

      // --- Perform Fetch ---
      const fetchPromise = (async (): Promise<DataType> => {
        const response = await fetch(currentKey);
        if (!response.ok) {
          // Attempt to read error message from response body
          let errorBody = `HTTP error! status: ${response.status}`;
          try {
            const errorJson = await response.json();
            errorBody =
              errorJson.message || errorJson.error || JSON.stringify(errorJson);
          } catch (e) {
            /* Ignore if response body is not JSON */
          }
          throw new Error(errorBody);
        }
        return (await response.json()) as DataType;
      })();

      // Store the promise in pending requests
      pendingRequests.set(currentKey, fetchPromise);

      try {
        const result = await fetchPromise;
        const fetchTime = Date.now();
        const newCacheEntry: CacheEntry<DataType> = {
          data: result,
          timestamp: fetchTime,
          expiresAt: fetchTime + cacheTime,
        };
        globalCache.set(currentKey, newCacheEntry);

        if (isMounted.current) {
          setState({
            data: result,
            error: null,
            isLoading: false,
            isValidating: false,
          });
        }
        return result; // Return data on success
      } catch (error) {
        if (isMounted.current) {
          // Keep existing data on error if available (especially during revalidation)
          setState((prev) => ({
            ...prev,
            error: error as Error,
            isLoading: false,
            isValidating: false,
          }));
          // Call onError callback if provided
          onError?.(error as Error);
        }
        // Rethrow the error so callers of performFetch (like refetch) can handle it
        throw error;
      } finally {
        // Remove the promise from pending requests once resolved or rejected
        pendingRequests.delete(currentKey);
      }
      // Add dependencies for useCallback
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url, cacheTime, onError]
  ); // Dependencies ensure the callback updates correctly

  // Main data fetching orchestrator logic
  // Wrapped in useCallback for stability
  const fetchData = useCallback(
    async (isRefetch = false) => {
      // Don't fetch if URL is invalid
      if (!url) {
        if (isMounted.current) {
          setState({
            data: null,
            error: null,
            isLoading: false,
            isValidating: false,
          });
        }
        return;
      }

      const currentKey = url;
      const now = Date.now();
      const cachedEntry = globalCache.get(currentKey) as
        | CacheEntry<DataType>
        | undefined;

      // --- Cache Check (Skip if forced refetch) ---
      if (!isRefetch && cachedEntry) {
        // 1. Cache is valid and fresh (within deduping interval)
        if (
          now < cachedEntry.expiresAt &&
          now - cachedEntry.timestamp < dedupingInterval
        ) {
          // Ensure state reflects cached data if it wasn't set initially or changed
          if (
            state.data !== cachedEntry.data ||
            state.isLoading ||
            state.isValidating
          ) {
            if (isMounted.current) {
              setState({
                data: cachedEntry.data,
                error: null,
                isLoading: false,
                isValidating: false,
              });
            }
          }
          console.log(`[useDataFetching] Cache hit (fresh): ${currentKey}`);
          return; // Cache hit, fresh enough
        }

        // 2. Cache is valid but stale (older than deduping interval but not expired) - Revalidate in background
        if (now < cachedEntry.expiresAt) {
          if (isMounted.current) {
            // Ensure state shows cached data, set validating flag
            setState((prev) => ({
              ...prev,
              data: cachedEntry.data, // Ensure current data is shown
              error: null,
              isLoading: false,
              isValidating: true, // Revalidate in background
            }));
          }
          console.log(
            `[useDataFetching] Cache hit (stale, revalidating): ${currentKey}`
          );
          // Proceed to fetch (deduplication check will happen in performFetch)
          try {
            await performFetch(); // Don't necessarily need the result here, state updates happen inside
          } catch {
            // Error handled within performFetch (state update, onError callback)
            console.warn(
              `[useDataFetching] Background revalidation failed: ${currentKey}`
            );
          }
          return;
        }

        // 3. Cache is expired - Remove it? No, let performFetch overwrite it. Proceed to fetch.
        console.log(`[useDataFetching] Cache expired: ${currentKey}`);
        // Fall through to fetch below
      }

      // --- No valid/fresh cache or forced refetch ---
      if (isMounted.current) {
        // Set loading/validating state appropriately
        setState((prev) => ({
          ...prev,
          // isLoading true only if we don't have *any* data (even stale)
          isLoading: !prev.data,
          // isValidating true if we *do* have data (even stale) and are fetching again
          isValidating: !!prev.data,
          error: null, // Clear previous error on new fetch attempt
        }));
      }

      console.log(`[useDataFetching] Fetching: ${currentKey}`);
      // Proceed to fetch (deduplication check will happen in performFetch)
      try {
        await performFetch(isRefetch); // Pass refetch flag
      } catch {
        // Error handled within performFetch (state update, onError callback)
        console.error(`[useDataFetching] Fetch failed: ${currentKey}`);
      }
      // Add dependencies for useCallback
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url, dedupingInterval, performFetch]
  ); // state.data helps determine isLoading/isValidating

  // Effect to trigger fetch on mount and when url/options change (if not manual)
  useEffect(() => {
    if (!manual && url) {
      // Check cache status again within the effect to decide initial action
      const cachedEntry = globalCache.get(url) as
        | CacheEntry<DataType>
        | undefined;
      const now = Date.now();

      if (cachedEntry && now < cachedEntry.expiresAt) {
        // Cache exists and is valid
        if (now - cachedEntry.timestamp >= dedupingInterval) {
          // Cache is stale, trigger background revalidation
          fetchData();
        } else {
          // Cache is fresh, ensure state is correct (might have been initialized differently)
          if (
            state.data !== cachedEntry.data ||
            state.isLoading ||
            state.isValidating
          ) {
            if (isMounted.current) {
              setState({
                data: cachedEntry.data,
                error: null,
                isLoading: false,
                isValidating: false,
              });
            }
          }
        }
      } else {
        // No valid cache, trigger initial fetch
        fetchData();
      }
    } else if (!url && isMounted.current) {
      // If URL becomes null/undefined, reset state
      setState({
        data: null,
        error: null,
        isLoading: false,
        isValidating: false,
      });
    }
    // Dependency array includes url and the stable fetchData function
    // Note: Including options directly can cause loops if they are objects created inline.
    // It's better to destructure specific primitive options used in dependencies if needed,
    // or ensure options objects have stable references. Here, cacheTime/dedupingInterval
    // are dependencies of fetchData/performFetch, so changes there will trigger this effect via fetchData identity change.

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, manual, fetchData]); // Effect depends on url, manual flag, and the fetchData function identity

  // Function to manually trigger a refetch
  const refetch = useCallback(async () => {
    if (!url) {
      console.warn("[useDataFetching] Refetch called with no URL.");
      return;
    }
    console.log(`[useDataFetching] Manual refetch triggered: ${url}`);
    // Don't clear cache here, let performFetch handle updates/deduplication
    // Set loading/validating state immediately
    if (isMounted.current) {
      setState((prev) => ({
        ...prev,
        isLoading: !prev.data,
        isValidating: !!prev.data,
        error: null,
      }));
    }
    try {
      // Call performFetch directly to bypass fetchData's cache checks
      await performFetch(true);
    } catch (error) {
      // Error is handled within performFetch (state updates, onError)
      console.error(`[useDataFetching] Refetch failed: ${url}`, error);
      // Potentially re-throw or handle differently if refetch needs specific error feedback
    }
  }, [url, performFetch]); // Depends on url and performFetch

  // Function to manually update the cache and state
  const mutate = useCallback(
    (
      newDataOrFn: DataType | ((currentData: DataType | null) => DataType),
      shouldRevalidate: boolean = false // Default to not revalidating after mutate
    ) => {
      if (!url) {
        console.warn("[useDataFetching] Mutate called with no URL.");
        return;
      }
      console.log(`[useDataFetching] Mutating data for: ${url}`);

      const currentKey = url;
      let newData: DataType;

      // Determine the new data based on input
      if (typeof newDataOrFn === "function") {
        const updaterFn = newDataOrFn as (
          currentData: DataType | null
        ) => DataType;
        // Use the current state's data for the update function
        // Note: This uses the state at the time mutate is *called*.
        // If more complex updates based on the *absolute latest* cached data are needed,
        // one might read from globalCache directly, but state is usually sufficient.
        newData = updaterFn(state.data);
      } else {
        newData = newDataOrFn;
      }

      const now = Date.now();
      const newCacheEntry: CacheEntry<DataType> = {
        data: newData,
        timestamp: now, // Treat mutated data as freshly 'fetched'
        expiresAt: now + cacheTime,
      };

      // Update global cache
      globalCache.set(currentKey, newCacheEntry);

      // Update local state immediately
      if (isMounted.current) {
        setState((prev) => ({
          ...prev,
          data: newData,
          error: null, // Assume mutation resolves previous errors for this data
          // isLoading/isValidating typically remain false unless revalidation is triggered
          isLoading: false,
          isValidating: shouldRevalidate && !prev.isValidating, // Set validating if revalidation is requested
        }));
      }

      // Optionally trigger a background revalidation
      if (shouldRevalidate) {
        console.log(
          `[useDataFetching] Triggering revalidation after mutate: ${url}`
        );
        // Use performFetch directly to ensure it runs even if dedupingInterval hasn't passed
        // Don't await here, let it run in the background
        performFetch().catch((error) => {
          console.warn(
            `[useDataFetching] Post-mutation revalidation failed: ${url}`,
            error
          );
          // Optionally revert mutation or set error state here if needed
        });
      }
    },
    [url, cacheTime, state.data, performFetch]
  ); // Depends on url, cacheTime, current data, and performFetch

  // Return the state and control functions
  return {
    ...state,
    refetch,
    mutate,
  };
}

// Helper function to clear the entire cache (useful for testing or global reset)
export function clearDataFetchingCache() {
  console.warn("[useDataFetching] Clearing global cache.");
  globalCache.clear();
  pendingRequests.clear();
}

// Helper function to inspect the cache (useful for debugging)
export function inspectDataFetchingCache() {
  return new Map(globalCache);
}
