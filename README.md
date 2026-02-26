# WebRTC 视频墙项目

基于 WebRTC 和 MediaMTX 的多路视频流实时播放系统。

## 功能特点

- 支持多路视频流同时播放（11路视频）
- 使用 WHEP 协议通过 WebRTC 传输视频
- 自动检测并启动 MediaMTX 流媒体服务器
- Python HTTP 服务器提供静态文件服务
- 自动端口检测和分配
- 优雅的进程关闭机制

## 项目结构

```
.
├── index.html              # 主页面
├── app.js                  # WebRTC 连接和视频流处理逻辑
├── style.css               # 样式文件
├── start_http_service.py   # 启动脚本
├── config.json             # 配置文件
└── README.md               # 本文档
```

## 环境要求

- Python 3.6+
- MediaMTX 流媒体服务器
- 现代浏览器（支持 WebRTC）

## 配置说明

编辑 `config.json` 文件进行配置：

```json
{
  "mediamtx_path": "/home/hkcrc/mediamtx",  // MediaMTX 可执行文件路径
  "http_port": 8890                          // HTTP 服务端口
}
```

### 配置项说明

- `mediamtx_path`: MediaMTX 可执行文件的完整路径
- `http_port`: HTTP 服务器监听端口（默认 8890）

## 使用方法

### 1. 启动服务

```bash
python3 start_http_service.py
```

脚本会自动：
1. 检测 MediaMTX 是否运行，未运行则启动
2. 在指定端口（默认 8890）启动 HTTP 服务器
3. 如果端口被占用，自动选择下一个可用端口

### 2. 访问页面

在浏览器中打开：

```
http://localhost:8890/index.html
```

### 3. 停止服务

按 `Ctrl+C` 停止服务，脚本会自动：
- 关闭 HTTP 服务器
- 如果 MediaMTX 是由脚本启动的，则同时关闭 MediaMTX

## 视频流配置

在 `app.js` 中配置视频流的 WHEP 端点：

```javascript
const streams = {
  main_up: {
    whepUrl: "http://localhost:8889/testfile/whep",
  },
  // ... 更多视频流配置
};
```

### 视频流列表

项目支持以下 11 路视频流：

- `main_up`: 主视角上部分 4K
- `main_down`: 主视角下部分 4K
- `car_down`: 小车向下视角 4K
- `left1`: 尾部视角 1080p
- `left2`: 第三视角 1080p
- `left3`: 驾驶舱 1080p
- `center`: 原舱平视 1080p
- `center_lr`: 左侧视角 1080p
- `right1`: 小车卷扬机 1080p
- `right2`: 吊勾卷扬机 1080p
- `right3`: 小车向下复用 1080p

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
