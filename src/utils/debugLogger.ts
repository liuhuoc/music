type LogListener = (msg: string) => void;

class DebugLogger {
  private listeners: Set<LogListener> = new Set();
  private logs: string[] = [];
  private maxLogs = 100;

  addListener(listener: LogListener): () => void {
    this.listeners.add(listener);
    this.logs.forEach(log => listener(log));
    return () => {
      this.listeners.delete(listener);
    };
  }

  log(message: string) {
    const time = new Date().toLocaleTimeString();
    const formatted = `[${time}] ${message}`;
    this.logs.push(formatted);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    this.listeners.forEach(l => l(formatted));
    console.log(message);
  }

  error(message: string) {
    this.log(`[ERROR] ${message}`);
    console.error(message);
  }

  warn(message: string) {
    this.log(`[WARN] ${message}`);
    console.warn(message);
  }

  getLogs() {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
  }
}

export const debugLogger = new DebugLogger();
