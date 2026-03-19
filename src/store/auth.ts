export interface UserInfo {
  id?: string | number
  nickname?: string
  avatar?: string
  [key: string]: unknown
}

export interface LoginState {
  token: string
  tokenExpireAt: number | null
  userInfo: UserInfo | null
  userInfoFetched: boolean
  fetchUserPromise: Promise<UserInfo | null> | null
}

const loginState: LoginState = {
  token: '',
  tokenExpireAt: null,
  userInfo: null,
  userInfoFetched: false,
  fetchUserPromise: null,
}

export function setToken(token: string, expireAt?: number | string | Date | null): void {
  loginState.token = token
  loginState.tokenExpireAt = normalizeExpireAt(expireAt)
}

export function getToken(): string {
  return loginState.token
}

export function getTokenExpireAt(): number | null {
  return loginState.tokenExpireAt
}

export function setUserInfo(userInfo: UserInfo | null): void {
  loginState.userInfo = userInfo
  loginState.userInfoFetched = Boolean(userInfo)
}

export function setUserInfoFetched(fetched: boolean): void {
  loginState.userInfoFetched = fetched
}

export function setFetchUserPromise(promise: Promise<UserInfo | null> | null): void {
  loginState.fetchUserPromise = promise
}

export function getLoginState(): LoginState {
  return loginState
}

export function clearLoginState(): void {
  loginState.token = ''
  loginState.tokenExpireAt = null
  loginState.userInfo = null
  loginState.userInfoFetched = false
  loginState.fetchUserPromise = null
}

export function isLoginExpired(referenceTime = Date.now()): boolean {
  const { token, tokenExpireAt } = loginState

  if (!token) {
    return true
  }

  if (tokenExpireAt == null) {
    return false
  }

  return tokenExpireAt <= referenceTime
}

export function isAuthenticated(referenceTime = Date.now()): boolean {
  return !isLoginExpired(referenceTime)
}

function normalizeExpireAt(expireAt?: number | string | Date | null): number | null {
  if (expireAt == null) {
    return null
  }

  if (typeof expireAt === 'number') {
    return expireAt
  }

  if (expireAt instanceof Date) {
    return expireAt.getTime()
  }

  const parsed = new Date(expireAt).getTime()
  return Number.isNaN(parsed) ? null : parsed
}
