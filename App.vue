<script lang="ts">
import { checkMiniProgramUpdate } from './src/upgrade/mp-update'

export default {
  onLaunch() {
    checkMiniProgramUpdate({
      mode: 'normal',
      currentVersion: '1.0.0',
      requestRemoteVersion: async () => {
        return {
          version: '1.0.0',
          note: '检测到新版本时，请关闭后重新进入小程序完成更新。',
          force: false,
        }
      },
      onLog: (payload) => {
        console.info('[app-update]', payload)
      },
    }, {
      onFail: (stage, detail) => {
        console.warn('[app-update:fail]', stage, detail)
      },
      onCancel: (detail) => {
        console.warn('[app-update:cancel]', detail)
      },
    })
  },
}
</script>
