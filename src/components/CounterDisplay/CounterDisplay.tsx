import { Button } from "@ui";
import React from "react";
import { useAppDispatch, useAppState } from "../../store/context/AppContext";

const STRINGS = {
  TITLE: "Counter (Context API)",
  CURRENT_COUNT: "Current Count: ",
  INCREMENT: "Increment",
  DECREMENT: "Decrement",
  SET_TO_10: "Set to 10",
};

const CounterDisplay: React.FC = () => {
  const { contextCount } = useAppState();
  const dispatch = useAppDispatch();

  console.log("[CounterDisplay - Context] Rendering. Count:", contextCount);

  const handleIncrement = () => {
    dispatch({ type: "CONTEXT_INCREMENT" });
  };

  const handleDecrement = () => {
    dispatch({ type: "CONTEXT_DECREMENT" });
  };

  const handleSetTo10 = () => {
    dispatch({ type: "CONTEXT_SET_COUNT", payload: 10 });
  };

  return (
    <div style={{ color: "white" }}>
      <h2>{STRINGS.TITLE}</h2>
      <p>{`${STRINGS.CURRENT_COUNT} ${contextCount}`}</p>
      <Button onClick={handleIncrement}>{STRINGS.INCREMENT}</Button>
      <Button onClick={handleDecrement}>{STRINGS.DECREMENT}</Button>
      <Button onClick={handleSetTo10}>{STRINGS.SET_TO_10}</Button>
    </div>
  );
};

export default CounterDisplay;
