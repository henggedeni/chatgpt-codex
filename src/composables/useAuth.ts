import {
  clearLoginState,
  getLoginState,
  getToken,
  isAuthenticated,
  isLoginExpired,
  setFetchUserPromise,
  setUserInfo,
  setUserInfoFetched,
  type UserInfo,
} from '../store/auth'

export interface EnsureUserInfoResult {
  authenticated: boolean
  expired: boolean
  userInfo: UserInfo | null
}

export interface AuthPlatformAdapter {
  redirectToLogin?: () => void | Promise<void>
  promptRelogin?: () => void | Promise<void>
}

export interface EnsureUserInfoOptions {
  fetchUserInfo: () => Promise<UserInfo>
}

export function createAuth(options: EnsureUserInfoOptions) {
  const { fetchUserInfo } = options

  async function ensureUserInfo(): Promise<EnsureUserInfoResult> {
    if (!getToken() || isLoginExpired()) {
      clearLoginState()
      return buildLoggedOutResult()
    }

    const state = getLoginState()

    if (state.userInfo && state.userInfoFetched) {
      return {
        authenticated: true,
        expired: false,
        userInfo: state.userInfo,
      }
    }

    if (state.fetchUserPromise) {
      const userInfo = await state.fetchUserPromise
      return {
        authenticated: isAuthenticated(),
        expired: isLoginExpired(),
        userInfo,
      }
    }

    const request = fetchUserInfo()
      .then((userInfo) => {
        setUserInfo(userInfo)
        setUserInfoFetched(true)
        return userInfo
      })
      .catch((error) => {
        setUserInfo(null)
        setUserInfoFetched(false)
        throw error
      })
      .finally(() => {
        setFetchUserPromise(null)
      })

    setFetchUserPromise(request)

    const userInfo = await request
    return {
      authenticated: true,
      expired: false,
      userInfo,
    }
  }

  async function handleUnauthorized(adapter?: AuthPlatformAdapter): Promise<void> {
    clearLoginState()

    if (adapter?.redirectToLogin) {
      await adapter.redirectToLogin()
      return
    }

    if (adapter?.promptRelogin) {
      await adapter.promptRelogin()
    }
  }

  function createPageOnShowGuard(onAuthed?: (result: EnsureUserInfoResult) => void | Promise<void>) {
    return async function onShowGuard(): Promise<EnsureUserInfoResult> {
      const result = await ensureUserInfo()
      if (result.authenticated && onAuthed) {
        await onAuthed(result)
      }
      return result
    }
  }

  return {
    ensureUserInfo,
    handleUnauthorized,
    createPageOnShowGuard,
    isAuthenticated,
    isLoginExpired,
  }
}

function buildLoggedOutResult(): EnsureUserInfoResult {
  return {
    authenticated: false,
    expired: true,
    userInfo: null,
  }
}
