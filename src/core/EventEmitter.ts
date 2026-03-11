type Listener<T = unknown> = (data: T) => void;

export class EventEmitter {
  private listeners: Map<string, Set<Listener>> = new Map();

  on<T = unknown>(event: string, callback: Listener<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as Listener);
  }

  off<T = unknown>(event: string, callback: Listener<T>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback as Listener);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit<T = unknown>(event: string, data?: T): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const cb of set) {
        cb(data);
      }
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
