import { Button } from "@ui";
import React, { useState } from "react";
import { useWebWorker } from "../../hooks/useWebWorker"; // Adjust path if needed

function calculateFibonacci(n: number): number {
  if (n <= 1) {
    return n;
  }
  // Recursive calculation - intentionally slow for higher numbers
  return calculateFibonacci(n - 1) + calculateFibonacci(n - 2);
}

// Function to run the calculation on the main thread for comparison
const calculateFibonacciMainThread = (n: number): number => {
  console.time(`Fibonacci Main Thread (${n})`);
  const result = calculateFibonacci(n);
  console.timeEnd(`Fibonacci Main Thread (${n})`);
  return result;
};

const WebWorkerDemo: React.FC = () => {
  const [inputValue, setInputValue] = useState<string>("35");
  const [mainThreadResult, setMainThreadResult] = useState<number | null>(null);
  const [mainThreadRunning, setMainThreadRunning] = useState<boolean>(false);

  // Initialize the web worker with the fibonacci function
  const {
    data: workerResult,
    error: workerError,
    isRunning: workerIsRunning,
    run: runWorkerCalculation,
    terminate: terminateWorker,
  } = useWebWorker<number, number>(calculateFibonacci);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleRunWorker = () => {
    const num = parseInt(inputValue, 10);
    if (!isNaN(num) && num >= 0) {
      console.log(`[WebWorkerDemo] Requesting worker calculation for ${num}`);
      runWorkerCalculation(num);
    } else {
      alert("Please enter a non-negative integer.");
    }
  };

  const handleRunMainThread = () => {
    const num = parseInt(inputValue, 10);
    if (!isNaN(num) && num >= 0) {
      console.log(
        `[WebWorkerDemo] Starting main thread calculation for ${num}`
      );
      setMainThreadRunning(true);
      setMainThreadResult(null);
      setTimeout(() => {
        try {
          const result = calculateFibonacciMainThread(num);
          setMainThreadResult(result);
        } catch (err) {
          console.error("Main thread calculation error:", err);
          setMainThreadResult(null);
        } finally {
          setMainThreadRunning(false);
          console.log(
            `[WebWorkerDemo] Finished main thread calculation for ${num}`
          );
        }
      }, 0);
    } else {
      alert("Please enter a non-negative integer.");
    }
  };

  console.log(`[WebWorkerDemo] Rendering. Worker Running: ${workerIsRunning}`);

  return (
    <div style={{ color: "white" }}>
      <h2>useWebWorker Demo (Fibonacci Calculation)</h2>
      <p>
        Calculates the nth Fibonacci number. This is computationally intensive
        for larger numbers. Try values around 35-42 to observe the difference.
      </p>

      <label>
        Calculate Fibonacci for n ={" "}
        <input
          type="number"
          value={inputValue}
          onChange={handleInputChange}
          min="0"
          style={{ color: "black" }}
        />
      </label>

      <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
        {/* Worker Section */}
        <section style={{ border: "1px solid gold", padding: "10px", flex: 1 }}>
          <h3>Using Web Worker</h3>
          <Button onClick={handleRunWorker} disabled={workerIsRunning}>
            {workerIsRunning ? "Calculating..." : "Run in Worker"}
          </Button>
          <Button
            onClick={terminateWorker}
            disabled={!workerIsRunning}
            style={{ marginLeft: "5px" }}
          >
            Terminate Worker
          </Button>
          {workerError && (
            <p style={{ color: "red" }}>Worker Error: {workerError}</p>
          )}
          {workerResult !== null && (
            <p>
              Result: <strong>{workerResult}</strong>
            </p>
          )}
        </section>

        {/* Main Thread Section */}
        <section
          style={{ border: "1px solid tomato", padding: "10px", flex: 1 }}
        >
          <h3>Using Main Thread (Blocks UI)</h3>
          <Button onClick={handleRunMainThread} disabled={mainThreadRunning}>
            {mainThreadRunning ? "Calculating..." : "Run on Main Thread"}
          </Button>
          {mainThreadRunning && (
            <p>Calculating on main thread... UI might freeze!</p>
          )}
          {mainThreadResult !== null && (
            <p>
              Result: <strong>{mainThreadResult}</strong>
            </p>
          )}
        </section>
      </div>
    </div>
  );
};

export default WebWorkerDemo;
