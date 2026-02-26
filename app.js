const streams = {
  main_up: {
    whepUrl: "http://localhost:8889/testfile/whep",
  },
  main_down: {
    whepUrl: "http://localhost:8889/mainUrlDown/whep",
  },
  car_down: {
    whepUrl: "http://localhost:8889/carDownUrl/whep"
  },
  left1: {
    whepUrl: "http://localhost:8889/left1Url/whep",
  },
  left2: {
    whepUrl: "http://localhost:8889/left2Url/whep",
  },
  left3: {
    whepUrl: "http://localhost:8889/left3Url/whep",
  },
  center: {
    whepUrl: "http://localhost:8889/centerUrl/whep",
  },
  center_lr: {
    whepUrl: "http://localhost:8889/centerLRUrl/whep",
  },
  right1: {
    whepUrl: "http://localhost:8889/right1Url/whep",
  },
  right2: {
    whepUrl: "http://localhost:8889/right2Url/whep",
  },
  right3: {
    whepUrl: "http://localhost:8889/right3Url/whep",
  },
};

const stage = document.getElementById("stage");
const peers = new Map();
const stageWidth = 6480;
const stageHeight = 3840;

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
    // 1–2 fast public STUN (Google's are very reliable and low-latency)
    { urls: "stun:stun.l.google.com:19302" },
    // { urls: "stun:stun1.l.google.com:19302" },  // optional second one — usually enough with just one

    // One good TURN with UDP + TCP/TLS fallbacks (use a single reliable provider)
  

    // If you self-host coturn later, replace the above block with your own single TURN entry
  ],
  sdpSemantics: "unified-plan",
  // Optional: If you're sure direct LAN paths work most of the time, you can experiment with
  // iceTransportPolicy: "all"  // default
  // or temporarily "relay" to force TURN-only for debugging
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
  // 不等待 ICE gathering 完成，立即发送 offer 以加快连接速度

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
  const label = panel.querySelector(".stream-url");
  const whepUrl = cfg.whepUrl;

  if (label) {
    label.textContent = whepUrl || "(missing whepUrl)";
  }

  if (!video || !whepUrl) {
    return;
  }

  try {
    const pc = await startWhep(video, whepUrl);
    peers.set(whepUrl, pc);
  } catch (error) {
    console.error("WHEP start failed", whepUrl, error);
    if (label) {
      label.textContent = `${whepUrl} (failed)`;
    }
  }
};

const initPanels = () => {
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

applyScale();
initPanels();
window.addEventListener("resize", applyScale);

const http = require('http');
const port = 3000;

const requestHandler = (request, response) => {
    response.end('Hello, World!');
};

const server = http.createServer(requestHandler);

// 启动服务
startServer();

const { exec } = require('child_process');

const checkAndStartMediaMtx = () => {
    exec('pgrep mediamtx', (error, stdout, stderr) => {
        if (error) {
            console.log('MediaMTX is not running, starting it...');
            exec('mediamtx &', (err) => {
                if (err) {
                    console.error('Error starting MediaMTX:', err);
                } else {
                    console.log('MediaMTX started successfully.');
                    startServer();
                }
            });
        } else {
            console.log('MediaMTX is already running.');
            startServer();
        }
    });
};

// 在启动 HTTP 服务之前检查并启动 MediaMTX
checkAndStartMediaMtx();
