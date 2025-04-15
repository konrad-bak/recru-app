import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Represents the state managed by the useWebWorker hook.
 * @template WorkerResult The type of the data returned by the worker.
 */
interface UseWebWorkerState<WorkerResult> {
  /** The data returned from the last successful worker execution, or null initially or after an error. */
  data: WorkerResult | null;
  /** An error message string if the worker encountered an error, otherwise null. */
  error: string | null;
  /** True if the worker is currently processing a task. */
  isRunning: boolean;
}

/**
 * Represents the return value of the useWebWorker hook.
 * @template WorkerInput The type of the data sent to the worker.
 * @template WorkerResult The type of the data returned by the worker.
 */
interface UseWebWorkerReturn<WorkerInput, WorkerResult>
  extends UseWebWorkerState<WorkerResult> {
  /** Function to send data to the worker and start the computation. */
  run: (data: WorkerInput) => void;
  /** Function to manually terminate the worker instance. */
  terminate: () => void;
}

// --- Function Overloads ---

/**
 * Creates a Web Worker to run the provided function in a separate thread.
 * IMPORTANT: The passed function `fn` cannot rely on closures or variables from the hook's scope.
 * It must be self-contained or only use globally available functions/constants.
 *
 * @template WorkerInput The type of the data sent to the worker's function.
 * @template WorkerResult The type of the data returned by the worker's function.
 * @param fn The function to execute within the Web Worker. Can be sync or async.
 * @returns {UseWebWorkerReturn<WorkerInput, WorkerResult>} State and controls for the worker.
 */
export function useWebWorker<WorkerInput, WorkerResult>(
  fn: (data: WorkerInput) => WorkerResult | Promise<WorkerResult>
): UseWebWorkerReturn<WorkerInput, WorkerResult>;

/**
 * Creates a Web Worker from the provided script path (URL).
 * The worker script is responsible for handling incoming messages and posting results/errors back.
 *
 * @template WorkerInput The type of the data sent to the worker via postMessage.
 * @template WorkerResult The type of the data expected back from the worker in the 'RESULT' message payload.
 * @param scriptPath The absolute path or URL to the worker script file.
 * @returns {UseWebWorkerReturn<WorkerInput, WorkerResult>} State and controls for the worker.
 */
export function useWebWorker<WorkerInput, WorkerResult>(
  scriptPath: string | URL
): UseWebWorkerReturn<WorkerInput, WorkerResult>;

// --- Hook Implementation ---

export function useWebWorker<WorkerInput, WorkerResult>(
  fnOrScriptPath:
    | ((data: WorkerInput) => WorkerResult | Promise<WorkerResult>)
    | string
    | URL
): UseWebWorkerReturn<WorkerInput, WorkerResult> {
  const [state, setState] = useState<UseWebWorkerState<WorkerResult>>({
    data: null,
    error: null,
    isRunning: false,
  });

  const workerRef = useRef<Worker | null>(null);
  // Ref to store the stringified function or script path
  const sourceRef = useRef(fnOrScriptPath);
  sourceRef.current = fnOrScriptPath; // Keep it updated if the prop changes

  // Effect for worker setup and cleanup
  useEffect(() => {
    let worker: Worker;
    let objectUrl: string | undefined; // To store blob URL for cleanup

    const source = sourceRef.current; // Use the ref's current value inside the effect

    if (typeof source === "function") {
      // --- Create worker from function using Blob URL ---
      const fnString = source.toString();

      // This code runs inside the worker thread
      const workerCode = `
        self.onmessage = async (event) => {
          const inputData = event.data;
          try {
            // Rehydrate the function (cannot use closures from hook scope)
            const workFn = (${fnString});
            const result = await workFn(inputData);
            // Post result back to main thread
            self.postMessage({ type: 'RESULT', payload: result });
          } catch (error) {
            // Post error back to main thread
            self.postMessage({
              type: 'ERROR',
              payload: error instanceof Error ? error.message : 'Worker execution error'
            });
          }
        };
      `;
      const blob = new Blob([workerCode], { type: "application/javascript" });
      objectUrl = URL.createObjectURL(blob);
      try {
        worker = new Worker(objectUrl);
      } catch (err) {
        console.error(
          "[useWebWorker] Failed to create worker from function blob:",
          err
        );
        setState((prev) => ({
          ...prev,
          error: `Failed to create worker: ${err instanceof Error ? err.message : String(err)}`,
        }));
        if (objectUrl) URL.revokeObjectURL(objectUrl); // Clean up blob URL on creation error
        return; // Exit effect
      }
    } else {
      // --- Create worker from script path ---
      try {
        // Ensure source is a string or URL object for the Worker constructor
        const workerPath = source instanceof URL ? source : String(source);
        worker = new Worker(workerPath);
      } catch (err) {
        console.error(
          `[useWebWorker] Failed to create worker from path: ${source}`,
          err
        );
        setState((prev) => ({
          ...prev,
          error: `Failed to create worker: ${err instanceof Error ? err.message : String(err)}`,
        }));
        return; // Exit effect
      }
    }

    console.log(
      `[useWebWorker] Worker initialized ${typeof source === "function" ? "(from function)" : `(from path: ${source})`}`
    );
    workerRef.current = worker;

    // --- Setup Message and Error Handlers ---
    worker.onmessage = (
      event: MessageEvent<{
        type: "RESULT" | "ERROR";
        payload: WorkerResult | string; // Payload is WorkerResult on success, string on error
      }>
    ) => {
      const { type, payload } = event.data || {}; // Add safety check for event.data

      // Optional: Add validation for the message structure
      if (!type || payload === undefined) {
        console.warn(
          "[useWebWorker] Received malformed message from worker:",
          event.data
        );
        setState({
          data: null,
          error: "Received malformed message from worker",
          isRunning: false,
        });
        return;
      }

      if (type === "RESULT") {
        console.log("[useWebWorker] Received result:", payload);
        // Assert payload type for state update
        setState({
          data: payload as WorkerResult,
          error: null,
          isRunning: false,
        });
      } else {
        // ERROR
        console.error("[useWebWorker] Received error from worker:", payload);
        // Assert payload type for state update
        setState({
          data: null,
          error: payload as string,
          isRunning: false,
        });
      }
    };

    worker.onerror = (event: ErrorEvent) => {
      // Handles uncaught errors within the worker script itself
      console.error("[useWebWorker] Uncaught error in worker:", event);
      setState({
        data: null,
        error: event.message || "An unexpected worker error occurred",
        isRunning: false,
      });
      event.preventDefault(); // Prevent default browser error handling
    };

    // --- Cleanup Function ---
    return () => {
      if (workerRef.current) {
        console.log("[useWebWorker] Terminating worker...");
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl); // Clean up blob URL if it was created
        console.log("[useWebWorker] Revoked object URL.");
      }
      // Reset state on cleanup? Let's keep the last state for potential remounts.
      // setState({ data: null, error: null, isRunning: false });
    };
    // Rerun effect if the function identity or script path changes
  }, [fnOrScriptPath]); // Dependency array uses the original prop

  // --- Function to Send Data to Worker ---
  const run = useCallback(
    (inputData: WorkerInput) => {
      if (!workerRef.current) {
        const errorMessage =
          "[useWebWorker] Cannot run. Worker is not available or failed to initialize.";
        console.error(errorMessage);
        // Update state only if the error is new to avoid potential loops
        setState((prev) =>
          prev.error === errorMessage
            ? prev
            : { ...prev, error: errorMessage, isRunning: false }
        );
        return;
      }
      if (state.isRunning) {
        console.warn(
          "[useWebWorker] Worker is already running. Ignoring new 'run' request."
        );
        return; // Prevent concurrent runs on the same worker instance
      }

      console.log("[useWebWorker] Running worker with data:", inputData);
      // Reset state before run, keeping previous data until new result arrives might be desired sometimes,
      // but resetting is often clearer. Let's stick with resetting for now.
      setState((prev) => ({ ...prev, error: null, isRunning: true }));

      // Send data to the worker
      workerRef.current.postMessage(inputData);
    },
    [state.isRunning] // Depends on isRunning to prevent concurrent calls
  );

  // --- Function to Terminate Worker Manually ---
  const terminate = useCallback(() => {
    if (workerRef.current) {
      console.log("[useWebWorker] Terminating worker manually.");
      workerRef.current.terminate();
      workerRef.current = null;
      // Update state to reflect termination
      setState((prev) => ({ ...prev, isRunning: false }));
    }
  }, []);

  // --- Return Hook State and Controls ---
  return {
    data: state.data,
    error: state.error,
    isRunning: state.isRunning,
    run,
    terminate,
  };
}
