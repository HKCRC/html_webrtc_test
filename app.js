const streams = {
  mainUrlUp: {
    source: "rtsp://admin:crcHK3130@192.168.31.8:554/Streaming/channels/201",
    whepUrl: "http://localhost:8889/mainUrlUp/whep",
  },
  mainUrlDown: {
    source: "rtsp://admin:crcHK3130@192.168.31.8:554/Streaming/channels/201",
    whepUrl: "http://localhost:8889/mainUrlDown/whep",
  },
  car_down: {
    source: "rtsp://admin:crcHK3130@192.168.31.238:554/Streaming/channels/401",
    whepUrl: "http://localhost:8889/carDownUrl/whep"
  },
  left1Url: {
    source: "rtsp://admin:crcHK3130@192.168.31.238:554/Streaming/channels/501",
    whepUrl: "http://localhost:8889/left1Url/whep",
  },
  left2Url: {
    source: "rtsp://admin:crcHK3130@192.168.31.238:554/Streaming/channels/501",
    whepUrl: "http://localhost:8889/left2Url/whep",
  },
  left3Url: {
    source: "rtsp://admin:crcHK3130@192.168.31.238:554/Streaming/channels/601",
    whepUrl: "http://localhost:8889/left3Url/whep",
  },
  centerUrl: {
    source: "rtsp://admin:crcHK3130@192.168.31.238:554/Streaming/channels/501",
    whepUrl: "http://localhost:8889/centerUrl/whep",
  },
  centerLRUrl: {
    source: "rtsp://admin:crcHK3130@192.168.31.238:554/Streaming/channels/501",
    whepUrl: "http://localhost:8889/centerLRUrl/whep",
  },
  right1Url: {
    source: "rtsp://admin:crcHK3130@192.168.31.238:554/Streaming/channels/101",
    whepUrl: "http://localhost:8889/right1Url/whep",
  },
  right2Url: {
    source: "rtsp://admin:crcHK3130@192.168.31.238:554/Streaming/channels/802",
    whepUrl: "http://localhost:8889/right2Url/whep",
  },
  right3Url: {
    source: "rtsp://admin:crcHK3130@192.168.31.238:554/Streaming/channels/101",
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
  await waitIceGatheringComplete(pc);

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
  document.querySelectorAll(".panel[data-stream]").forEach((panel) => {
    const key = panel.dataset.stream;
    const cfg = streams[key];
    if (cfg) {
      attachStream(panel, cfg);
    }
  });
};

applyScale();
initPanels();
window.addEventListener("resize", applyScale);
