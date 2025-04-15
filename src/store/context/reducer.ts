import { ContextAppAction, ContextAppState } from "./types";

/**
 * The initial state for the Context-based application store.
 */
export const initialContextState: ContextAppState = {
  contextCount: 0,
  isContextAuthenticated: false,
  contextUser: null,
};

/**
 * Reducer function for the Context store. Handles state transitions based on dispatched actions.
 * @param {ContextAppState} state The current state.
 * @param {ContextAppAction} action The action being dispatched.
 * @returns {ContextAppState} The new state.
 */
export const contextAppReducer = (
  state: ContextAppState,
  action: ContextAppAction
): ContextAppState => {
  console.log(
    "[ContextReducer] Action:",
    action.type,
    "Payload:",
    "payload" in action ? action.payload : "N/A"
  );
  switch (action.type) {
    case "CONTEXT_INCREMENT":
      return {
        ...state,
        contextCount: state.contextCount + 1,
      };
    case "CONTEXT_DECREMENT":
      return {
        ...state,
        contextCount: state.contextCount - 1,
      };
    case "CONTEXT_SET_COUNT":
      if (typeof action.payload === "number" && !isNaN(action.payload)) {
        return {
          ...state,
          contextCount: action.payload,
        };
      }
      console.warn(
        "[ContextReducer] CONTEXT_SET_COUNT received invalid payload:",
        action.payload
      );
      return state;
    case "CONTEXT_LOGIN":
      return {
        ...state,
        isContextAuthenticated: true,
        contextUser: action.payload,
      };
    case "CONTEXT_LOGOUT":
      return {
        ...state,
        isContextAuthenticated: false,
        contextUser: null,
      };
    default:
      return state;
  }
};
