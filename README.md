# shiflow wechat-auto-sender // 识流微信运营助手lite
依赖 Node.js、npm 构建 Mac、Windows 版本的电脑端软件，帮助运营提前配置文案、图片，实现一键点击并发送对应配置好的文案、图片，提高运营效率。

<img width="1800" height="1600" alt="image" src="https://github.com/user-attachments/assets/7aafd94e-97a9-4beb-a9e7-ce79162214db" />

# 识流运营助手 Lite

一个基于 Electron + React + TypeScript 的微信自动发送工具，帮助运营人员提高工作效率。

## 直接下载 Mac 和 Win 软件
[识流运营助手 lite 下载](https://shiflowai.feishu.cn/wiki/SlrnwZVgiilB6ekmSzicFWgDnHf?_kMatchedID=//client/doc/entry&_kUserID=6786546207733858563&from=tab_recent&wiki_version=2#share-Uh5qdXNUWoMJz5xl7hHcnCQKnGg)

[识流 AI 运营助手](https://thiflow.com)，高级版，基于视觉模型 + LLM 大模型，提供 AI 智能回复全接管、定时任务、特定任务、知识库管理。

## 🚀 功能特性

- **微信自动化操作**：支持自动发送消息、自动回复等操作
- **跨平台支持**：支持 Windows 和 macOS 系统
- **原生性能**：使用 robotjs 和 node-window-manager 提供高性能的桌面自动化
- **现代化界面**：基于 React + TypeScript 构建，支持热更新（HMR）

## 📋 系统要求

- **操作系统**：Windows 10+ 或 macOS 10.15+
- **Node.js**：v16.0.0 或更高版本
- **内存**：至少 4GB RAM
- **存储空间**：至少 100MB 可用空间

## 🛠️ 安装说明

### 1. 克隆项目

```bash
git clone https://github.com/your-username/wechat-auto-sender.git
cd wechat-auto-sender
```

### 2. 安装依赖

```bash
npm install
npm run rebuild  # 重新编译原生模块
```

如遇网络问题，可切换镜像源：

```bash
npm config set registry https://registry.npmmirror.com
```

### 3. 启动开发模式

```bash
npm run dev
```

支持热更新（HMR），修改代码后自动刷新。

## 📦 构建应用

```bash
npm run build     # 构建
npm run preview   # 预览构建结果
npm run dist      # 打包（全平台）
npm run dist:win  # Windows 打包
npm run dist:mac  # macOS 打包
```

## 🏗️ 技术架构

- **构建工具**：electron-vite
- **主进程**：TypeScript，负责应用生命周期与 IPC 通信
- **渲染进程**：React + TypeScript + Zustand 状态管理
- **样式系统**：CSS Variables
- **IPC 通信**：contextBridge 安全通信
- **原生模块**：
  - `robotjs`：桌面自动化（键盘/鼠标模拟）
  - `node-window-manager`：窗口管理

## 📁 项目结构

```
src/
├── main/           # 主进程（TypeScript）
│   ├── index.ts    # 入口文件
│   ├── ipc/        # IPC 处理器
│   ├── services/   # 业务服务
│   └── utils/      # 工具函数
├── preload/        # 预加载脚本
├── renderer/       # 渲染进程（React）
│   ├── src/
│   │   ├── components/  # UI 组件
│   │   ├── stores/      # Zustand 状态管理
│   │   ├── styles/      # CSS 样式
│   │   └── hooks/       # 自定义 Hooks
│   └── index.html  # HTML 入口
└── shared/         # 共享类型定义
```

## 🔧 常见问题

#### 原生依赖构建失败

```bash
rm -rf node_modules package-lock.json
npm install
npm run rebuild
```

#### 调试模式

```bash
DEBUG=electron-builder npm run rebuild
```
