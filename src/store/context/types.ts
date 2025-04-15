/**
 * Represents the shape of the shared state managed by the Context API.
 */
export interface ContextAppState {
  // Using different names to avoid confusion with potential Redux state
  contextCount: number;
  isContextAuthenticated: boolean;
  contextUser: { name: string } | null;
  // Add other state slices specific to this context store as needed
}

/**
 * Represents the possible actions that can be dispatched to modify the ContextAppState.
 * Uses a discriminated union for type safety in the reducer.
 */
export type ContextAppAction =
  | { type: "CONTEXT_INCREMENT" }
  | { type: "CONTEXT_DECREMENT" }
  | { type: "CONTEXT_SET_COUNT"; payload: number }
  | { type: "CONTEXT_LOGIN"; payload: { name: string } }
  | { type: "CONTEXT_LOGOUT" };
