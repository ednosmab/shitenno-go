import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { ErrorBoundary } from "../console/components/error-boundary.js";

// Component that throws on render
function ThrowingComponent(): React.ReactElement {
  throw new Error("Test error");
}

// Component that renders normally
function NormalComponent(): React.ReactElement {
  return React.createElement("text", null, "Hello World");
}

describe("ErrorBoundary", () => {
  const originalError = console.error;
  const originalStackTraceLimit = Error.stackTraceLimit;

  beforeEach(() => {
    console.error = vi.fn();
    Error.stackTraceLimit = 100;
    return () => {
      console.error = originalError;
      Error.stackTraceLimit = originalStackTraceLimit;
    };
  });

  it("should render children when no error", () => {
    const { lastFrame } = render(
      React.createElement(ErrorBoundary, { tabName: "Test", children: React.createElement(NormalComponent) })
    );
    expect(lastFrame()).toContain("Hello World");
  });

  it("should render error fallback when child throws", () => {
    const { lastFrame } = render(
      React.createElement(ErrorBoundary, { tabName: "Goals", children: React.createElement(ThrowingComponent) })
    );
    expect(lastFrame()).toContain("Goals");
    expect(lastFrame()).toContain("encountered an error");
  });

  it("should display error message in fallback", () => {
    const { lastFrame } = render(
      React.createElement(ErrorBoundary, { tabName: "Decisions", children: React.createElement(ThrowingComponent) })
    );
    expect(lastFrame()).toContain("Test error");
  });

  it("should show refresh instructions", () => {
    const { lastFrame } = render(
      React.createElement(ErrorBoundary, { tabName: "Health", children: React.createElement(ThrowingComponent) })
    );
    expect(lastFrame()).toContain("refresh");
  });

  it("should log error to console", () => {
    render(
      React.createElement(ErrorBoundary, { tabName: "Sessions", children: React.createElement(ThrowingComponent) })
    );
    expect(console.error).toHaveBeenCalled();
  });
});
