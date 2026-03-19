import { request, type RequestConfig } from '../http/request';

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
}

export const login = (data: LoginPayload, config: Partial<RequestConfig<LoginPayload>> = {}) =>
  request<LoginResponse>({
    url: '/api/auth/login',
    method: 'POST',
    data,
    cancelKey: config.cancelKey || 'auth:login',
    showErrorToast: config.showErrorToast,
    header: config.header,
    timeout: config.timeout,
    ignoreAuth: true,
  });
