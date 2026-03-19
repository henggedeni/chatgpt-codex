import { type AuthPlatformAdapter, createAuth } from './auth'

export interface HttpErrorLike {
  response?: {
    status?: number
    data?: {
      code?: number | string
      message?: string
      [key: string]: unknown
    }
  }
  code?: number | string
  message?: string
}

export interface HttpInterceptorOptions {
  fetchUserInfo: () => Promise<any>
  unauthorizedCodes?: Array<number | string>
  adapter?: AuthPlatformAdapter
}

export function createResponseErrorInterceptor(options: HttpInterceptorOptions) {
  const auth = createAuth({ fetchUserInfo: options.fetchUserInfo })
  const unauthorizedCodes = new Set(options.unauthorizedCodes ?? [401, '401', 'TOKEN_EXPIRED'])

  return async function responseErrorInterceptor(error: HttpErrorLike): Promise<never> {
    const responseStatus = error.response?.status
    const responseCode = error.response?.data?.code
    const errorCode = error.code

    if (
      responseStatus === 401
      || unauthorizedCodes.has(responseCode ?? '')
      || unauthorizedCodes.has(errorCode ?? '')
    ) {
      await auth.handleUnauthorized(options.adapter)
    }

    throw error
  }
}
