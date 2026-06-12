// main.js
const { app, BrowserWindow, ipcMain, clipboard, nativeImage } = require('electron');
const robot = require('robotjs');
const { windowManager } = require('node-window-manager');

let mainWindow = null;
let queueAgentTimer = null;
let queueAgentRunning = false;
let queueAgentBusy = false;
let queueAgentConfig = null;
let queueAgentStatus = {
  enabled: false,
  state: 'idle',
  lastPollAt: null,
  lastTaskId: null,
  lastError: null
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function dataURLToPNGBuffer(dataURL) {
  const parts = dataURL.split(',');
  return Buffer.from(parts[1], 'base64');
}

function emitQueueAgentStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('queue-agent:status', queueAgentStatus);
  }
}

function emitQueueAgentLog(message, type = 'info') {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('queue-agent:log', { message, type });
  }
}

function updateQueueAgentStatus(patch) {
  queueAgentStatus = { ...queueAgentStatus, ...patch };
  emitQueueAgentStatus();
}

async function waitForWeChatActive(timeoutMs = 0) {
  const startedAt = Date.now();
  const platformDelay = process.platform === 'win32' ? 800 : 500;

  while (true) {
    const activeWin = windowManager.getActiveWindow();
    if (activeWin && isWeChatWindow(activeWin)) return activeWin;
    if (timeoutMs > 0 && Date.now() - startedAt > timeoutMs) {
      throw new Error('等待企业微信/微信窗口激活超时');
    }
    await delay(platformDelay);
  }
}
 
function isWeChatWindow(win) {
  if (!win) return false;
  const title = win.getTitle() || '';
  return title === '企业微信';
}

async function activateWeChatWindow() {
  console.log(`[DEBUG] activateWeChatWindow 开始`);
  const windows = windowManager.getWindows();
  console.log(`[DEBUG] 找到 ${windows.length} 个窗口`);

  const wechatWindow = windows.find(isWeChatWindow);
  if (!wechatWindow) {
    console.log(`[DEBUG] 未找到企业微信窗口`);
    throw new Error('未找到企业微信/微信窗口');
  }

  console.log(`[DEBUG] 找到企业微信窗口: "${wechatWindow.getTitle()}"`);

  // 检查当前是否已经是企业微信窗口
  const currentActive = windowManager.getActiveWindow();
  if (currentActive && isWeChatWindow(currentActive)) {
    console.log(`[DEBUG] 企业微信已经是当前活动窗口`);
    return;
  }

  // Windows 需要更强力的窗口激活方式
  if (process.platform === 'win32') {
    console.log(`[DEBUG] Windows 平台，开始激活流程`);

    // 尝试多次激活
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`[DEBUG] 第 ${attempt} 次尝试激活`);

      // 先确保窗口可见
      try {
        wechatWindow.restore();
        console.log(`[DEBUG] restore() 成功`);
      } catch (e) {
        console.log(`[DEBUG] restore() 失败: ${e.message}`);
      }

      await delay(200);

      // 尝试最大化再恢复（强制窗口显示）
      try {
        wechatWindow.maximize();
        await delay(100);
        wechatWindow.restore();
        console.log(`[DEBUG] maximize->restore 成功`);
      } catch (e) {
        console.log(`[DEBUG] maximize 失败: ${e.message}`);
      }

      await delay(200);

      // 将窗口带到前台
      try {
        wechatWindow.bringToTop();
        console.log(`[DEBUG] bringToTop() 成功`);
      } catch (e) {
        console.log(`[DEBUG] bringToTop() 失败: ${e.message}`);
      }

      await delay(500);

      // 检查是否成功激活
      const newActive = windowManager.getActiveWindow();
      if (newActive && isWeChatWindow(newActive)) {
        console.log(`[DEBUG] 第 ${attempt} 次尝试成功，企业微信已激活`);
        return;
      }
    }

    // 最后等待确认
    console.log(`[DEBUG] 等待窗口激活确认`);
    await waitForWeChatActive(5000);
    console.log(`[DEBUG] 窗口已成功激活`);
  } else {
    // Mac 平台
    wechatWindow.bringToTop();
    await delay(500);
    await waitForWeChatActive(5000);
    console.log(`[DEBUG] 窗口已成功激活`);
  }
}

// 平台特定的快捷键映射
const PLATFORM_SHORTCUTS = {
  darwin: {
    search: { key: 'f', modifier: 'command' },
    paste: { key: 'v', modifier: 'command' },
    selectAll: { key: 'a', modifier: 'command' }
  },
  win32: {
    // Windows 微信搜索快捷键：Ctrl+F 或 直接在窗口中输入
    search: { key: 'f', modifier: 'control' },
    paste: { key: 'v', modifier: 'control' },
    selectAll: { key: 'a', modifier: 'control' }
  }
};

function getShortcut(action) {
  const platform = process.platform;
  const shortcuts = PLATFORM_SHORTCUTS[platform] || PLATFORM_SHORTCUTS.win32;
  return shortcuts[action] || shortcuts.paste;
}

async function pasteText(text) {
  clipboard.writeText(text);
  console.log(`[DEBUG] 已写入剪贴板: "${text}"`);
  await delay(150);
  const shortcut = getShortcut('paste');
  console.log(`[DEBUG] 发送粘贴快捷键: ${shortcut.modifier}+${shortcut.key}`);
  robot.keyTap(shortcut.key, shortcut.modifier);
  await delay(200);
}

async function openChatByName(target) {
  console.log(`[DEBUG] 开始搜索群聊: "${target}"`);
  await activateWeChatWindow();
  console.log(`[DEBUG] 窗口已激活`);

  // Windows 企业微信搜索方式
  // 方式1: Ctrl+F 打开搜索
  // 方式2: 直接点击搜索框（需要鼠标操作）
  const searchShortcut = getShortcut('search');
  console.log(`[DEBUG] 发送搜索快捷键: ${searchShortcut.modifier}+${searchShortcut.key}`);
  robot.keyTap(searchShortcut.key, searchShortcut.modifier);
  await delay(800);

  console.log(`[DEBUG] 开始粘贴搜索内容`);
  await pasteText(target);
  await delay(1200);

  console.log(`[DEBUG] 发送 Enter 选择搜索结果`);
  robot.keyTap('enter');
  await delay(1000);

  // 可能需要再次按 Enter 打开聊天窗口
  robot.keyTap('enter');
  await delay(500);
  console.log(`[DEBUG] 搜索完成`);
}

async function pasteItemToWeChat(item) {
  console.log(`[DEBUG] pasteItemToWeChat 开始, 类型: ${item.type}`);

  if (item.type === 'text') {
    clipboard.writeText(item.content);
    console.log(`[DEBUG] 已写入文本到剪贴板: "${item.content.substring(0, 50)}..."`);
  } else if (item.type === 'image') {
    const buf = dataURLToPNGBuffer(item.content);
    const img = nativeImage.createFromBuffer(buf);
    clipboard.writeImage(img);
    console.log(`[DEBUG] 已写入图片到剪贴板`);
  } else {
    throw new Error(`暂不支持的内容类型: ${item.type}`);
  }

  await delay(200);
  const shortcut = getShortcut('paste');
  console.log(`[DEBUG] 发送粘贴快捷键: ${shortcut.modifier}+${shortcut.key}`);
  robot.keyTap(shortcut.key, shortcut.modifier);
  await delay(300);
  console.log(`[DEBUG] pasteItemToWeChat 完成`);
}

async function confirmSendInWeChat() {
  console.log(`[DEBUG] 发送 Enter 确认发送`);
  robot.keyTap('enter');
  await delay(process.platform === 'win32' ? 600 : 500);
}

async function sendToWeChat(item) {
  console.log(`[DEBUG] sendToWeChat 开始`);
  if (!item || !item.content) {
    throw new Error('发送内容为空');
  }
  const normalizedItem = {
    type: item.type || 'text',
    content: item.content
  };

  await activateWeChatWindow();
  console.log(`[DEBUG] 窗口激活完成，开始粘贴`);
  await pasteItemToWeChat(normalizedItem);

  // Windows 需要更长的等待时间确保粘贴完成
  await delay(process.platform === 'win32' ? 500 : 300);
  console.log(`[DEBUG] 等待完成，开始确认发送`);
  await confirmSendInWeChat();
  console.log(`[DEBUG] sendToWeChat 完成`);
}

function normalizeRemoteTask(rawTask) {
  if (!rawTask || typeof rawTask !== 'object') {
    throw new Error('任务格式无效');
  }

  const message = rawTask.message || rawTask.content;
  const items = Array.isArray(rawTask.items)
    ? rawTask.items
    : [{ type: rawTask.type || 'text', content: message }];

  return {
    id: rawTask.id || rawTask.taskId || String(Date.now()),
    targets: Array.isArray(rawTask.targets) ? rawTask.targets : [],
    items: items.filter(item => item && item.content),
    raw: rawTask
  };
}

async function requestQueueApi(path, options = {}) {
  const baseUrl = queueAgentConfig.queueUrl.replace(/\/+$/, '');
  const url = `${baseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(queueAgentConfig.token ? { Authorization: `Bearer ${queueAgentConfig.token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(url, { ...options, headers });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new Error(`接口返回不是有效 JSON: ${text.slice(0, 120)}`);
    }
  }

  if (!response.ok) {
    throw new Error(data && data.error ? data.error : `接口请求失败: ${response.status}`);
  }

  return data;
}

async function claimRemoteTasks() {
  const body = {
    agentId: queueAgentConfig.agentId || 'default-agent',
    limit: 1
  };
  const data = await requestQueueApi('/tasks/claim', {
    method: 'POST',
    body: JSON.stringify(body)
  });

  if (Array.isArray(data)) return data;
  if (Array.isArray(data.tasks)) return data.tasks;
  if (data.task) return [data.task];
  return [];
}

async function reportRemoteTask(taskId, payload) {
  await requestQueueApi(`/tasks/${encodeURIComponent(taskId)}/result`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

async function executeRemoteTask(rawTask) {
  const task = normalizeRemoteTask(rawTask);
  const startedAt = new Date().toISOString();
  const results = [];

  if (task.items.length === 0) {
    throw new Error('任务没有可发送内容');
  }

  updateQueueAgentStatus({ state: 'sending', lastTaskId: task.id, lastError: null });
  emitQueueAgentLog(`开始执行远程任务 ${task.id}`, 'info');

  const targets = task.targets.length > 0 ? task.targets : [null];
  for (const target of targets) {
    try {
      if (target) {
        emitQueueAgentLog(`正在打开群聊：${target}`, 'info');
        await openChatByName(target);
      } else {
        await activateWeChatWindow();
      }

      for (const item of task.items) {
        if (item.type && item.type !== 'text' && item.type !== 'image') {
          throw new Error(`暂不支持的内容类型: ${item.type}`);
        }
        await sendToWeChat(item);
        await delay(500);
      }

      results.push({ target: target || 'current_chat', status: 'sent' });
      emitQueueAgentLog(`${target || '当前会话'} 发送成功`, 'success');
    } catch (error) {
      results.push({
        target: target || 'current_chat',
        status: 'failed',
        error: error.message
      });
      emitQueueAgentLog(`${target || '当前会话'} 发送失败：${error.message}`, 'error');
    }
  }

  const failedCount = results.filter(item => item.status === 'failed').length;
  const status = failedCount === 0 ? 'success' : failedCount === results.length ? 'failed' : 'partial_success';
  const payload = {
    taskId: task.id,
    status,
    results,
    startedAt,
    finishedAt: new Date().toISOString()
  };

  updateQueueAgentStatus({ state: 'reporting' });
  await reportRemoteTask(task.id, payload);
  emitQueueAgentLog(`远程任务 ${task.id} 已回传结果：${status}`, status === 'success' ? 'success' : 'warning');
}

async function pollQueueAgentOnce() {
  if (!queueAgentRunning || queueAgentBusy) return;

  queueAgentBusy = true;
  updateQueueAgentStatus({ state: 'polling', lastPollAt: new Date().toISOString(), lastError: null });

  try {
    const tasks = await claimRemoteTasks();
    if (tasks.length === 0) {
      updateQueueAgentStatus({ state: 'idle' });
      return;
    }
    for (const task of tasks) {
      await executeRemoteTask(task);
    }
    updateQueueAgentStatus({ state: 'idle' });
  } catch (error) {
    updateQueueAgentStatus({ state: 'error', lastError: error.message });
    emitQueueAgentLog(`远程队列轮询失败：${error.message}`, 'error');
  } finally {
    queueAgentBusy = false;
  }
}

function stopQueueAgent() {
  queueAgentRunning = false;
  if (queueAgentTimer) {
    clearInterval(queueAgentTimer);
    queueAgentTimer = null;
  }
  updateQueueAgentStatus({ enabled: false, state: 'idle' });
}

function startQueueAgent(config) {
  if (!config || !config.queueUrl) {
    throw new Error('请先填写队列接口 URL');
  }

  stopQueueAgent();
  queueAgentConfig = {
    queueUrl: config.queueUrl,
    token: config.token || '',
    agentId: config.agentId || 'default-agent',
    intervalSeconds: Math.max(Number(config.intervalSeconds) || 60, 10)
  };
  queueAgentRunning = true;
  updateQueueAgentStatus({ enabled: true, state: 'idle', lastError: null });
  emitQueueAgentLog(`远程队列轮询已启动，间隔 ${queueAgentConfig.intervalSeconds} 秒`, 'success');

  pollQueueAgentOnce();
  queueAgentTimer = setInterval(pollQueueAgentOnce, queueAgentConfig.intervalSeconds * 1000);
}

ipcMain.handle('open-chat', async (event, { target }) => {
  console.log('🔍 调试 - IPC open-chat 被调用，目标:', target);
  try {
    await openChatByName(target);
    console.log('🔍 调试 - openChatByName 执行成功');
    return { success: true };
  } catch (e) {
    console.log('🔍 调试 - openChatByName 执行失败，错误:', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('send-item', async (event, item) => {
  console.log('🔍 调试 - IPC send-item 被调用，参数:', item);
  try {
    const result = await sendToWeChat(item);
    console.log('🔍 调试 - sendToWeChat 执行成功，返回:', result);
    return { success: true };
  } catch (e) {
    console.log('🔍 调试 - sendToWeChat 执行失败，错误:', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('queue-agent:start', async (event, config) => {
  try {
    startQueueAgent(config);
    return { success: true, status: queueAgentStatus };
  } catch (error) {
    updateQueueAgentStatus({ enabled: false, state: 'error', lastError: error.message });
    return { success: false, error: error.message, status: queueAgentStatus };
  }
});

ipcMain.handle('queue-agent:stop', async () => {
  stopQueueAgent();
  return { success: true, status: queueAgentStatus };
});

ipcMain.handle('queue-agent:get-status', async () => {
  return { status: queueAgentStatus };
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 800,
    autoHideMenuBar: true,
    menuBarVisible: false,
    webPreferences: { 
      nodeIntegration: true, 
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false
    }
  });
  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
