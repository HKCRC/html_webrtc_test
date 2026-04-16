'use strict';

const { app, BrowserWindow, screen } = require('electron');

// ── 计算所有显示器的联合矩形 ──────────────────────────────────────────────────
function getAllDisplaysBounds() {
  const displays = screen.getAllDisplays();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const d of displays) {
    const { x, y, width, height } = d.bounds;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + width > maxX) maxX = x + width;
    if (y + height > maxY) maxY = y + height;
  }
  console.log(`Displays (${displays.length}):`, displays.map(d =>
    `[${d.bounds.x},${d.bounds.y} ${d.bounds.width}x${d.bounds.height}]`).join(' '));
  const bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  console.log(`Union bounds: ${bounds.width}x${bounds.height} @ (${bounds.x},${bounds.y})`);
  return bounds;
}

// ── Electron Window ───────────────────────────────────────────────────────────
function createWindow() {
  const bounds = getAllDisplaysBounds();

  const win = new BrowserWindow({
    // 初始尺寸设为联合矩形大小，随后用 setBounds 精确定位
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    // fullscreen: true 只能覆盖单个显示器，跨屏拼接不能用
    fullscreen: false,
    resizable: false,
    movable: false,
    autoHideMenuBar: true,
    frame: false,
    skipTaskbar: true,
    backgroundColor: '#000000',
    webPreferences: {
      webSecurity: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // 精确覆盖所有显示器（绕过窗口管理器的位置限制）
  win.setBounds(bounds);

  win.loadFile('index.html');

  // ESC 退出应用（无 frame / titlebar，需手动绑定）
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') {
      app.quit();
    }
  });

  // 开发调试时可打开 DevTools
  // win.webContents.openDevTools({ mode: 'detach' });
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
