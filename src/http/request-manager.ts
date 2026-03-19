export interface RequestTaskLike {
  abort: () => void;
}

export class RequestCanceledError extends Error {
  public readonly isCanceled = true;
  public readonly cancelKey: string;

  constructor(cancelKey: string, message?: string) {
    super(message ?? `Request canceled: ${cancelKey}`);
    this.name = 'RequestCanceledError';
    this.cancelKey = cancelKey;
  }
}

interface RequestRecord {
  key: string;
  task: RequestTaskLike;
}

class RequestManager {
  private readonly requestMap = new Map<string, RequestRecord>();
  private seed = 0;

  createKey(prefix = 'request'): string {
    this.seed += 1;
    return `${prefix}_${Date.now()}_${this.seed}`;
  }

  register(task: RequestTaskLike, cancelKey?: string): string {
    const key = cancelKey || this.createKey();
    const prev = this.requestMap.get(key);
    if (prev) {
      prev.task.abort();
    }

    this.requestMap.set(key, { key, task });
    return key;
  }

  remove(key?: string): void {
    if (!key) {
      return;
    }

    this.requestMap.delete(key);
  }

  cancelRequest(key: string, message?: string): RequestCanceledError | null {
    const record = this.requestMap.get(key);
    if (!record) {
      return null;
    }

    record.task.abort();
    this.requestMap.delete(key);
    return new RequestCanceledError(key, message);
  }

  cancelGroup(prefix: string, message?: string): RequestCanceledError[] {
    const canceled: RequestCanceledError[] = [];

    for (const key of Array.from(this.requestMap.keys())) {
      if (!key.startsWith(prefix)) {
        continue;
      }

      const error = this.cancelRequest(key, message ?? `Request group canceled: ${prefix}`);
      if (error) {
        canceled.push(error);
      }
    }

    return canceled;
  }

  cancelAll(message = 'All requests canceled'): RequestCanceledError[] {
    const keys = Array.from(this.requestMap.keys());
    return keys
      .map((key) => this.cancelRequest(key, message))
      .filter((error): error is RequestCanceledError => Boolean(error));
  }
}

export const requestManager = new RequestManager();

export const cancelRequest = (key: string, message?: string) => requestManager.cancelRequest(key, message);
export const cancelGroup = (prefix: string, message?: string) => requestManager.cancelGroup(prefix, message);
export const cancelAll = (message?: string) => requestManager.cancelAll(message);
