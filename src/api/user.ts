import { request, type RequestConfig } from '../http/request';

export interface UserProfile {
  id: string;
  nickname: string;
  avatar: string;
}

export const getUserProfile = (config: Partial<RequestConfig> = {}) =>
  request<UserProfile>({
    url: '/api/user/profile',
    method: 'GET',
    cancelKey: config.cancelKey || 'user:profile',
    header: config.header,
    timeout: config.timeout,
    showErrorToast: config.showErrorToast,
    ignoreAuth: config.ignoreAuth,
  });
