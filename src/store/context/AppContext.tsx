import {
  createContext,
  Dispatch,
  ReactNode,
  useContext,
  useMemo,
  useReducer,
} from "react";
import {
  contextAppReducer,
  initialContextState as defaultInitialState,
} from "./reducer";
import { ContextAppAction, ContextAppState } from "./types";

// --- Context Creation ---

/**
 * Context for providing the application state (Context API version).
 */
const AppStateContext = createContext<ContextAppState | undefined>(undefined);

/**
 * Context for providing the dispatch function (Context API version).
 */
const AppDispatchContext = createContext<
  Dispatch<ContextAppAction> | undefined
>(undefined);

// --- Provider Component ---

interface AppProviderProps {
  children: ReactNode;
  /** Optional initial state override, merged with defaults. */
  initialState?: Partial<ContextAppState>;
}

/**
 * Provides the Context-based application state and dispatch function to the component tree.
 * Should wrap the root of the application or the relevant subtree.
 * @param {AppProviderProps} props Component props.
 */
export const AppProvider = ({ children, initialState }: AppProviderProps) => {
  // Merge provided initial state with defaults
  const mergedInitialState = useMemo(
    () => ({
      ...defaultInitialState,
      ...initialState,
    }),
    [initialState]
  );

  const [state, dispatch] = useReducer(contextAppReducer, mergedInitialState);

  console.log("[AppProvider - Context] Rendering. State:", state);

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
};

// --- Custom Hooks for Consumption ---

/**
 * Custom hook to access the Context-based application state.
 * Throws an error if used outside of an AppProvider.
 * @returns {ContextAppState} The current application state.
 */
export const useAppState = (): ContextAppState => {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error("useAppState must be used within an AppProvider");
  }
  return context;
};

/**
 * Custom hook to access the Context-based dispatch function.
 * Throws an error if used outside of an AppProvider.
 * @returns {Dispatch<ContextAppAction>} The dispatch function.
 */
export const useAppDispatch = (): Dispatch<ContextAppAction> => {
  const context = useContext(AppDispatchContext);
  if (context === undefined) {
    throw new Error("useAppDispatch must be used within an AppProvider");
  }
  return context;
};
