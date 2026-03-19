import {
  requestManager,
  RequestCanceledError,
  type RequestTaskLike,
} from './request-manager';

export type RequestMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'PATCH'
  | 'OPTIONS'
  | 'HEAD';

export interface RequestConfig<TData = unknown> {
  url: string;
  method?: RequestMethod;
  data?: TData;
  header?: Record<string, string>;
  timeout?: number;
  cancelKey?: string;
  ignoreAuth?: boolean;
  showErrorToast?: boolean;
}

export interface RequestResult<T> extends Promise<T> {
  abort: () => void;
  cancelKey: string;
  task: RequestTaskLike;
}

const DEFAULT_TIMEOUT = 15000;
const DEFAULT_ERROR_MESSAGE = '网络请求失败';
const STORAGE_TOKEN_KEY = 'token';
const CANCELED_ERR_MSG = 'request:fail abort';

type UniRequestSuccess<T> = {
  data: T;
  statusCode: number;
  header: Record<string, string>;
  errMsg: string;
};

type UniRequestFail = {
  errMsg?: string;
  [key: string]: unknown;
};

type UniRequestTask = RequestTaskLike;

type UniNamespace = {
  request: <T>(options: {
    url: string;
    method: RequestMethod;
    data?: unknown;
    header?: Record<string, string>;
    timeout: number;
    success: (result: UniRequestSuccess<T>) => void;
    fail: (error: UniRequestFail) => void;
    complete: () => void;
  }) => UniRequestTask;
  getStorageSync?: (key: string) => string | undefined;
  showToast?: (options: { title: string; icon: 'none' }) => void;
};

declare const uni: UniNamespace;

const isCanceledByUni = (error: UniRequestFail): boolean => {
  const errMsg = String(error?.errMsg || '');
  return errMsg.includes('abort') || errMsg === CANCELED_ERR_MSG;
};

const getToken = (): string => {
  if (typeof uni.getStorageSync !== 'function') {
    return '';
  }

  return uni.getStorageSync(STORAGE_TOKEN_KEY) || '';
};

const showErrorToast = (message: string, enabled = true): void => {
  if (!enabled || typeof uni.showToast !== 'function') {
    return;
  }

  uni.showToast({
    title: message,
    icon: 'none',
  });
};

export const request = <T = unknown>(config: RequestConfig = {} as RequestConfig): RequestResult<T> => {
  const {
    url,
    method = 'GET',
    data,
    header = {},
    timeout = DEFAULT_TIMEOUT,
    cancelKey,
    ignoreAuth = false,
    showErrorToast: needErrorToast = true,
  } = config;

  let settled = false;
  let currentCancelKey = cancelKey || requestManager.createKey();
  let resolvePromise: (value: T | PromiseLike<T>) => void = () => undefined;
  let rejectPromise: (reason?: unknown) => void = () => undefined;

  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  }) as RequestResult<T>;

  const requestHeaders = { ...header };
  if (!ignoreAuth) {
    const token = getToken();
    if (token) {
      requestHeaders.Authorization = requestHeaders.Authorization || `Bearer ${token}`;
    }
  }

  const task = uni.request<T>({
    url,
    method,
    data,
    header: requestHeaders,
    timeout,
    success: (response) => {
      settled = true;
      resolvePromise(response.data);
    },
    fail: (error) => {
      settled = true;
      if (isCanceledByUni(error)) {
        rejectPromise(new RequestCanceledError(currentCancelKey, error.errMsg));
        return;
      }

      showErrorToast(String(error?.errMsg || DEFAULT_ERROR_MESSAGE), needErrorToast);
      rejectPromise(error);
    },
    complete: () => {
      requestManager.remove(currentCancelKey);
    },
  });

  currentCancelKey = requestManager.register(task, currentCancelKey);
  promise.cancelKey = currentCancelKey;
  promise.task = task;
  promise.abort = () => {
    if (settled) {
      return;
    }

    const canceledError = requestManager.cancelRequest(currentCancelKey) || new RequestCanceledError(currentCancelKey);
    rejectPromise(canceledError);
  };

  return promise;
};

export { RequestCanceledError } from './request-manager';
