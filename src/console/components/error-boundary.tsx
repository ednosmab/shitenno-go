/**
 * error-boundary.tsx — Error boundary for individual tabs
 *
 * Catches render errors in tab components and shows a graceful
 * fallback instead of crashing the entire dashboard.
 */

import React from "react";
import { Box, Text } from "ink";

interface ErrorBoundaryProps {
  tabName: string;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error details for debugging
    console.error(`[ErrorBoundary] Tab "${this.props.tabName}" crashed:`, error.message);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <Box flexDirection="column" padding={1}>
          <Box borderStyle="round" borderColor="red" paddingX={1}>
            <Text bold color="red">
              ⚠ Tab "{this.props.tabName}" encountered an error
            </Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>Error: {this.state.error?.message ?? "Unknown error"}</Text>
            <Box marginTop={1}>
              <Text dimColor>Press "r" to refresh or switch to another tab.</Text>
            </Box>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}
