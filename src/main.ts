import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import uviewPro from 'uview-pro'
import App from './App.vue'
import 'uview-pro/theme.scss'
import '@/static/styles/index.scss'

export function createApp() {
  const app = createSSRApp(App)
  const pinia = createPinia()

  app.use(pinia)
  app.use(uviewPro)

  return {
    app,
    pinia,
  }
}
