export {}

type TelegramWebAppUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
}

type TelegramWebApp = {
  initData: string
  initDataUnsafe: {
    user?: TelegramWebAppUser
  }
  ready: () => void
  expand: () => void
  themeParams: Record<string, string>
  MainButton: {
    text: string
    isVisible: boolean
    show: () => void
    hide: () => void
    onClick: (cb: () => void) => void
    offClick: (cb: () => void) => void
    setText: (text: string) => void
    enable: () => void
    disable: () => void
    showProgress: (leaveActive?: boolean) => void
    hideProgress: () => void
  }
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp
    }
  }
}
