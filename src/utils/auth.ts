export {
  clearLoginState,
  getLoginState,
  getToken,
  getTokenExpireAt,
  isAuthenticated,
  isLoginExpired,
  setToken,
  setUserInfo,
  setUserInfoFetched,
  type LoginState,
  type UserInfo,
} from '../store/auth'

export {
  createAuth,
  type AuthPlatformAdapter,
  type EnsureUserInfoOptions,
  type EnsureUserInfoResult,
} from '../composables/useAuth'
