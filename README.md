# WebRTC 视频墙项目

基于 WebRTC 和 MediaMTX 的多路视频流实时播放系统，支持自动重连和详细日志记录。

## ✨ 核心功能特点

### 视频流播放
- ✅ 支持多路视频流同时播放（8路视频）
- ✅ 使用 WHEP 协议通过 WebRTC 传输视频
- ✅ 高效的并行加载机制

### 自动重连机制
- ✅ **智能自动重连** - 每个视频流独立重连，互不影响
- ✅ **指数退避算法** - 避免频繁重试
  - 初始延迟：1000ms
  - 每次失败延迟增加 1.5 倍
  - 最大延迟：30秒
  - 最多重试：20 次
- ✅ **双重覆盖** - 处理初始连接失败和中途断开两种情况
- ✅ **实时状态指示** - UI 显示连接状态（✓ 成功 / ⚠ 重连中 / ✗ 失败）

### Electron 桌面应用
- ✅ 窗口尺寸 8400×3840px（支持多显示器拼接）
- ✅ 全屏启动，无边框设计
- ✅ 自动适配显示器大小

### 日志系统
- ✅ **详细的重连日志** - 实时打印每个流的重连过程
- ✅ **统一日志格式** - `[时间] [流名称] [符号] 消息`
- ✅ **颜色分类** - 绿色(info) / 黄色(warn) / 红色(error)

## 📋 项目结构

```
.
├── index.html              # 主页面（视频布局）
├── app.js                  # WebRTC 连接和视频流处理逻辑（核心）
├── style.css               # 样式文件
├── main.js                 # Electron 主进程入口
├── package.json            # NPM 项目配置
├── config.json             # 配置文件（视频流地址、端口等）
├── mediamtx.yml            # MediaMTX 配置文件
├── start_http_service.py   # 旧版 Python 启动脚本（已废弃）
└── README.md               # 本文档
```

## 🔧 环境要求

- **Node.js 18+**
- **MediaMTX 流媒体服务器** - 用于流媒体转发
- **Electron** - 通过 `npm install` 自动安装

## ⚙️ 配置说明

编辑 `config.json` 文件进行配置：

```json
{
  "mediamtx_path": "/home/craner/mediamtx_v1.16.2_linux_amd64/mediamtx",
  "http_port": 8890,
  "streams": {
    "main_up": {
      "whepUrl": "http://localhost:8889/MainViewTop/whep",
      "name": "主视角上部分 4K"
    },
    "car_down": {
      "whepUrl": "http://localhost:8889/CV3DCCTV/whep",
      "name": "小车向下视角 4K"
    },
    "left1": {
      "whepUrl": "http://localhost:8889/ThridPersonView/whep",
      "name": "尾部视角 1080p"
    },
    "left2": {
      "whepUrl": "http://localhost:8889/FrontView/whep",
      "name": "第三视角 1080p"
    },
    "left3": {
      "whepUrl": "http://localhost:8889/RearView/whep",
      "name": "驾驶舱 1080p"
    },
    "center_lr": {
      "whepUrl": "http://localhost:8889/HoistView/whep",
      "name": "左侧视角 1080p"
    },
    "right1": {
      "whepUrl": "http://localhost:8889/SlewView/whep",
      "name": "小车卷扬机 1080p"
    },
    "right2": {
      "whepUrl": "http://localhost:8889/LuffView/whep",
      "name": "吊勾卷扬机 1080p"
    }
  }
}
```

### 配置项详解

| 配置项 | 说明 | 示例 |
|--------|------|------|
| `mediamtx_path` | MediaMTX 可执行文件的完整路径 | `/home/user/mediamtx` |
| `http_port` | HTTP 服务器监听端口 | `8890` |
| `streams.[key].whepUrl` | WHEP 协议端点 URL | `http://localhost:8889/stream/whep` |
| `streams.[key].name` | 视频流显示名称 | `主视角上部分 4K` |

## 🚀 使用方法

### 1️⃣ 首次安装依赖

```bash
npm install
```

### 2️⃣ 启动应用

```bash
npm start
```

启动后：
- 应用自动加载 `config.json` 中配置的视频流
- 创建全屏 Electron 窗口
- 并行连接所有视频流
- 实时显示连接状态和重连日志

### 3️⃣ 在应用中的操作

| 按键 | 功能 | 说明 |
|------|------|------|
| `ESC` | 退出应用 | 关闭 Electron 窗口 |
| `A` | 刷新所有流 | 断开所有连接重新连接 |

### 4️⃣ 查看日志

打开浏览器开发者工具查看详细日志：

```
========== 初始化视频面板 ==========
[10:30:15] [main_up] ✓ 开始加载视频流...
[10:30:15] [car_down] ✓ 开始加载视频流...
[10:30:16] [main_up] ✓ WebRTC 连接已建立
[10:30:17] [main_up] ✓ 连接状态变化: connected
[10:30:17] [main_up] ✓ ✓ 连接成功
[10:30:18] [car_down] ⚠ 连接已断开，正在启动重连机制...
[10:30:18] [car_down] ⚠ 重试延迟更新: 1000ms → 1500ms (重试: 1/20)
[10:30:20] [car_down] ✓ 开始第 1 次重连尝试...
[10:30:21] [car_down] ✓ ✓ 连接成功
```

**日志符号说明：**
- `✓` (info) - 正常操作日志
- `⚠` (warn) - 警告/重试日志
- `✗` (error) - 错误日志

## 🔄 重连机制详解

### 工作原理

1. **连接初始化** - 应用启动时并行连接所有视频流
2. **实时监听** - 监听 WebRTC 连接状态变化
3. **自动检测** - 检测到连接断开或失败时立即触发重连
4. **智能延迟** - 使用指数退避算法避免频繁重试
5. **独立管理** - 每个流独立维护重连状态，互不影响

### 重连流程

```
初始连接失败
    ↓
启动重连 (第1次，延迟1000ms)
    ↓
重连失败 → 更新延迟 (1000ms × 1.5 = 1500ms)
    ↓
启动重连 (第2次，延迟1500ms)
    ↓
重连成功 → 重置计数器，显示 ✓
```

### 状态指示

| UI 显示 | 含义 | 处理方式 |
|--------|------|--------|
| `URL ✓` | 连接成功 | 正常播放 |
| `URL (connecting...)` | 连接中 | 等待连接 |
| `URL (reconnecting...)` | 重新连接中 | 指数退避重试 |
| `URL (failed)` | 初始连接失败 | 启动自动重连 |
| `URL (max retries reached)` | 达到重试上限 | 放弃重连 |

## 📺 支持的视频流

当前应用支持 8 路视频流（按布局排列）：

### 主视图（左侧）
- **main_up** - 主视角上部分 4K

### 副视图网格（右侧）
- **car_down** - 小车向下视角 4K
- **left1** - 尾部视角 1080p
- **left2** - 第三视角 1080p
- **left3** - 驾驶舱 1080p
- **center_lr** - 左侧视角 1080p
- **right1** - 小车卷扬机 1080p
- **right2** - 吊勾卷扬机 1080p

## 🛠️ 高级配置

### 修改重连参数

编辑 `app.js` 中的 `RECONNECT_CONFIG`：

```javascript
const RECONNECT_CONFIG = {
  initialDelay: 1000,      // 初始重连延迟 (ms)
  maxDelay: 30000,         // 最大重连延迟 (ms)
  backoffMultiplier: 1.5,  // 指数退避乘数
  maxRetries: 20,          // 最大重试次数
};
```

### 添加新的视频流

只需编辑 `config.json`，在 `streams` 对象中添加新流：

```json
"new_stream": {
  "whepUrl": "http://localhost:8889/new_stream/whep",
  "name": "新的视频流"
}
```

然后在 `index.html` 中添加对应的面板元素：

```html
<section class="panel new-stream" data-stream="new_stream">
  <video autoplay muted playsinline></video>
  <div class="label">
    <div class="name">新的视频流</div>
    <div class="stream-url"></div>
  </div>
</section>
```

## 📊 系统架构

```
MediaMTX (流媒体服务器)
    ↓ WHEP 协议
WebRTC PeerConnection (每个流独立)
    ↓ 连接状态监听
自动重连机制 (指数退避)
    ↓ 
HTML5 视频元素 (video tag)
    ↓
显示器输出
```

## 🔍 故障排查

### 视频无法播放

1. 确保 MediaMTX 正在运行
2. 确认 `config.json` 中的 WHEP URL 正确
3. 查看浏览器控制台日志，查找错误信息

### 连接频繁断开

1. 检查网络稳定性
2. 增加 `RECONNECT_CONFIG` 中的 `maxRetries`
3. 增加 `maxDelay` 避免过频繁的重试

### 应用无法启动

1. 验证 `mediamtx_path` 指向的文件存在且有执行权限
2. 检查 Node.js 版本 >= 18
3. 运行 `npm install` 重新安装依赖

## 📝 技术栈

- **WebRTC API** - 实时视频流传输
- **WHEP 协议** - WebRTC-HTTP Egress Protocol
- **Electron** - 跨平台桌面应用框架
- **JavaScript (Vanilla)** - 无额外前端框架依赖
- **MediaMTX** - RTMP/RTSP/WebRTC 流媒体服务器

## 性能优化

项目已进行以下优化：

1. **并行加载**：所有视频流同时加载，而非顺序加载
2. **快速连接**：移除 ICE gathering 等待，使用 Trickle ICE 加速连接
3. **端口复用**：自动检测和使用可用端口

## 故障排除

### MediaMTX 无法启动

- 检查 `config.json` 中的 `mediamtx_path` 是否正确
- 确认 MediaMTX 可执行文件有执行权限：`chmod +x /path/to/mediamtx`

### 视频无法播放

1. 检查浏览器控制台的错误信息
2. 确认 MediaMTX 正在运行：`pgrep mediamtx`
3. 检查 WHEP 端点 URL 是否正确（默认 `http://localhost:8889`）
4. 确认视频流已推送到 MediaMTX

### 端口被占用

脚本会自动选择下一个可用端口。如需指定端口，修改 `config.json` 中的 `http_port`。

## 技术栈

- **前端**: HTML5, JavaScript, WebRTC
- **后端**: Python HTTP Server
- **流媒体**: MediaMTX (WHEP 协议)
- **协议**: WebRTC, WHEP (WebRTC-HTTP Egress Protocol)

## 许可证

请根据项目实际情况添加许可证信息。
