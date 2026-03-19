/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * App 端统一升级入口。
 *
 * 说明：
 * - 仅在 `APP-PLUS` 条件编译下执行；H5/小程序环境会直接跳过。
 * - 依赖服务端返回统一升级策略，并根据 mode/packageType 执行不同流程。
 * - `force_local`：强制本地安装更新，不允许关闭弹窗。
 * - `force_store`：强制跳转应用市场 / App Store，不允许跳过。
 * - `optional`：支持用户跳过本次更新。
 */

export type UpgradeMode = 'optional' | 'force_local' | 'force_store'
export type UpgradePackageType = 'wgt' | 'apk' | 'hap' | 'store'

export interface UpgradeStrategy {
  hasUpdate: boolean
  version: string
  mode: UpgradeMode
  packageType: UpgradePackageType
  downloadUrl: string
  notes: string[]
  storeUrl?: string
  minNativeVersion?: string
  extra?: Record<string, unknown>
}

export interface UpgradeDevicePayload {
  version: string
  appid: string
  wgtVersion?: string
  platform: 'android' | 'ios' | 'harmony' | 'unknown'
  osVersion?: string
  deviceModel?: string
  channel?: string
}

export interface UpgradeRequestOptions {
  /** 服务端策略接口地址 */
  endpoint: string
  /** 请求头 */
  headers?: Record<string, string>
  /** 附加业务参数 */
  extraPayload?: Record<string, unknown>
  /** 自定义请求实现 */
  fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  /** 自定义提示 */
  title?: string
  /** 跳过提示缓存 key */
  skipStorageKey?: string
}

declare const plus: any
declare const uni: any

type RuntimeLike = typeof plus.runtime

type DownloadResult = {
  filename: string
}

const DEFAULT_TITLE = '发现新版本'
const DEFAULT_SKIP_STORAGE_KEY = 'app_upgrade_skip_version'

export async function checkAppUpgrade(options: UpgradeRequestOptions): Promise<UpgradeStrategy | null> {
  // #ifndef APP-PLUS
  return null
  // #endif

  // #ifdef APP-PLUS
  const runtime = ensurePlusRuntime()
  const payload = await getUpgradeDevicePayload(runtime)
  const strategy = await fetchUpgradeStrategy(options, payload)

  if (!strategy?.hasUpdate) {
    return strategy ?? null
  }

  if (shouldSkipOptionalUpgrade(strategy, options.skipStorageKey)) {
    return strategy
  }

  await handleUpgradeStrategy(strategy, {
    title: options.title ?? DEFAULT_TITLE,
    skipStorageKey: options.skipStorageKey ?? DEFAULT_SKIP_STORAGE_KEY,
  })

  return strategy
  // #endif
}

function ensurePlusRuntime(): RuntimeLike {
  if (typeof plus === 'undefined' || !plus.runtime) {
    throw new Error('plus.runtime 不可用，请仅在 APP-PLUS 环境调用。')
  }

  return plus.runtime
}

async function getUpgradeDevicePayload(runtime: RuntimeLike): Promise<UpgradeDevicePayload> {
  const platformName = String(plus.os?.name ?? '').toLowerCase()
  const platform = normalizePlatform(platformName)

  return {
    version: String(runtime.version ?? ''),
    appid: String(runtime.appid ?? ''),
    wgtVersion: runtime.getProperty ? await getWgtVersion(runtime) : '',
    platform,
    osVersion: String(plus.os?.version ?? ''),
    deviceModel: String(plus.device?.model ?? ''),
    channel: String((plus.runtime?.channel ?? '') || ''),
  }
}

function getWgtVersion(runtime: RuntimeLike): Promise<string> {
  return new Promise((resolve) => {
    runtime.getProperty(runtime.appid, (info: { version?: string }) => {
      resolve(String(info?.version ?? ''))
    })
  })
}

async function fetchUpgradeStrategy(
  options: UpgradeRequestOptions,
  payload: UpgradeDevicePayload,
): Promise<UpgradeStrategy> {
  const fetcher = options.fetcher ?? fetch
  const response = await fetcher(options.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    body: JSON.stringify({
      ...payload,
      ...(options.extraPayload ?? {}),
    }),
  })

  if (!response.ok) {
    throw new Error(`获取升级策略失败：HTTP ${response.status}`)
  }

  const strategy = (await response.json()) as UpgradeStrategy
  validateUpgradeStrategy(strategy)
  return strategy
}

function validateUpgradeStrategy(strategy: UpgradeStrategy): void {
  if (typeof strategy?.hasUpdate !== 'boolean') {
    throw new Error('升级策略缺少 hasUpdate 字段。')
  }

  if (!strategy.hasUpdate) {
    return
  }

  const requiredFields: Array<keyof UpgradeStrategy> = [
    'version',
    'mode',
    'packageType',
    'downloadUrl',
    'notes',
  ]

  for (const field of requiredFields) {
    if (strategy[field] === undefined || strategy[field] === null || strategy[field] === '') {
      throw new Error(`升级策略缺少字段：${field}`)
    }
  }

  if (!Array.isArray(strategy.notes)) {
    throw new Error('升级策略字段 notes 必须为数组。')
  }
}

function shouldSkipOptionalUpgrade(strategy: UpgradeStrategy, storageKey = DEFAULT_SKIP_STORAGE_KEY): boolean {
  if (strategy.mode !== 'optional') {
    return false
  }

  const skippedVersion = uni.getStorageSync(storageKey)
  return skippedVersion === strategy.version
}

async function handleUpgradeStrategy(
  strategy: UpgradeStrategy,
  context: { title: string; skipStorageKey: string },
): Promise<void> {
  switch (strategy.mode) {
    case 'optional':
      await showOptionalUpgradeDialog(strategy, context)
      return
    case 'force_local':
      await showForceLocalUpgradeDialog(strategy, context.title)
      return
    case 'force_store':
      await showForceStoreUpgradeDialog(strategy, context.title)
      return
    default:
      throw new Error(`未知升级模式：${(strategy as UpgradeStrategy).mode}`)
  }
}

async function showOptionalUpgradeDialog(
  strategy: UpgradeStrategy,
  context: { title: string; skipStorageKey: string },
): Promise<void> {
  const res = await uni.showModal({
    title: context.title,
    content: buildUpgradeMessage(strategy),
    confirmText: '立即更新',
    cancelText: '暂不更新',
  })

  if (res.confirm) {
    await executeUpgrade(strategy)
    return
  }

  uni.setStorageSync(context.skipStorageKey, strategy.version)
}

async function showForceLocalUpgradeDialog(strategy: UpgradeStrategy, title: string): Promise<void> {
  await uni.showModal({
    title,
    content: buildUpgradeMessage(strategy),
    showCancel: false,
    confirmText: '立即更新',
  })

  await executeUpgrade(strategy)
}

async function showForceStoreUpgradeDialog(strategy: UpgradeStrategy, title: string): Promise<void> {
  await uni.showModal({
    title,
    content: buildUpgradeMessage(strategy),
    showCancel: false,
    confirmText: '前往更新',
  })

  openStore(strategy)
}

function buildUpgradeMessage(strategy: UpgradeStrategy): string {
  return [`版本：${strategy.version}`, ...strategy.notes.map((item) => `• ${item}`)].join('\n')
}

async function executeUpgrade(strategy: UpgradeStrategy): Promise<void> {
  switch (strategy.packageType) {
    case 'wgt':
      await downloadAndInstallWgt(strategy)
      return
    case 'apk':
    case 'hap':
      await downloadAndInstallNativePackage(strategy)
      return
    case 'store':
      openStore(strategy)
      return
    default:
      throw new Error(`不支持的安装包类型：${(strategy as UpgradeStrategy).packageType}`)
  }
}

async function downloadAndInstallWgt(strategy: UpgradeStrategy): Promise<void> {
  const { filename } = await downloadPackage(strategy.downloadUrl)

  await new Promise<void>((resolve, reject) => {
    plus.runtime.install(
      filename,
      { force: true },
      () => {
        plus.nativeUI.alert('更新完成，应用即将重启。', () => {
          plus.runtime.restart()
          resolve()
        })
      },
      (error: { code?: number; message?: string }) => {
        reject(new Error(`WGT 安装失败：${error?.code ?? ''} ${error?.message ?? ''}`.trim()))
      },
    )
  })
}

async function downloadAndInstallNativePackage(strategy: UpgradeStrategy): Promise<void> {
  const { filename } = await downloadPackage(strategy.downloadUrl)
  const platform = normalizePlatform(String(plus.os?.name ?? '').toLowerCase())

  if (platform === 'ios') {
    openStore(strategy)
    return
  }

  if (platform !== 'android' && platform !== 'harmony') {
    throw new Error(`当前平台 ${platform} 不支持本地安装 ${strategy.packageType}。`)
  }

  await new Promise<void>((resolve, reject) => {
    plus.runtime.openFile(
      filename,
      {},
      () => resolve(),
      (error: { code?: number; message?: string }) => {
        reject(new Error(`打开安装包失败：${error?.code ?? ''} ${error?.message ?? ''}`.trim()))
      },
    )
  })
}

function openStore(strategy: UpgradeStrategy): void {
  const platform = normalizePlatform(String(plus.os?.name ?? '').toLowerCase())
  const url = strategy.storeUrl || strategy.downloadUrl

  if (!url) {
    throw new Error('缺少应用市场跳转地址。')
  }

  if (platform === 'ios') {
    plus.runtime.openURL(url)
    return
  }

  if (platform === 'android' || platform === 'harmony') {
    plus.runtime.openURL(url)
    return
  }

  throw new Error(`当前平台 ${platform} 不支持应用市场跳转。`)
}

async function downloadPackage(downloadUrl: string): Promise<DownloadResult> {
  plus.nativeUI.showWaiting('正在下载更新包...')

  try {
    return await new Promise<DownloadResult>((resolve, reject) => {
      const dtask = plus.downloader.createDownload(
        downloadUrl,
        {
          filename: '_doc/update/',
          retry: 1,
        },
        (download: { filename?: string }, status: number) => {
          plus.nativeUI.closeWaiting()

          if (status === 200) {
            resolve({ filename: String(download?.filename ?? '') })
            return
          }

          reject(new Error(`下载更新包失败，状态码：${status}`))
        },
      )

      dtask.start()
    })
  } catch (error) {
    plus.nativeUI.closeWaiting()
    throw error
  }
}

function normalizePlatform(platformName: string): UpgradeDevicePayload['platform'] {
  if (platformName.includes('android')) {
    return 'android'
  }

  if (platformName.includes('ios') || platformName.includes('iphone')) {
    return 'ios'
  }

  if (platformName.includes('harmony') || platformName.includes('ohos')) {
    return 'harmony'
  }

  return 'unknown'
}
