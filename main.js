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

const WECHAT_WINDOW_KEYWORDS = ['企业微信', '微信', 'WeCom', 'WeChat'];

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
  while (true) {
    const activeWin = windowManager.getActiveWindow();
    if (activeWin && isWeChatWindow(activeWin)) return activeWin;
    if (timeoutMs > 0 && Date.now() - startedAt > timeoutMs) {
      throw new Error('等待企业微信/微信窗口激活超时');
    }
    await delay(500);
  }
}

function isWeChatWindow(win) {
  if (!win) return false;
  const title = win.getTitle() || '';
  return WECHAT_WINDOW_KEYWORDS.some(keyword => title.includes(keyword));
}

async function activateWeChatWindow() {
  const windows = windowManager.getWindows();
  const wechatWindow = windows.find(isWeChatWindow);
  if (!wechatWindow) {
    throw new Error('未找到企业微信/微信窗口');
  }

  wechatWindow.bringToTop();
  await delay(500);
  await waitForWeChatActive(5000);
}

async function pasteText(text) {
  clipboard.writeText(text);
  await delay(150);
  if (process.platform === 'darwin') {
    robot.keyTap('v', 'command');
  } else {
    robot.keyTap('v', 'control');
  }
  await delay(200);
}

async function openChatByName(target) {
  await activateWeChatWindow();

  if (process.platform === 'darwin') {
    robot.keyTap('f', 'command');
  } else {
    robot.keyTap('f', 'control');
  }
  await delay(500);

  await pasteText(target);
  await delay(1000);
  robot.keyTap('enter');
  await delay(800);
}

async function pasteItemToWeChat(item) {
  if (item.type === 'text') {
    clipboard.writeText(item.content);
  } else if (item.type === 'image') {
    const buf = dataURLToPNGBuffer(item.content);
    const img = nativeImage.createFromBuffer(buf);
    clipboard.writeImage(img);
  } else {
    throw new Error(`暂不支持的内容类型: ${item.type}`);
  }

  await delay(200);
  if (process.platform === 'darwin') {
    robot.keyTap('v', 'command');
  } else {
    robot.keyTap('v', 'control');
  }
  await delay(300);
}

async function confirmSendInWeChat() {
  robot.keyTap('enter');
  await delay(500);
}

async function sendToWeChat(item) {
  if (!item || !item.content) {
    throw new Error('发送内容为空');
  }
  const normalizedItem = {
    type: item.type || 'text',
    content: item.content
  };

  await activateWeChatWindow();
  await pasteItemToWeChat(normalizedItem);
  await confirmSendInWeChat();
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
  return queueAgentStatus;
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
