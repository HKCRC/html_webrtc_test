// 从 config.json 加载配置
let streams = {};

const loadConfig = async () => {
  try {
    const response = await fetch('./config.json');
    const config = await response.json();
    streams = config.streams || {};
    console.log('Loaded streams from config.json:', Object.keys(streams).length, 'streams');
  } catch (error) {
    console.error('Failed to load config.json:', error);
    streams = {};
  }
};

// 初始化应用
const initApp = async () => {
  await loadConfig();
  applyScale();
  await initPanels();
};

// 当 DOM 完全加载时初始化应用
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  // DOM 已经加载完成，直接初始化（当脚本在 body 最后加载时）
  initApp();
}


const stage = document.getElementById("stage");
const peers = new Map();
const stageWidth = 8400;  // 实际多屏宽度
const stageHeight = 3840; // 实际多屏高度
let refreshing = false;

// ── 日志工具函数 ────────────────────────────────────────────────────────────
const createLogger = (streamUrl) => {
  const streamName = Object.entries(streams).find(([_, cfg]) => cfg.whepUrl === streamUrl)?.[0] || streamUrl;
  const timestamp = () => new Date().toLocaleTimeString('zh-CN', { hour12: false });
  return {
    info: (msg) => console.log(`[${timestamp()}] [${streamName}] ✓ ${msg}`),
    warn: (msg) => console.warn(`[${timestamp()}] [${streamName}] ⚠ ${msg}`),
    error: (msg) => console.error(`[${timestamp()}] [${streamName}] ✗ ${msg}`),
  };
};

// ── 重连机制配置 ──────────────────────────────────────────────────────────
const RECONNECT_CONFIG = {
  initialDelay: 1000,      // 初始重连延迟 (ms)
  maxDelay: 30000,         // 最大重连延迟 (ms)
  backoffMultiplier: 1.5,  // 指数退避乘数
  maxRetries: 100,          // 最大重试次数
};

// ── 每个流的重连状态管理 ────────────────────────────────────────────────────
const streamReconnectState = new Map(); // Key: whepUrl, Value: { retryCount, delay, timeoutId, isConnected }

const getStreamState = (whepUrl) => {
  if (!streamReconnectState.has(whepUrl)) {
    streamReconnectState.set(whepUrl, {
      retryCount: 0,
      delay: RECONNECT_CONFIG.initialDelay,
      timeoutId: null,
      isConnected: false,
      isReconnecting: false,
      panel: null,
    });
  }
  return streamReconnectState.get(whepUrl);
};

const resetStreamState = (whepUrl) => {
  const state = getStreamState(whepUrl);
  const logger = createLogger(whepUrl);
  if (state.retryCount > 0) {
    logger.info(`连接已恢复，重试计数重置 (之前: ${state.retryCount}次)`);
  }
  state.retryCount = 0;
  state.delay = RECONNECT_CONFIG.initialDelay;
  state.isConnected = true;
  state.isReconnecting = false;
  if (state.timeoutId !== null) {
    clearTimeout(state.timeoutId);
    state.timeoutId = null;
  }
};

const updateRetryDelay = (whepUrl) => {
  const state = getStreamState(whepUrl);
  const logger = createLogger(whepUrl);
  const oldDelay = state.delay;
  state.retryCount++;
  state.delay = Math.min(
    state.delay * RECONNECT_CONFIG.backoffMultiplier,
    RECONNECT_CONFIG.maxDelay
  );
  logger.warn(`重试延迟更新: ${oldDelay}ms → ${state.delay}ms (重试: ${state.retryCount}/${RECONNECT_CONFIG.maxRetries})`);
};

const scheduleReconnect = (whepUrl, panel, cfg) => {
  const state = getStreamState(whepUrl);
  const logger = createLogger(whepUrl);
  const statusLabel = panel.querySelector(".stream-status");

  // 如果已经在重连中，不重复触发
  if (state.isReconnecting) {
    logger.info(`已在重连中，跳过重复触发`);
    return;
  }
  state.isReconnecting = true;

  if (state.timeoutId !== null) {
    clearTimeout(state.timeoutId);
    state.timeoutId = null;
  }

  if (state.retryCount >= RECONNECT_CONFIG.maxRetries) {
    logger.error(`已达到最大重试次数 (${RECONNECT_CONFIG.maxRetries}次)，放弃重新连接`);
    if (statusLabel) {
      statusLabel.textContent = "达到最大重试次数";
    }
    state.isReconnecting = false;
    return;
  }

  const retryMsg = `重新连接中... (${state.retryCount}/${RECONNECT_CONFIG.maxRetries})`;
  if (statusLabel) {
    statusLabel.textContent = retryMsg;
  }
  logger.warn(`计划在 ${state.delay}ms 后进行第 ${state.retryCount}/${RECONNECT_CONFIG.maxRetries} 次尝试...`);

  const timeoutId = setTimeout(async () => {
    logger.info(`开始第 ${state.retryCount} 次重连尝试...`);
    state.isReconnecting = false; // 在尝试前重置标志
    try {
      await attachStream(panel, cfg);
      resetStreamState(whepUrl);
    } catch (error) {
      logger.error(`重连尝试失败: ${error.message}`);
      updateRetryDelay(whepUrl);
      scheduleReconnect(whepUrl, panel, cfg);
    }
  }, state.delay);

  state.timeoutId = timeoutId;
};

const applyScale = () => {
  const scale = Math.min(
    window.innerWidth / stageWidth,
    window.innerHeight / stageHeight
  );
  const offsetX = (window.innerWidth - stageWidth * scale) / 2;
  const offsetY = (window.innerHeight - stageHeight * scale) / 2;
  stage.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
};

const waitIceGatheringComplete = (pc) =>
  new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") {
      resolve();
      return;
    }

    const onStateChange = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", onStateChange);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", onStateChange);
  });

const startWhep = async (video, url) => {
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
    ],
    sdpSemantics: "unified-plan",
  });

  pc.addTransceiver("video", { direction: "recvonly" });
  pc.addTransceiver("audio", { direction: "recvonly" });

  pc.addEventListener("track", (event) => {
    const [stream] = event.streams;
    if (stream) {
      video.srcObject = stream;
      video.play().catch((error) => {
        console.warn("Video autoplay failed", error);
      });
    }
  });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/sdp",
    },
    body: pc.localDescription.sdp,
  });

  if (!response.ok) {
    throw new Error(`WHEP request failed: ${response.status}`);
  }

  const answerSdp = await response.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

  return pc;
};

const attachStream = async (panel, cfg) => {
  const video = panel.querySelector("video");
  const statusLabel = panel.querySelector(".stream-status");
  const whepUrl = cfg.whepUrl;
  const logger = createLogger(whepUrl);

  if (statusLabel) {
    statusLabel.textContent = "连接中...";
  }

  if (!video || !whepUrl) {
    logger.error("缺少视频元素或 WHEP URL");
    return;
  }

  logger.info("开始加载视频流...");

  try {
    const pc = await startWhep(video, whepUrl);
    const oldPc = peers.get(whepUrl);
    if (oldPc) {
      oldPc.close();
    }
    peers.set(whepUrl, pc);
    logger.info("WebRTC 连接已建立");

    // 获取或初始化流的状态
    const state = getStreamState(whepUrl);
    state.panel = panel;

    // 监听连接状态变化，实现自动重连
    pc.addEventListener("connectionstatechange", () => {
      logger.info(`连接状态变化: ${pc.connectionState}`);

      if (pc.connectionState === "connected" || pc.connectionState === "completed") {
        // 连接成功，重置重连状态
        logger.info("✓ 连接成功");
        resetStreamState(whepUrl);
        if (statusLabel) {
          statusLabel.textContent = "已连接 ✓";
        }
      } else if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed"
      ) {
        // 连接断开或失败，启动重连
        logger.warn(`连接已${pc.connectionState === "disconnected" ? "断开" : "失败"}，正在启动重连机制...`);
        state.isConnected = false;
        if (statusLabel) {
          statusLabel.textContent = "重新连接中...";
        }
        updateRetryDelay(whepUrl);
        scheduleReconnect(whepUrl, panel, cfg);
      }
    });

    // 监听 ICE 连接状态变化
    pc.addEventListener("iceconnectionstatechange", () => {
      const iceState = pc.iceConnectionState;
      if (iceState === "connected") {
        logger.info(`ICE 连接状态: ${iceState} ✓`);
      } else if (iceState === "checking" || iceState === "gathering") {
        logger.info(`ICE 连接状态: ${iceState}`);
      } else if (iceState === "failed") {
        logger.error(`ICE 连接失败`);
      } else {
        logger.warn(`ICE 连接状态: ${iceState}`);
      }
    });

    if (statusLabel) {
      statusLabel.textContent = "连接中...";
    }
  } catch (error) {
    logger.error(`加载失败: ${error.message}`);
    if (statusLabel) {
      statusLabel.textContent = "加载失败";
    }
    // 初始连接失败，启动重连机制
    const state = getStreamState(whepUrl);
    state.panel = panel;
    state.isConnected = false;
    updateRetryDelay(whepUrl);
    scheduleReconnect(whepUrl, panel, cfg);
  }
};

const initPanels = () => {
  console.log("\n========== 初始化视频面板 ==========");
  // 并行加载所有视频流以加快整体加载速度
  const promises = [];
  document.querySelectorAll(".panel[data-stream]").forEach((panel) => {
    const key = panel.dataset.stream;
    const cfg = streams[key];
    if (cfg) {
      promises.push(attachStream(panel, cfg));
    }
  });
  return Promise.all(promises);
};

const closeAllPeers = () => {
  // 清除所有的重连计时器
  streamReconnectState.forEach((state, whepUrl) => {
    if (state.timeoutId !== null) {
      clearTimeout(state.timeoutId);
      state.timeoutId = null;
    }
  });

  peers.forEach((pc) => {
    try {
      pc.close();
    } catch (error) {
      console.warn("Close peer failed", error);
    }
  });
  peers.clear();

  document.querySelectorAll(".panel[data-stream] video").forEach((video) => {
    video.srcObject = null;
  });
};

const refreshStreams = async () => {
  if (refreshing) {
    return;
  }

  refreshing = true;
  try {
    closeAllPeers();
    await initPanels();
  } finally {
    refreshing = false;
  }
};

window.addEventListener("resize", applyScale);

window.addEventListener("keydown", (event) => {
  if (event.repeat) {
    return;
  }
  if (event.key && event.key.toLowerCase() === "a") {
    refreshStreams();
  }
});
