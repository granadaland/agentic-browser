import { create } from 'zustand'

export interface LogEntry {
  source: string;
  message: string;
  level: 'info' | 'error' | 'warning';
  timestamp: string;
}

export interface ExecutionResult {
  status: string;
  message?: string;
  error?: string;
  result?: Record<string, unknown>;
}

interface AppState {
  // Task input
  taskInput: string;
  setTaskInput: (input: string) => void;
  
  // Logging
  logs: LogEntry[];
  addLog: (log: LogEntry) => void;
  clearLogs: () => void;
  
  // Execution state
  isExecuting: boolean;
  startExecution: () => void;
  stopExecution: () => void;
  
  // Execution result
  executionResult: ExecutionResult | null;
  setExecutionResult: (result: ExecutionResult | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Task input
  taskInput: '',
  setTaskInput: (input: string) => set({ taskInput: input }),
  
  // Logging
  logs: [],
  addLog: (log: LogEntry) => 
    set((state) => ({ 
      logs: [...state.logs, log].slice(-1000) // Keep last 1000 logs
    })),
  clearLogs: () => set({ logs: [] }),
  
  // Execution state
  isExecuting: false,
  startExecution: () => set({ isExecuting: true }),
  stopExecution: () => set({ isExecuting: false }),
  
  // Execution result
  executionResult: null,
  setExecutionResult: (result: ExecutionResult | null) => 
    set({ executionResult: result, isExecuting: result?.status === 'running' })
}))