import { Button } from "@ui"; // Assuming Button is correctly imported
import React, { useEffect, useState } from "react"; // Added useEffect
import { useUndo } from "../../hooks/useUndo"; // Adjust path if needed

const UndoDemo: React.FC = () => {
  // Example 1: Counter
  const {
    state: count,
    set: setCount,
    reset: resetCount,
    undo: undoCount,
    redo: redoCount,
    canUndo: canUndoCount,
    canRedo: canRedoCount,
  } = useUndo<number>(0);

  // Example 2: Text Input
  const {
    state: text,
    set: setText,
    reset: resetText,
    undo: undoText,
    redo: redoText,
    canUndo: canUndoText,
    canRedo: canRedoText,
  } = useUndo<string>("");

  // Local state for the controlled text input element itself
  const [inputText, setInputText] = useState("");

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputText(newValue); // Update the visual input field immediately
    setText(newValue); // Push the new value into the undo history
  };

  // Update the local input state if the undo/redo action changes the underlying 'text' state
  useEffect(() => {
    // Only update if the input field's value is different from the undo state
    // This prevents potential cursor jumps or issues if they are already in sync
    if (inputText !== text) {
      setInputText(text);
    }
  }, [text, inputText]); // Rerun when the undo state 'text' changes

  console.log(`[UndoDemo] Rendering. Count: ${count}, Text: "${text}"`);

  return (
    <div style={{ color: "white" }}>
      <h2>useUndo Demo</h2>

      <section
        style={{
          border: "1px solid lightcoral",
          padding: "10px",
          marginBottom: "15px",
        }}
      >
        <h3>Counter Example</h3>
        <p>Current Count: {count}</p>
        <Button onClick={() => setCount(count + 1)}>Increment</Button>
        <Button onClick={() => setCount(count - 1)}>Decrement</Button>
        <Button onClick={undoCount} disabled={!canUndoCount}>
          Undo
        </Button>
        <Button onClick={redoCount} disabled={!canRedoCount}>
          Redo
        </Button>
        <Button onClick={() => resetCount(0)}>Reset to 0</Button>
        <div>
          Can Undo: {canUndoCount ? "Yes" : "No"} | Can Redo:{" "}
          {canRedoCount ? "Yes" : "No"}
        </div>
      </section>

      <section style={{ border: "1px solid lightseagreen", padding: "10px" }}>
        <h3>Text Input Example </h3>
        <p>Current Text State (Undo History): "{text}"</p>
        <input
          type="text"
          value={inputText} // Value comes from local state for immediate feedback
          onChange={handleTextChange} // Update both states on change
          placeholder="Type here..."
          style={{ marginRight: "10px", color: "black" }}
        />
        <Button onClick={undoText} disabled={!canUndoText}>
          Undo
        </Button>
        <Button onClick={redoText} disabled={!canRedoText}>
          Redo
        </Button>
        <Button
          onClick={() => {
            resetText(""); // Reset the undo state
          }}
        >
          Reset Text
        </Button>
        <div>
          Can Undo: {canUndoText ? "Yes" : "No"} | Can Redo:{" "}
          {canRedoText ? "Yes" : "No"}
        </div>
      </section>
    </div>
  );
};

export default UndoDemo;
