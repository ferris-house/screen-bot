// src/main/utils/shortcuts.ts

// 平台特定的快捷键映射
const PLATFORM_SHORTCUTS = {
  darwin: {
    search: { key: 'f', modifier: 'command' },
    paste: { key: 'v', modifier: 'command' },
    selectAll: { key: 'a', modifier: 'command' }
  },
  win32: {
    search: { key: 'f', modifier: 'control' },
    paste: { key: 'v', modifier: 'control' },
    selectAll: { key: 'a', modifier: 'control' }
  }
}

type ShortcutAction = 'search' | 'paste' | 'selectAll'
type Shortcut = { key: string; modifier: string }

export function getShortcut(action: ShortcutAction): Shortcut {
  const platform = process.platform
  const shortcuts = PLATFORM_SHORTCUTS[platform as keyof typeof PLATFORM_SHORTCUTS] || PLATFORM_SHORTCUTS.win32
  return shortcuts[action] || shortcuts.paste
}

export { PLATFORM_SHORTCUTS }