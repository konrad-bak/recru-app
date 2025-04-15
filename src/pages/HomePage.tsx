import { useAuthContext } from "@components/Auth/AuthContext";
import { Button, Header, Text } from "@ui";
import React from "react";
import { Link } from "react-router-dom";
import { Route } from "../routes";

const STRINGS = {
  HELLO: "Hello from home",
  IS_LOGGED_IN: "Is logged in:",
  TOGGLE: "Toggle",
  AVAILABLE_ROUTES: "Available Routes:",
};

export const HomePage: React.FC = () => {
  const routeEntries = Object.values(Route);

  const context = useAuthContext();

  return (
    <div>
      <Header>{STRINGS.HELLO}</Header>
      <Text>{`${STRINGS.IS_LOGGED_IN} ${context.isLoggedIn ? "YES" : "NO"}`}</Text>
      <Button onClick={() => context.toggle()}>{STRINGS.TOGGLE}</Button>

      <h2 style={{ color: "white" }}>{STRINGS.AVAILABLE_ROUTES}</h2>
      <nav>
        <ul style={{ listStyleType: "none", padding: 0, color: "white" }}>
          {routeEntries.map((routeEntry) => (
            <li key={routeEntry.path}>
              <Link to={routeEntry.path}>{routeEntry.title}</Link>
              <span style={{ marginLeft: "10px", color: "#666" }}>
                ({routeEntry.path})
              </span>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};
