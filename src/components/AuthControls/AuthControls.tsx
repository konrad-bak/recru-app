import { Button } from "@ui";
import React from "react";
import { useAppDispatch, useAppState } from "../../store/context/AppContext";

const STRINGS = {
  TITLE: "Authentication (Context API)",
  WELCOME: "Welcome,",
  USER: "User",
  LOGOUT: "Logout",
  NOT_LOGGED_IN: "You are not logged in.",
  LOGIN: "Login",
};

const AuthControls: React.FC = () => {
  const { isContextAuthenticated, contextUser } = useAppState();
  const dispatch = useAppDispatch();

  console.log(
    "[AuthControls - Context] Rendering. Auth:",
    isContextAuthenticated,
    "User:",
    contextUser
  );

  const handleLogin = () => {
    dispatch({ type: "CONTEXT_LOGIN", payload: { name: "Context User" } });
  };

  const handleLogout = () => {
    dispatch({ type: "CONTEXT_LOGOUT" });
  };

  return (
    <div style={{ color: "white" }}>
      <h2>{STRINGS.TITLE}</h2>
      {isContextAuthenticated ? (
        <div>
          <p>{`${STRINGS.WELCOME} ${contextUser?.name || "User"}!`}</p>
          <Button onClick={handleLogout}>{STRINGS.LOGOUT}</Button>
        </div>
      ) : (
        <div>
          <p>{STRINGS.NOT_LOGGED_IN}</p>
          <Button onClick={handleLogin}>{STRINGS.LOGIN}</Button>
        </div>
      )}
    </div>
  );
};

export default AuthControls;
