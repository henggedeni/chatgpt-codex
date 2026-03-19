export type MiniProgramUpdatePromptMode = 'force' | 'normal'

export interface MiniProgramUpdateOptions {
  mode?: MiniProgramUpdatePromptMode
  currentVersion?: string
  requestRemoteVersion?: () => Promise<MiniProgramRemoteVersionResult>
  onLog?: (payload: MiniProgramUpdateLogPayload) => void
}

export interface MiniProgramRemoteVersionResult {
  version: string
  note?: string
  force?: boolean
}

export interface MiniProgramUpdateLogPayload {
  platform: MiniProgramPlatform
  stage: MiniProgramUpdateStage
  message: string
  detail?: unknown
}

export interface MiniProgramUpdateCallbacks {
  onCheck?(hasUpdate: boolean, detail?: unknown): void
  onReady?(detail?: unknown): void
  onFail?(stage: MiniProgramUpdateStage, detail?: unknown): void
  onCancel?(detail?: unknown): void
}

export interface MiniProgramUpdateContext extends Required<Pick<MiniProgramUpdateOptions, 'mode'>> {
  currentVersion?: string
  requestRemoteVersion?: () => Promise<MiniProgramRemoteVersionResult>
  onLog: (payload: MiniProgramUpdateLogPayload) => void
}

export type MiniProgramPlatform = 'MP-WEIXIN' | 'MP-TOUTIAO' | 'MP-ALIPAY' | 'UNKNOWN'
export type MiniProgramUpdateStage =
  | 'detect_start'
  | 'detect_success'
  | 'detect_fail'
  | 'download_start'
  | 'download_success'
  | 'download_fail'
  | 'apply_start'
  | 'apply_success'
  | 'apply_fail'
  | 'user_cancel'
  | 'unsupported'

interface PlatformUpdateManagerLike {
  onCheckForUpdate?(callback: (result: { hasUpdate?: boolean; hasUpdateVersion?: boolean }) => void): void
  onUpdateReady?(callback: () => void): void
  onUpdateFailed?(callback: (detail?: unknown) => void): void
  onError?(callback: (detail?: unknown) => void): void
  applyUpdate?(): void
  applyUpdateSync?(): void
}

const DEFAULT_UPDATE_COPY = {
  title: '发现新版本',
  content: '新版本已经准备就绪，是否立即重启应用？',
  cancelText: '稍后',
  confirmText: '立即重启',
  forceConfirmText: '重启更新',
}

function logUpdate(context: MiniProgramUpdateContext, stage: MiniProgramUpdateStage, message: string, detail?: unknown) {
  const payload: MiniProgramUpdateLogPayload = {
    platform: getMiniProgramPlatform(),
    stage,
    message,
    detail,
  }
  context.onLog(payload)
}

function createDefaultContext(options: MiniProgramUpdateOptions = {}): MiniProgramUpdateContext {
  return {
    mode: options.mode ?? 'normal',
    currentVersion: options.currentVersion,
    requestRemoteVersion: options.requestRemoteVersion,
    onLog: options.onLog ?? ((payload) => console.info('[mp-update]', payload)),
  }
}

function showModal(options: {
  title: string
  content: string
  showCancel?: boolean
  cancelText?: string
  confirmText?: string
  success?: (result: { confirm: boolean; cancel: boolean }) => void
}) {
  if (typeof uni !== 'undefined' && typeof uni.showModal === 'function') {
    uni.showModal(options)
    return
  }

  options.success?.({ confirm: true, cancel: false })
}

function getMiniProgramPlatform(): MiniProgramPlatform {
  // #ifdef MP-WEIXIN
  return 'MP-WEIXIN'
  // #endif
  // #ifdef MP-TOUTIAO
  return 'MP-TOUTIAO'
  // #endif
  // #ifdef MP-ALIPAY
  return 'MP-ALIPAY'
  // #endif
  return 'UNKNOWN'
}

function promptApplyUpdate(manager: PlatformUpdateManagerLike, context: MiniProgramUpdateContext, callbacks: MiniProgramUpdateCallbacks) {
  callbacks.onReady?.()
  logUpdate(context, 'download_success', '新版本下载完成，准备提示用户重启。')

  showModal({
    title: DEFAULT_UPDATE_COPY.title,
    content: DEFAULT_UPDATE_COPY.content,
    showCancel: context.mode !== 'force',
    cancelText: DEFAULT_UPDATE_COPY.cancelText,
    confirmText: context.mode === 'force' ? DEFAULT_UPDATE_COPY.forceConfirmText : DEFAULT_UPDATE_COPY.confirmText,
    success: ({ confirm, cancel }) => {
      if (!confirm) {
        logUpdate(context, 'user_cancel', '用户暂不重启以应用更新。', { cancel })
        callbacks.onCancel?.({ cancel })
        return
      }

      try {
        logUpdate(context, 'apply_start', '开始应用更新。')
        if (typeof manager.applyUpdate === 'function') {
          manager.applyUpdate()
        } else if (typeof manager.applyUpdateSync === 'function') {
          manager.applyUpdateSync()
        }
        logUpdate(context, 'apply_success', '已调用原生更新应用接口。')
      } catch (error) {
        logUpdate(context, 'apply_fail', '调用原生更新应用接口失败。', error)
        callbacks.onFail?.('apply_fail', error)
      }
    },
  })
}

function wireCommonLifecycle(manager: PlatformUpdateManagerLike, context: MiniProgramUpdateContext, callbacks: MiniProgramUpdateCallbacks) {
  manager.onCheckForUpdate?.((result) => {
    const hasUpdate = Boolean(result?.hasUpdate ?? result?.hasUpdateVersion)
    logUpdate(context, 'detect_success', '完成新版本检测。', result)
    if (hasUpdate) {
      logUpdate(context, 'download_start', '检测到新版本，等待下载完成。', result)
    }
    callbacks.onCheck?.(hasUpdate, result)
  })

  manager.onUpdateReady?.(() => {
    promptApplyUpdate(manager, context, callbacks)
  })

  const onDownloadFail = (detail?: unknown) => {
    logUpdate(context, 'download_fail', '新版本下载失败。', detail)
    callbacks.onFail?.('download_fail', detail)
  }

  manager.onUpdateFailed?.(onDownloadFail)
  manager.onError?.((detail) => {
    logUpdate(context, 'detect_fail', '更新管理器发生异常。', detail)
    callbacks.onFail?.('detect_fail', detail)
  })
}

// #ifdef MP-WEIXIN
function runWeixinUpdate(context: MiniProgramUpdateContext, callbacks: MiniProgramUpdateCallbacks) {
  logUpdate(context, 'detect_start', '开始检查微信小程序更新。')

  if (typeof wx === 'undefined' || typeof wx.getUpdateManager !== 'function') {
    logUpdate(context, 'unsupported', '当前环境不支持微信小程序更新管理器。')
    callbacks.onFail?.('unsupported', 'wx.getUpdateManager is unavailable')
    return
  }

  const manager = wx.getUpdateManager()
  wireCommonLifecycle(manager, context, callbacks)
}
// #endif

// #ifdef MP-TOUTIAO
function normalizeToutiaoManager(rawManager: any): PlatformUpdateManagerLike {
  return {
    onCheckForUpdate: rawManager?.onCheckForUpdate?.bind(rawManager),
    onUpdateReady: rawManager?.onUpdateReady?.bind(rawManager),
    onUpdateFailed: rawManager?.onUpdateFailed?.bind(rawManager),
    onError: rawManager?.onError?.bind(rawManager),
    applyUpdate: rawManager?.applyUpdate?.bind(rawManager) ?? rawManager?.applyUpdateSync?.bind(rawManager),
    applyUpdateSync: rawManager?.applyUpdateSync?.bind(rawManager),
  }
}

function runToutiaoUpdate(context: MiniProgramUpdateContext, callbacks: MiniProgramUpdateCallbacks) {
  logUpdate(context, 'detect_start', '开始检查抖音/头条小程序更新。')

  const factory = typeof tt !== 'undefined' ? tt.getUpdateManager : undefined
  if (typeof factory !== 'function') {
    logUpdate(context, 'unsupported', '当前环境不支持抖音/头条小程序更新管理器。')
    callbacks.onFail?.('unsupported', 'tt.getUpdateManager is unavailable')
    return
  }

  const manager = normalizeToutiaoManager(factory())
  wireCommonLifecycle(manager, context, callbacks)
}
// #endif

// #ifdef MP-ALIPAY
async function runAlipayFallbackUpdate(context: MiniProgramUpdateContext, callbacks: MiniProgramUpdateCallbacks) {
  logUpdate(context, 'detect_start', '开始执行支付宝小程序版本兜底检测。')

  if (typeof context.requestRemoteVersion !== 'function') {
    logUpdate(context, 'unsupported', '未提供支付宝版本比对接口，无法继续检测。')
    callbacks.onFail?.('unsupported', 'requestRemoteVersion is required on MP-ALIPAY')
    return
  }

  try {
    const remote = await context.requestRemoteVersion()
    const hasUpdate = Boolean(remote?.version && remote.version !== context.currentVersion)

    callbacks.onCheck?.(hasUpdate, remote)
    logUpdate(context, 'detect_success', '完成支付宝小程序版本比对。', {
      currentVersion: context.currentVersion,
      remoteVersion: remote?.version,
      force: remote?.force,
    })

    if (!hasUpdate) {
      return
    }

    const force = remote.force || context.mode === 'force'
    showModal({
      title: DEFAULT_UPDATE_COPY.title,
      content: remote.note || `检测到新版本 ${remote.version}，请关闭当前小程序后重新进入。`,
      showCancel: !force,
      cancelText: DEFAULT_UPDATE_COPY.cancelText,
      confirmText: force ? '我知道了' : '稍后处理',
      success: ({ confirm, cancel }) => {
        if (!confirm) {
          logUpdate(context, 'user_cancel', '用户暂不处理支付宝小程序更新提示。', { cancel })
          callbacks.onCancel?.({ cancel })
          return
        }

        logUpdate(context, 'apply_success', '已提示支付宝用户关闭并重新进入小程序以完成更新。', remote)
        callbacks.onReady?.(remote)
      },
    })
  } catch (error) {
    logUpdate(context, 'detect_fail', '支付宝版本比对失败。', error)
    callbacks.onFail?.('detect_fail', error)
  }
}
// #endif

export function checkMiniProgramUpdate(options: MiniProgramUpdateOptions = {}, callbacks: MiniProgramUpdateCallbacks = {}) {
  const context = createDefaultContext(options)

  // #ifdef MP-WEIXIN
  runWeixinUpdate(context, callbacks)
  return
  // #endif

  // #ifdef MP-TOUTIAO
  runToutiaoUpdate(context, callbacks)
  return
  // #endif

  // #ifdef MP-ALIPAY
  void runAlipayFallbackUpdate(context, callbacks)
  return
  // #endif

  logUpdate(context, 'unsupported', '当前运行环境不是受支持的小程序平台。')
  callbacks.onFail?.('unsupported', 'unsupported platform')
}
