import { useCallback, useReducer } from "react";

/**
 * Interface representing the state managed by the undo reducer.
 * @template T The type of the state being managed.
 */
interface UndoState<T> {
  past: T[]; // History of previous states
  present: T; // The current state
  future: T[]; // History of states that have been undone (for redo)
}

// --- Action Types ---

// Discriminated union for reducer actions
type Action<T> =
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SET"; newPresent: T }
  | { type: "RESET"; newPresent: T };

// --- Reducer Function ---

/**
 * Reducer function to manage state with undo/redo capabilities.
 * @template T The type of the state being managed.
 * @param {UndoState<T>} state The current undo state.
 * @param {Action<T>} action The action to perform.
 * @returns {UndoState<T>} The new undo state.
 */
const undoReducer = <T>(
  state: UndoState<T>,
  action: Action<T>
): UndoState<T> => {
  const { past, present, future } = state;

  switch (action.type) {
    case "UNDO": {
      if (past.length === 0) {
        // Nothing to undo
        return state;
      }
      const previous = past[past.length - 1]; // Get the last past state
      const newPast = past.slice(0, past.length - 1); // Remove it from past
      return {
        past: newPast,
        present: previous, // Make it the present state
        future: [present, ...future], // Add the old present state to the future
      };
    }

    case "REDO": {
      if (future.length === 0) {
        // Nothing to redo
        return state;
      }
      const next = future[0]; // Get the first future state
      const newFuture = future.slice(1); // Remove it from future
      return {
        past: [...past, present], // Add the old present state to the past
        present: next, // Make the future state the present state
        future: newFuture,
      };
    }

    case "SET": {
      const { newPresent } = action;
      if (newPresent === present) {
        // If the new state is the same as the current one, do nothing
        return state;
      }
      // A new state is set, clear the future history
      return {
        past: [...past, present], // Add the old present state to the past
        present: newPresent, // Set the new present state
        future: [], // Clear future states
      };
    }

    case "RESET": {
      // Reset to a new initial state, clearing all history
      const { newPresent } = action;
      return {
        past: [],
        present: newPresent,
        future: [],
      };
    }

    default: {
      // Should not happen with discriminated unions, but good practice
      return state;
    }
  }
};

// --- Custom Hook ---

/**
 * A custom hook to manage state with undo/redo functionality.
 *
 * @template T The type of the state to manage.
 * @param {T} initialPresent The initial state value.
 * @returns {{
 *   state: T; // The current state value
 *   set: (newPresent: T) => void; // Function to set a new state (clears redo history)
 *   reset: (newPresent: T) => void; // Function to reset the state to a new value (clears all history)
 *   undo: () => void; // Function to undo the last change
 *   redo: () => void; // Function to redo the last undone change
 *   canUndo: boolean; // Whether an undo operation is possible
 *   canRedo: boolean; // Whether a redo operation is possible
 * }}
 */
export function useUndo<T>(initialPresent: T) {
  const initialState: UndoState<T> = {
    past: [],
    present: initialPresent,
    future: [],
  };

  const [state, dispatch] = useReducer(undoReducer<T>, initialState);

  // Check if undo/redo actions are possible
  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  // Create stable callback functions using useCallback to dispatch actions
  const undo = useCallback(() => {
    dispatch({ type: "UNDO" });
  }, [dispatch]);

  const redo = useCallback(() => {
    dispatch({ type: "REDO" });
  }, [dispatch]);

  const set = useCallback(
    (newPresent: T) => {
      dispatch({ type: "SET", newPresent });
    },
    [dispatch]
  );

  const reset = useCallback(
    (newPresent: T) => {
      dispatch({ type: "RESET", newPresent });
    },
    [dispatch]
  );

  return {
    state: state.present, // Expose only the current state value
    set,
    reset,
    undo,
    redo,
    canUndo,
    canRedo,
    // Optionally expose past/future for debugging or advanced use cases, but typically not needed
    // _past: state.past,
    // _future: state.future,
  };
}
