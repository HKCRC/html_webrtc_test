'use strict';

const { app, BrowserWindow, screen } = require('electron');
const net = require('net');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');

// ── TCP 和 WebSocket 服务器配置 ──────────────────────────────────────────────
let tcpServer = null;
let httpServer = null;
let wss = null;

// 存储最新的数据
let latestData = [0, 0, 0]; // [回转角度, 变幅半径, 吊钩高度]

// 读取配置文件
const configPath = path.join(__dirname, 'config.json');
let config = { tcp_port: 8888, ws_port: 8887 };

try {
  const configData = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configData);
} catch (error) {
  console.warn('无法读取config.json，使用默认端口 8888, 8887:', error.message);
}

const TCP_PORT = config.tcp_port || 8888;
const WS_PORT = config.ws_port || 8887;

// 广播数据给所有WebSocket客户端
function broadcastData(data) {
  if (wss) {
    // console.log(`[广播] 发送数据给 ${wss.clients.size} 个客户端:`, data);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'update', data: data }));
      }
    });
  } else {
    console.log('[广播] WebSocket服务器未初始化');
  }
}

// 启动 TCP + WebSocket 服务器
function startDataServer() {
  // 创建TCP服务器
  tcpServer = net.createServer((socket) => {
    console.log('[TCP] 客户端连接:', socket.remoteAddress, socket.remotePort);

    socket.on('data', (data) => {
      try {
        // 尝试解析JSON数组格式: [rotation, radius, height]
        let parsedData = null;
        
        try {
          const message = data.toString().trim();
          parsedData = JSON.parse(message);
          
          if (!Array.isArray(parsedData) || parsedData.length !== 3) {
            throw new Error('数据必须是包含3个浮点数的数组');
          }
          
          // console.log('[TCP] JSON数组格式 - 解析后的数据:');
          // console.log('  回转角度:', parsedData[0], '°');
          // console.log('  变幅半径:', parsedData[1], 'm');
          // console.log('  吊钩高度:', parsedData[2], 'm');
        } catch (jsonError) {
          // JSON解析失败，尝试二进制格式
          if (data.length === 12) { // 3个float，每个4字节
            parsedData = [];
            for (let i = 0; i < 3; i++) {
              const value = data.readFloatLE(i * 4);
              parsedData.push(value);
            }
            // console.log('[TCP] 二进制格式 - 解析后的数据:');
            // console.log('  回转角度:', parsedData[0], '°');
            // console.log('  变幅半径:', parsedData[1], 'm');
            // console.log('  吊钩高度:', parsedData[2], 'm');
          } else {
            throw new Error('无法解析数据，必须是JSON数组或12字节的二进制数据(3个float)');
          }
        }

        // 更新最新数据
        latestData = parsedData;

        // 广播给所有WebSocket客户端
        broadcastData(latestData);

        // 返回确认信息
        socket.write(JSON.stringify({ status: 'success', message: '数据已接收' }) + '\n');
      } catch (error) {
        console.error('[TCP] 数据解析失败:', error.message);
        socket.write(JSON.stringify({ status: 'error', message: error.message }) + '\n');
      }
    });

    socket.on('end', () => {
      console.log('[TCP] 客户端断开连接');
    });

    socket.on('error', (error) => {
      console.error('[TCP] 连接错误:', error.message);
    });
  });

  // 创建HTTP服务器用于WebSocket
  httpServer = http.createServer();
  wss = new WebSocket.Server({ server: httpServer });

  // WebSocket连接管理
  wss.on('connection', (ws) => {
    console.log('[WebSocket] 客户端连接');
    
    // 客户端连接时发送最新数据
    ws.send(JSON.stringify({ type: 'update', data: latestData }));
    
    ws.on('close', () => {
      console.log('[WebSocket] 客户端断开连接');
    });
    
    ws.on('error', (error) => {
      console.error('[WebSocket] 错误:', error.message);
    });
  });

  // 启动TCP服务器
  tcpServer.listen(TCP_PORT, '0.0.0.0', () => {
    console.log(`[TCP] 服务器运行在 0.0.0.0:${TCP_PORT}`);
  });

  tcpServer.on('error', (error) => {
    console.error('[TCP] 服务器错误:', error.message);
  });

  // 启动WebSocket服务器
  httpServer.listen(WS_PORT, '0.0.0.0', () => {
    console.log(`[WebSocket] 服务器运行在 ws://0.0.0.0:${WS_PORT}`);
  });
}

// 关闭服务器
function stopDataServer() {
  if (tcpServer) {
    tcpServer.close();
    console.log('[TCP] 服务器已关闭');
  }
  if (httpServer) {
    httpServer.close();
    console.log('[WebSocket] 服务器已关闭');
  }
}

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
  // 启动TCP和WebSocket服务器
  startDataServer();
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopDataServer();
  app.quit();
});
