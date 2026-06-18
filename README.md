# 识流微信运营助手 Lite - Screen Bot

一个基于 **Electron + React + TypeScript** 的企业微信/微信自动化工具，帮助运营人员自动发送消息、图片，支持远程队列任务调度。

> **项目类型**：桌面端自动化应用  
> **适用场景**：企业微信群发、客户服务、营销推广等批量消息发送场景

---

## 📖 目录

- [业务逻辑](#业务逻辑)
  - [核心功能](#核心功能)
  - [工作原理](#工作原理)
  - [应用场景](#应用场景)
- [Electron 架构详解](#electron-架构详解)
  - [三大核心进程](#三大核心进程)
  - [进程通信机制](#进程通信机制)
  - [安全模型](#安全模型)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [技术栈](#技术栈)
- [常见问题](#常见问题)

---

## 业务逻辑

### 核心功能

#### 1. **手动测试模式**
- **功能**：在界面配置群聊名称和消息内容，点击按钮即可发送
- **支持类型**：文本消息、图片（base64）
- **实现原理**：
  1. 用户在 React 界面输入目标群聊名称（如"运营群"）
  2. 添加待发送的文本/图片到消息列表
  3. 点击"发送"后触发主进程自动化流程：
     - 使用 `robotjs` 模拟键盘快捷键 `Ctrl+F`（Win）/`Cmd+F`（Mac）打开微信搜索
     - 通过剪贴板粘贴群聊名称
     - 模拟 `Enter` 进入聊天窗口
     - 依次粘贴消息内容并发送

#### 2. **远程队列模式（核心特性）**
- **功能**：定期轮询远程 API，自动获取并执行发送任务
- **配置项**：
  - `queueUrl`：任务队列 API 地址（如 `https://api.example.com`）
  - `token`：授权令牌（Bearer Token）
  - `agentId`：当前节点标识（支持多节点并发）
  - `intervalSeconds`：轮询间隔（最小 10 秒）

- **工作流程**：
  ```
  ┌─────────────────────────────────────────────────────────┐
  │  1. 定时轮询（每 N 秒）                                  │
  │     POST /tasks/claim { agentId, limit: 1 }             │
  └────────────────┬────────────────────────────────────────┘
                   │
                   ▼
  ┌─────────────────────────────────────────────────────────┐
  │  2. 解析任务数据                                         │
  │     { id, targets: ['群聊A', '群聊B'],                  │
  │       items: [{ type: 'text', content: '...' }] }       │
  └────────────────┬────────────────────────────────────────┘
                   │
                   ▼
  ┌─────────────────────────────────────────────────────────┐
  │  3. 逐个目标执行发送                                     │
  │     - 搜索并打开群聊                                     │
  │     - 依次发送所有 items                                 │
  │     - 记录每个目标的结果（成功/失败）                     │
  └────────────────┬────────────────────────────────────────┘
                   │
                   ▼
  ┌─────────────────────────────────────────────────────────┐
  │  4. 回传执行结果                                         │
  │     POST /tasks/{taskId}/result                         │
  │     { status, results, startedAt, finishedAt }          │
  └─────────────────────────────────────────────────────────┘
  ```

- **容错机制**：
  - 单个群聊发送失败不影响其他群聊
  - 最终状态：`success`（全成功）、`partial_success`（部分成功）、`failed`（全失败）
  - 实时日志推送到前端界面

#### 3. **实时日志监控**
- 所有操作（搜索群聊、发送消息、API 请求）都会生成带时间戳的日志
- 支持按类型分类：`info`、`success`、`error`、`warning`
- 前端通过 IPC 实时接收并展示

---

### 工作原理

#### 微信自动化核心技术

本项目**不依赖微信 API**，而是通过**桌面级自动化**实现：

1. **窗口管理**（`node-window-manager`）
   ```typescript
   // src/main/services/wechatWindow.ts
   
   // 1. 查找企业微信窗口
   const windows = windowManager.getWindows()
   const wechatWindow = windows.find(win => 
     win.getTitle() === '企业微信'
   )
   
   // 2. 激活窗口（Windows 需特殊处理）
   wechatWindow.restore()      // 还原最小化
   wechatWindow.bringToTop()   // 置顶
   ```

2. **键盘/鼠标模拟**（`robotjs`）
   ```typescript
   // src/main/services/wechatAutomation.ts
   
   // 1. 打开搜索框
   robot.keyTap('f', ['control'])  // Windows: Ctrl+F
   
   // 2. 通过剪贴板输入（支持中文）
   clipboard.writeText('运营群')
   robot.keyTap('v', ['control'])  // 粘贴
   
   // 3. 确认发送
   robot.keyTap('enter')
   ```

3. **剪贴板传输**（Electron `clipboard`）
   - 文本：直接写入 `clipboard.writeText()`
   - 图片：解码 base64 → PNG Buffer → `clipboard.writeImage()`

---

### 应用场景

| 场景 | 使用模式 | 说明 |
|------|---------|------|
| 日常群发通知 | 手动测试模式 | 运营手动配置内容，一键发送到多个群聊 |
| 定时营销推送 | 远程队列模式 | 后台系统定时投递任务，自动发送促销信息 |
| 客户服务响应 | 远程队列模式 | 客服系统触发任务，快速回复客户咨询 |
| 多节点并发 | 远程队列模式 | 多台电脑同时运行，提高发送吞吐量 |

---

## Electron 架构详解

### 三大核心进程

```
┌─────────────────────────────────────────────────────────────┐
│                       Electron 应用                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐         ┌─────────────────┐           │
│  │   主进程 (Main)  │◄───────►│ 渲染进程 (Renderer) │         │
│  │   Node.js 环境   │  IPC    │   浏览器环境      │           │
│  │  ┌───────────┐  │         │  ┌───────────┐  │           │
│  │  │index.ts   │  │         │  │ React App │  │           │
│  │  │robotjs    │  │         │  │ Zustand   │  │           │
│  │  │窗口管理   │  │         │  │ UI 组件   │  │           │
│  │  └───────────┘  │         │  └───────────┘  │           │
│  └────────┬────────┘         └────────▲────────┘           │
│           │                           │                     │
│           │  ┌──────────────────────┐ │                     │
│           └──┤  预加载脚本 (Preload) ├─┘                     │
│              │   contextBridge      │                       │
│              │   安全通信层         │                       │
│              └──────────────────────┘                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

#### 1. 主进程（Main Process）

**职责**：应用生命周期管理、原生能力调用、业务逻辑执行

```typescript
// src/main/index.ts

import { app, BrowserWindow } from 'electron'

// 1. 创建窗口
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),  // 注入预加载脚本
      contextIsolation: true,   // 隔离渲染进程上下文
      nodeIntegration: false    // 禁止直接使用 Node.js
    }
  })
  
  // 开发环境：加载 Vite 开发服务器
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    // 生产环境：加载打包后的 HTML
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  
  // 2. 注册 IPC 处理器
  registerIpcHandlers(mainWindow)
}

// 3. 应用生命周期
app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
```

**核心模块**：
- **IPC 处理器**（`src/main/ipc/`）：接收渲染进程请求，返回执行结果
- **业务服务**（`src/main/services/`）：
  - `wechatAutomation.ts`：微信自动化核心逻辑
  - `queuePoller.ts`：远程队列轮询服务
  - `wechatWindow.ts`：窗口查找与激活

---

#### 2. 渲染进程（Renderer Process）

**职责**：用户界面展示、用户交互处理

```typescript
// src/renderer/src/App.tsx

import React from 'react'
import TestModule from './components/TestModule/TestModule'
import QueueModule from './components/QueueModule/QueueModule'

function App() {
  return (
    <>
      <TestModule />     {/* 手动测试模块 */}
      <QueueModule />    {/* 远程队列模块 */}
      <LogSection />     {/* 日志显示 */}
    </>
  )
}
```

**关键特性**：
- 运行在独立的 **Chromium 渲染进程**中
- **无法直接访问 Node.js API**（安全限制）
- 通过 `window.electron.ipc` 与主进程通信（由预加载脚本注入）
- 使用 **Zustand** 管理状态（轻量级状态管理库）

**示例：发送消息**
```typescript
// src/renderer/src/components/TestModule/TestModule.tsx

const handleSend = async () => {
  // 1. 打开群聊
  const result = await window.electron.ipc.invoke('open-chat', { 
    target: '运营群' 
  })
  
  // 2. 发送消息
  for (const item of messages) {
    await window.electron.ipc.invoke('send-item', item)
  }
}
```

---

#### 3. 预加载脚本（Preload Script）

**职责**：在渲染进程和主进程之间建立**安全的通信桥梁**

```typescript
// src/preload/index.ts

import { contextBridge, ipcRenderer } from 'electron'

// 1. 定义安全的 API
const ipcApi = {
  // 双向通信（等待返回结果）
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  
  // 单向监听（接收主进程推送）
  on: (channel, handler) => {
    const listener = (event, data) => handler(data)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  
  // 单向发送
  send: (channel, data) => ipcRenderer.send(channel, data)
}

// 2. 注入到 window 对象（只暴露白名单 API）
contextBridge.exposeInMainWorld('electron', {
  ipc: ipcApi,
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url)
  }
})
```

**为什么需要预加载脚本？**
- ✅ **安全隔离**：渲染进程无法直接调用 `require('fs')` 等危险 API
- ✅ **能力受控**：只暴露白名单中的功能
- ✅ **类型安全**：TypeScript 完整提示

---

### 进程通信机制

#### 1. 渲染进程 → 主进程（invoke/handle 模式）

```typescript
// 渲染进程：发起请求
const result = await window.electron.ipc.invoke('open-chat', { 
  target: '运营群' 
})

// ─────────────────────────────────────────────────────

// 主进程：注册处理器
ipcMain.handle('open-chat', async (event, { target }) => {
  try {
    await openChatByName(target)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
```

**特点**：
- 异步通信，支持返回值
- 主进程可以执行耗时操作（搜索窗口、模拟键盘）
- 适合"请求-响应"场景

---

#### 2. 主进程 → 渲染进程（send 推送）

```typescript
// 主进程：推送日志
mainWindow.webContents.send('queue-agent:log', { 
  message: '开始发送消息', 
  type: 'info' 
})

// ─────────────────────────────────────────────────────

// 渲染进程：监听推送
useEffect(() => {
  const unsubscribe = window.electron.ipc.on('queue-agent:log', (data) => {
    addLog(data.message, data.type)
  })
  return unsubscribe
}, [])
```

**特点**：
- 主进程主动推送（无需渲染进程轮询）
- 适合实时通知（日志、进度、状态变化）

---

### 安全模型

| 配置项 | 值 | 说明 |
|--------|---|------|
| `nodeIntegration` | `false` | 渲染进程**禁止**直接使用 Node.js |
| `contextIsolation` | `true` | 渲染进程与预加载脚本**上下文隔离** |
| `sandbox` | `false` | 关闭沙箱（原生模块 robotjs 需要） |
| `contextBridge` | ✅ | 通过白名单暴露 API |

**为什么这样设计？**
- 防止恶意网页代码访问文件系统
- 即使渲染进程被 XSS 攻击，也无法执行任意 Node.js 代码
- **原生模块例外**：`robotjs` 需要底层系统权限，因此 `sandbox: false`

---

## 项目结构

```
screen-bot/
├── src/
│   ├── main/                    # 主进程（Node.js 环境）
│   │   ├── index.ts             # 应用入口，创建窗口
│   │   ├── ipc/                 # IPC 通信处理
│   │   │   ├── index.ts         # 统一注册入口
│   │   │   ├── chatHandler.ts   # 聊天相关：打开群聊、发送消息
│   │   │   └── queueHandler.ts  # 队列相关：启动/停止轮询
│   │   ├── services/            # 业务逻辑服务
│   │   │   ├── wechatAutomation.ts  # 微信自动化（robotjs）
│   │   │   ├── wechatWindow.ts      # 窗口管理（node-window-manager）
│   │   │   └── queuePoller.ts       # 远程队列轮询器
│   │   └── utils/               # 工具函数
│   │       ├── shortcuts.ts     # 快捷键适配（Win/Mac）
│   │       ├── delay.ts         # 延迟函数
│   │       └── dataURL.ts       # base64 图片转换
│   │
│   ├── preload/                 # 预加载脚本（桥接层）
│   │   └── index.ts             # contextBridge API 定义
│   │
│   ├── renderer/                # 渲染进程（浏览器环境）
│   │   ├── src/
│   │   │   ├── App.tsx          # React 根组件
│   │   │   ├── components/      # UI 组件
│   │   │   │   ├── TestModule/       # 手动测试模块
│   │   │   │   ├── QueueModule/      # 远程队列模块
│   │   │   │   ├── LogSection/       # 日志显示区
│   │   │   │   ├── common/           # 通用组件（按钮、输入框）
│   │   │   │   └── layout/           # 布局组件
│   │   │   ├── stores/          # Zustand 状态管理
│   │   │   │   ├── testStore.ts      # 测试模块状态
│   │   │   │   ├── queueStore.ts     # 队列模块状态
│   │   │   │   └── logStore.ts       # 日志状态
│   │   │   └── main.tsx         # React 入口
│   │   └── index.html           # HTML 模板
│   │
│   └── shared/                  # 共享类型定义
│       └── types/
│           ├── index.ts         # 统一导出
│           ├── task.ts          # 任务相关类型
│           ├── config.ts        # 配置相关类型
│           ├── status.ts        # 状态相关类型
│           └── ipc.ts           # IPC 接口类型
│
├── electron-builder.config.yml # 打包配置
├── package.json                 # 依赖和脚本
└── README.md
```

---

## 快速开始

### 系统要求
- **操作系统**：Windows 10+ 或 macOS 10.15+
- **Node.js**：v16.0.0+
- **微信客户端**：企业微信/微信需已安装并登录

### 安装依赖

```bash
# 1. 克隆项目
git clone https://github.com/ferris-house/screen-bot.git
cd screen-bot

# 2. 安装依赖
npm install

# 3. 重新编译原生模块（重要！）
npm run rebuild
```

> **为什么需要 rebuild？**  
> `robotjs` 和 `node-window-manager` 是原生 C++ 模块，需要针对当前 Electron 版本重新编译。

### 开发模式

```bash
npm run dev
```

- 主进程自动重启（修改 `src/main/` 代码后）
- 渲染进程热更新（修改 `src/renderer/` 代码后，浏览器自动刷新）
- 自动打开 DevTools

### 构建生产版本

```bash
# 构建代码
npm run build

# 打包应用
npm run dist:win   # Windows (.exe)
npm run dist:mac   # macOS (.dmg)
```

输出目录：`dist/win-unpacked/` 或 `dist/mac/`

---

## 技术栈

| 分类 | 技术 | 版本 | 说明 |
|------|------|------|------|
| **框架** | Electron | 28.0.0 | 跨平台桌面应用框架 |
| **构建** | electron-vite | 2.0.0 | Vite 驱动的 Electron 构建工具 |
| **前端** | React | 18.2.0 | UI 框架 |
| | TypeScript | 5.3.3 | 类型安全 |
| | Zustand | 4.4.7 | 状态管理 |
| **自动化** | robotjs | 0.6.0 | 键盘/鼠标模拟 |
| | node-window-manager | 2.2.4 | 窗口管理 |
| **打包** | electron-builder | 24.9.1 | 应用打包工具 |

---

## 常见问题

### 1. 原生模块编译失败

**问题**：`npm install` 时报错 `gyp ERR!`

**解决方案**：
```bash
# 清理缓存
rm -rf node_modules package-lock.json

# 重新安装
npm install

# 手动编译原生模块
npm run rebuild
```

如仍失败，检查：
- Python 是否安装（Windows 需要 Python 2.7 或 3.x）
- Visual Studio Build Tools（Windows）
- Xcode Command Line Tools（macOS）

---

### 2. 找不到微信窗口

**问题**：点击发送后提示"未找到企业微信/微信窗口"

**原因**：
- 微信未启动或未登录
- 窗口标题不匹配（当前硬编码为"企业微信"）

**解决方案**：
```typescript
// 修改 src/main/services/wechatWindow.ts
export function isWeChatWindow(win: any): boolean {
  const title = win.getTitle() || ''
  return title === '企业微信' || title === '微信'  // 添加普通微信支持
}
```

---

### 3. 群聊搜索失败

**问题**：能找到窗口，但搜索不到群聊

**排查步骤**：
1. 确认群聊名称拼写正确（完全匹配）
2. 检查微信搜索快捷键是否被修改（默认 `Ctrl+F` / `Cmd+F`）
3. 增加延迟时间（网络慢时搜索结果加载慢）：
   ```typescript
   // src/main/services/wechatAutomation.ts
   await delay(1200)  // 改为 2000
   ```

---

### 4. macOS 权限问题

**问题**：macOS 提示"屏幕录制权限"或"辅助功能权限"

**解决方案**：
1. 打开"系统偏好设置" → "安全性与隐私"
2. 点击"隐私"标签
3. 勾选以下权限：
   - ✅ **辅助功能**：允许控制您的电脑
   - ✅ **屏幕录制**：允许录制屏幕

---

### 5. 远程队列 401 错误

**问题**：队列模块报错"接口请求失败: 401"

**原因**：Token 未配置或已过期

**解决方案**：
1. 检查 Token 格式（是否包含 `Bearer ` 前缀？）
2. 确认后端 API 是否正常运行
3. 查看控制台日志中的完整请求信息

---

## 🔗 相关链接

- [识流 AI 运营助手（高级版）](https://thiflow.com) - 支持 AI 智能回复、知识库管理
- [下载地址](https://shiflowai.feishu.cn/wiki/SlrnwZVgiilB6ekmSzicFWgDnHf)
- [Electron 官方文档](https://www.electronjs.org/)
- [robotjs 文档](http://robotjs.io/)

---

## 📄 许可证

MIT License

---

## 🙋 常见疑问

**Q: 为什么不使用微信官方 API？**  
A: 微信/企业微信官方 API 有严格的权限限制和审核流程，且个人开发者难以获取。本项目通过桌面自动化绕过这些限制，适合个人/小团队快速使用。

**Q: 会被微信检测/封号吗？**  
A: 本项目模拟人工操作（键盘快捷键 + 剪贴板），理论上与手动发送无异。但请遵守以下原则：
- ⚠️ 不要高频发送（建议间隔 > 3 秒）
- ⚠️ 不要用于垃圾营销
- ⚠️ 遵守微信社区规范

**Q: 能否支持钉钉/飞书等其他平台？**  
A: 可以。只需修改 `wechatWindow.ts` 中的窗口标题识别逻辑，以及 `shortcuts.ts` 中的快捷键配置。核心自动化流程通用。

**Q: 如何调试自动化流程？**  
A: 主进程日志会输出到控制台，包含每个步骤的详细信息（搜索、粘贴、发送）。开发模式下可实时查看：
```bash
npm run dev  # 控制台会显示 [DEBUG] 开头的日志
```
