import DefaultTheme from 'vitepress/theme'
import TwoslashFloatingVue from '@shikijs/vitepress-twoslash/client'
import type { EnhanceAppContext } from 'vitepress'
import Layout from './Layout.vue'
import '@shikijs/vitepress-twoslash/style.css'
import './style.css'
import './monaco-widgets.css'
import './example-runner.css'

export default {
  ...DefaultTheme,
  Layout,
  enhanceApp(context: EnhanceAppContext) {
    DefaultTheme.enhanceApp?.(context)
    context.app.use(TwoslashFloatingVue)
  },
}
