import type { browser as wxtBrowser } from 'wxt/browser'
import {
  defineBackground as defineBackgroundFn,
} from 'wxt/utils/define-background'
import {
  defineContentScript as defineContentScriptFn,
} from 'wxt/utils/define-content-script'

declare global {
  const browser: typeof wxtBrowser
  const defineBackground: typeof defineBackgroundFn
  const defineContentScript: typeof defineContentScriptFn
}

declare module '#imports' {
  export { storage } from '@wxt-dev/storage'
}

export {}
