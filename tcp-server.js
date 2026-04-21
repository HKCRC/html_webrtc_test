const net = require('net');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');

// 读取配置文件
const configPath = path.join(__dirname, 'config.json');
let config = { tcp_port: 8888, ws_port: 8887 }; // 默认端口

try {
  const configData = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configData);
} catch (error) {
  console.warn('无法读取config.json，使用默认端口 8888:', error.message);
}

const TCP_PORT = config.tcp_port || 8888;
const WS_PORT = config.ws_port || 8887;

// 存储最新的数据
let latestData = [0, 0, 0]; // [回转角度, 变幅半径, 吊钩高度]

// 创建HTTP服务器用于WebSocket
const httpServer = http.createServer();
const wss = new WebSocket.Server({ server: httpServer });

// WebSocket连接管理
wss.on('connection', (ws) => {
  console.log('WebSocket客户端连接');
  
  // 客户端连接时发送最新数据
  ws.send(JSON.stringify({ type: 'update', data: latestData }));
  
  ws.on('close', () => {
    console.log('WebSocket客户端断开连接');
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket错误:', error.message);
  });
});

// 广播数据给所有WebSocket客户端
function broadcastData(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'update', data: data }));
    }
  });
}

// 创建TCP服务器
const server = net.createServer((socket) => {
  console.log('客户端连接:', socket.remoteAddress, socket.remotePort);

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
    console.log('客户端断开连接');
  });

  socket.on('error', (error) => {
    console.error('连接错误:', error.message);
  });
});

server.listen(TCP_PORT, '0.0.0.0', () => {
  console.log(`TCP服务器运行在 0.0.0.0:${TCP_PORT}`);
  console.log('等待客户端连接...');
  console.log('\n期望的数据格式 (JSON数组):');
  console.log('[回转角度, 变幅半径, 吊钩高度]');
  console.log('例: [45.5, 52.2, 12.1]');
  console.log('\n或二进制格式 (3个 float, 共12字节, 小端序)');
});

// 启动WebSocket服务器
httpServer.listen(WS_PORT, '0.0.0.0', () => {
  console.log(`WebSocket服务器运行在 ws://0.0.0.0:${WS_PORT}`);
});

server.on('error', (error) => {
  console.error('服务器错误:', error.message);
});
