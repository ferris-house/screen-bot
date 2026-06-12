// test-window.js - 简化测试，只测试窗口管理
const { windowManager } = require('node-window-manager');

console.log('=== 测试 Windows 窗口管理 ===\n');

// 获取所有窗口
const windows = windowManager.getWindows();

// 检查是否能找到企业微信窗口
const keywords = ['企业微信', '微信', 'WeCom', 'WeChat'];
const wechatWin = windows.find(win => {
  const title = win.getTitle() || '';
  return keywords.some(k => title.includes(k));
});

console.log('=== 搜索结果 ===');
if (wechatWin) {
  console.log(`✅ 找到企业微信窗口: "${wechatWin.getTitle()}"`);

  // 尝试激活窗口
  console.log('\n尝试激活窗口...');

  try {
    wechatWin.restore();
    console.log('✅ 已调用 restore()');
  } catch (e) {
    console.log('restore() 失败:', e.message);
  }

  try {
    wechatWin.bringToTop();
    console.log('✅ 已调用 bringToTop()');
  } catch (e) {
    console.log('bringToTop() 失败:', e.message);
  }

  // 检查当前活动窗口
  setTimeout(() => {
    const activeWin = windowManager.getActiveWindow();
    if (activeWin) {
      const activeTitle = activeWin.getTitle() || '';
      console.log(`\n当前活动窗口: "${activeTitle}"`);

      if (keywords.some(k => activeTitle.includes(k))) {
        console.log('✅ 企业微信已成功激活到前台！');
      } else {
        console.log('❌ 企业微信未能激活到前台');
        console.log('可能需要管理员权限');
      }
    }
    console.log('\n测试完成！');
  }, 500);
} else {
  console.log('❌ 未找到企业微信窗口');
  console.log('请确保企业微信已打开');
}