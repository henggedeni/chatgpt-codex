import { request, type RequestConfig } from '../http/request';

export interface UpdateInfo {
  version: string;
  downloadUrl: string;
  force: boolean;
}

export const checkAppUpdate = (config: Partial<RequestConfig> = {}) =>
  request<UpdateInfo>({
    url: '/api/app/check-update',
    method: 'GET',
    cancelKey: config.cancelKey || 'app:update-check',
    header: config.header,
    timeout: config.timeout,
    showErrorToast: config.showErrorToast,
    ignoreAuth: config.ignoreAuth,
  });
