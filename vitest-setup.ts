import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeEach } from "vitest";
// import '@testing-library/jest-dom/vitest';
import "@testing-library/jest-dom";
// import matchers from '@testing-library/jest-dom/matchers';

import { toHaveNoViolations } from "jest-axe";
// import { server } from "./src/mocks/node";

expect.extend(toHaveNoViolations);

beforeEach(() => {
  // server.listen();
});

afterEach(() => {
  cleanup();
  // server.resetHandlers();
});

afterAll(() => {
  // server.close();
});
