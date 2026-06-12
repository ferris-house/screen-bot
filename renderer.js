// renderer.js
const { ipcRenderer } = require('electron');

console.log("📝 renderer.js 已经开始执行");

// 存储键
const QUEUE_AGENT_CONFIG_KEY = "wechat_queue_agent_config";
const TEST_CONFIG_KEY = "wechat_test_config";

// 全局变量
let testConfig = null; // 测试模块配置
let testPollRunning = false; // 测试轮询是否运行中
let testPollTimer = null; // 测试轮询定时器

// ========== 日志函数 ==========

function addLog(message, type = 'info') {
    const logContent = document.getElementById('log-content');

    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;

    const timestamp = new Date().toLocaleTimeString();
    logEntry.textContent = `[${timestamp}] ${message}`;

    if (logContent) {
        logContent.appendChild(logEntry);
        logContent.scrollTop = logContent.scrollHeight;
    }

    console.log(`📝 [${type.toUpperCase()}] ${message}`);
}

// ========== Toast 提示 ==========

function showToast(message, duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    const toastMessage = document.getElementById('toast-message');

    if (toastContainer && toastMessage) {
        toastMessage.textContent = message;
        toastContainer.style.display = 'block';
        toastContainer.classList.add('show');

        setTimeout(() => {
            toastContainer.classList.add('hide');
            setTimeout(() => {
                toastContainer.style.display = 'none';
                toastContainer.classList.remove('show', 'hide');
            }, 300);
        }, duration);
    }
}

// ========== 图片选择对话框 ==========

function showImageFileDialog(callback) {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 8px;
        width: 90%;
        max-width: 500px;
    `;

    const title = document.createElement('div');
    title.style.cssText = `
        font-size: 18px;
        font-weight: bold;
        margin-bottom: 15px;
        color: #333;
    `;
    title.textContent = '选择图片文件';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.cssText = `
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        margin-bottom: 15px;
        box-sizing: border-box;
    `;

    const previewContainer = document.createElement('div');
    previewContainer.style.cssText = `
        text-align: center;
        min-height: 100px;
        border: 2px dashed #ddd;
        border-radius: 4px;
        padding: 20px;
        margin-bottom: 15px;
        color: #999;
    `;
    previewContainer.textContent = '请选择图片文件';

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 10px;
        justify-content: flex-end;
    `;

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn-primary';
    confirmBtn.textContent = '确定';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn';
    cancelBtn.style.cssText = `
        padding: 8px 16px;
        background: #6c757d;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    `;
    cancelBtn.textContent = '取消';

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const maxSize = 2 * 1024 * 1024; // 2MB
            if (file.size > maxSize) {
                const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
                alert(`图片文件过大！当前大小：${sizeMB}MB，最大允许：2MB`);
                fileInput.value = '';
                previewContainer.textContent = '请选择图片文件';
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                previewContainer.innerHTML = `<img src="${e.target.result}" style="max-width: 100%; max-height: 200px; object-fit: contain;">`;
            };
            reader.readAsDataURL(file);
        }
    });

    const handleConfirm = () => {
        const file = fileInput.files[0];
        if (file && file.type.startsWith('image/')) {
            const maxSize = 2 * 1024 * 1024;
            if (file.size > maxSize) {
                alert('图片文件过大！');
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                callback(e.target.result);
            };
            reader.readAsDataURL(file);
            document.body.removeChild(dialog);
        } else {
            alert('请选择有效的图片文件！');
        }
    };

    const handleCancel = () => {
        callback(null);
        document.body.removeChild(dialog);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);

    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(confirmBtn);

    content.appendChild(title);
    content.appendChild(fileInput);
    content.appendChild(previewContainer);
    content.appendChild(buttonContainer);
    dialog.appendChild(content);
    document.body.appendChild(dialog);
}

// ========== 远程队列配置 ==========

function getDefaultQueueAgentConfig() {
    return {
        queueUrl: '',
        token: '',
        agentId: 'default-agent',
        intervalSeconds: 60
    };
}

function loadQueueAgentConfig() {
    const raw = localStorage.getItem(QUEUE_AGENT_CONFIG_KEY);
    if (!raw) return getDefaultQueueAgentConfig();
    try {
        return { ...getDefaultQueueAgentConfig(), ...JSON.parse(raw) };
    } catch (e) {
        console.error("读取远程队列配置出错：", e);
        return getDefaultQueueAgentConfig();
    }
}

function saveQueueAgentConfig(config) {
    localStorage.setItem(QUEUE_AGENT_CONFIG_KEY, JSON.stringify(config));
}

function readQueueAgentForm() {
    return {
        queueUrl: document.getElementById('queue-url-input').value.trim(),
        token: document.getElementById('queue-token-input').value.trim(),
        agentId: document.getElementById('queue-agent-id-input').value.trim() || 'default-agent',
        intervalSeconds: Number(document.getElementById('queue-interval-input').value) || 60
    };
}

function renderQueueAgentConfig(config) {
    document.getElementById('queue-url-input').value = config.queueUrl || '';
    document.getElementById('queue-token-input').value = config.token || '';
    document.getElementById('queue-agent-id-input').value = config.agentId || 'default-agent';
    document.getElementById('queue-interval-input').value = config.intervalSeconds || 60;
}

function formatQueueTime(value) {
    if (!value) return '-';
    try {
        return new Date(value).toLocaleString();
    } catch (e) {
        return value;
    }
}

function renderQueueAgentStatus(status) {
    const statusText = status.enabled ? `运行中：${status.state}` : '未启动';
    document.getElementById('queue-status').textContent = statusText;
    document.getElementById('queue-last-poll').textContent = formatQueueTime(status.lastPollAt);
    document.getElementById('queue-last-task').textContent = status.lastTaskId || '-';
    document.getElementById('queue-last-error').textContent = status.lastError || '-';
    document.getElementById('queue-start-btn').disabled = !!status.enabled;
    document.getElementById('queue-stop-btn').disabled = !status.enabled;
}

async function startQueueAgent() {
    const config = readQueueAgentForm();
    if (!config.queueUrl) {
        showToast('请先填写队列接口 URL', 2000);
        addLog('请先填写队列接口 URL', 'warning');
        return;
    }

    saveQueueAgentConfig(config);
    const result = await ipcRenderer.invoke('queue-agent:start', config);
    renderQueueAgentStatus(result.status);

    if (result.success) {
        addLog('远程队列轮询已启动', 'success');
        showToast('远程队列轮询已启动', 2000);
    } else {
        addLog(`远程队列启动失败：${result.error}`, 'error');
        showToast(`启动失败：${result.error}`, 3000);
    }
}

async function stopQueueAgent() {
    const result = await ipcRenderer.invoke('queue-agent:stop');
    renderQueueAgentStatus(result.status);
    addLog('远程队列轮询已停止', 'info');
    showToast('远程队列轮询已停止', 2000);
}

async function refreshQueueAgentStatus() {
    const status = await ipcRenderer.invoke('queue-agent:get-status');
    renderQueueAgentStatus(status);
}

// ========== 测试模块 ==========

function getDefaultTestConfig() {
    return {
        target: '',
        messages: []
    };
}

function loadTestConfig() {
    const raw = localStorage.getItem(TEST_CONFIG_KEY);
    if (!raw) return getDefaultTestConfig();
    try {
        return { ...getDefaultTestConfig(), ...JSON.parse(raw) };
    } catch (e) {
        console.error("读取测试配置出错：", e);
        return getDefaultTestConfig();
    }
}

function saveTestConfig(config) {
    localStorage.setItem(TEST_CONFIG_KEY, JSON.stringify(config));
}

function renderTestConfig(config) {
    document.getElementById('test-target-input').value = config.target || '';
    renderTestMessages(config.messages || []);
}

function renderTestMessages(messages) {
    const list = document.getElementById('test-message-list');
    list.innerHTML = '';

    if (!messages || messages.length === 0) {
        list.innerHTML = '<div style="color: #999; text-align: center; padding: 10px;">暂无消息内容</div>';
        return;
    }

    messages.forEach((msg, index) => {
        const item = document.createElement('div');
        item.className = 'test-message-item';

        const preview = document.createElement('div');
        preview.className = 'test-message-preview';
        if (msg.type === 'text') {
            preview.textContent = msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : msg.content;
        } else if (msg.type === 'image') {
            preview.innerHTML = `<img src="${msg.content}" style="max-width: 60px; max-height: 40px;">`;
        }

        const actions = document.createElement('div');
        actions.className = 'test-message-actions';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger btn-small';
        deleteBtn.textContent = '删除';
        deleteBtn.addEventListener('click', () => {
            deleteTestMessage(index);
        });

        actions.appendChild(deleteBtn);
        item.appendChild(preview);
        item.appendChild(actions);
        list.appendChild(item);
    });
}

function addTestText() {
    const content = document.getElementById('test-message-input').value.trim();
    if (!content) {
        showToast('请输入消息内容', 2000);
        return;
    }

    testConfig.messages.push({
        type: 'text',
        content: content
    });

    document.getElementById('test-message-input').value = '';
    renderTestMessages(testConfig.messages);
    saveTestConfig(testConfig);
    addLog('已添加文字消息到测试配置', 'success');
    showToast('已添加文字消息', 1500);
}

function addTestImage(imageData) {
    if (!imageData) {
        showImageFileDialog((data) => {
            if (data) addTestImage(data);
        });
        return;
    }

    testConfig.messages.push({
        type: 'image',
        content: imageData
    });

    renderTestMessages(testConfig.messages);
    saveTestConfig(testConfig);
    addLog('已添加图片消息到测试配置', 'success');
    showToast('已添加图片消息', 1500);
}

function deleteTestMessage(index) {
    testConfig.messages.splice(index, 1);
    renderTestMessages(testConfig.messages);
    saveTestConfig(testConfig);
    addLog('已删除测试消息', 'info');
}

async function executeTestNow() {
    const target = document.getElementById('test-target-input').value.trim();
    const messages = testConfig.messages;

    if (messages.length === 0) {
        showToast('请先添加消息内容', 2000);
        addLog('测试执行失败：没有消息内容', 'error');
        return;
    }

    addLog('开始立即执行测试...', 'info');
    addLog(`目标群: ${target || '当前聊天窗口'}`, 'info');
    addLog(`消息数量: ${messages.length}`, 'info');

    const executeBtn = document.getElementById('test-execute-btn');
    executeBtn.disabled = true;
    executeBtn.textContent = '执行中...';

    try {
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            addLog(`正在发送第 ${i + 1} 条消息...`, 'info');

            // 如果有目标群名，先搜索打开群聊
            if (target && i === 0) {
                const openResult = await ipcRenderer.invoke('open-chat', { target });
                if (!openResult.success) {
                    addLog(`打开群聊失败：${openResult.error}`, 'error');
                    throw new Error(openResult.error);
                }
                addLog(`已打开群聊: ${target}`, 'success');
            }

            // 发送消息
            const result = await ipcRenderer.invoke('send-item', msg);
            if (!result.success) {
                addLog(`第 ${i + 1} 条发送失败：${result.error}`, 'error');
                throw new Error(result.error);
            }
            addLog(`第 ${i + 1} 条发送成功`, 'success');

            if (i < messages.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        addLog('测试执行完成！', 'success');
        showToast('测试执行成功！', 2000);
    } catch (error) {
        addLog(`测试执行失败：${error.message}`, 'error');
        showToast(`执行失败：${error.message}`, 3000);
    }

    executeBtn.disabled = false;
    executeBtn.textContent = '立即执行';
}

function startTestPoll() {
    const target = document.getElementById('test-target-input').value.trim();
    const messages = testConfig.messages;

    if (messages.length === 0) {
        showToast('请先添加消息内容', 2000);
        addLog('轮询启动失败：没有消息内容', 'error');
        return;
    }

    testConfig.target = target;
    saveTestConfig(testConfig);

    testPollRunning = true;
    const intervalSeconds = 60;

    addLog(`测试轮询已启动，间隔 ${intervalSeconds} 秒`, 'success');
    showToast('测试轮询已启动', 2000);

    document.getElementById('test-poll-status').textContent = '状态：轮询中';
    document.getElementById('test-poll-status').className = 'test-status active';
    document.getElementById('test-poll-btn').disabled = true;
    document.getElementById('test-stop-btn').disabled = false;

    executeTestPollOnce();
    testPollTimer = setInterval(executeTestPollOnce, intervalSeconds * 1000);
}

function stopTestPoll() {
    testPollRunning = false;
    if (testPollTimer) {
        clearInterval(testPollTimer);
        testPollTimer = null;
    }

    addLog('测试轮询已停止', 'info');
    showToast('测试轮询已停止', 2000);

    document.getElementById('test-poll-status').textContent = '状态：未启动';
    document.getElementById('test-poll-status').className = 'test-status';
    document.getElementById('test-poll-btn').disabled = false;
    document.getElementById('test-stop-btn').disabled = true;
}

async function executeTestPollOnce() {
    if (!testPollRunning) return;
    addLog('轮询触发，开始执行...', 'info');
    await executeTestNow();
}

// ========== 页面初始化 ==========

window.addEventListener('DOMContentLoaded', () => {
    console.log("🕒 DOMContentLoaded：页面 DOM 已经完全加载");

    // 加载远程队列配置
    renderQueueAgentConfig(loadQueueAgentConfig());
    refreshQueueAgentStatus();

    // 加载测试配置
    testConfig = loadTestConfig();
    renderTestConfig(testConfig);

    // IPC 监听
    ipcRenderer.on('queue-agent:status', (event, status) => {
        renderQueueAgentStatus(status);
    });

    ipcRenderer.on('queue-agent:log', (event, payload) => {
        addLog(payload.message, payload.type || 'info');
    });

    // 远程队列事件绑定
    document.getElementById('queue-save-btn').addEventListener('click', () => {
        saveQueueAgentConfig(readQueueAgentForm());
        addLog('远程队列配置已保存', 'success');
        showToast('远程队列配置已保存', 2000);
    });

    document.getElementById('queue-start-btn').addEventListener('click', startQueueAgent);
    document.getElementById('queue-stop-btn').addEventListener('click', stopQueueAgent);

    // 测试模块事件绑定
    document.getElementById('test-save-btn').addEventListener('click', () => {
        testConfig.target = document.getElementById('test-target-input').value.trim();
        saveTestConfig(testConfig);
        addLog('测试配置已保存', 'success');
        showToast('测试配置已保存', 2000);
    });

    document.getElementById('test-add-text-btn').addEventListener('click', addTestText);
    document.getElementById('test-add-image-btn').addEventListener('click', () => addTestImage(null));
    document.getElementById('test-execute-btn').addEventListener('click', executeTestNow);
    document.getElementById('test-poll-btn').addEventListener('click', startTestPoll);
    document.getElementById('test-stop-btn').addEventListener('click', stopTestPoll);

    document.getElementById('test-stop-btn').disabled = true;

    // 底部链接
    const footerLink = document.getElementById('footer-link');
    if (footerLink) {
        footerLink.addEventListener('click', (e) => {
            e.preventDefault();
            require('electron').shell.openExternal('https://thiflow.com');
        });
    }

    addLog('应用启动完成', 'info');
    console.log("✅ 所有事件监听器已绑定，应用初始化完成");
});