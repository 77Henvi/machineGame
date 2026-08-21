// ===============================
// Teachable Machine Model
// ===============================
// ⚠️ TODO ก่อน deploy จริง: URL นี้ยังเป็นโมเดลเก่า (3 class: stand/walk/jump)
// ต้องรอฝ่าย Mocap ส่งข้อมูล แล้วเทรนโมเดลใหม่ใน Teachable Machine (Pose Project)
// ด้วย 4 class ชื่อตรงกับ key ใน STRETCH_SEQUENCE ด้านล่างเป๊ะ ๆ (ตัวพิมพ์เล็ก):
//   neck_stretch, shoulder_roll, arms_overhead, chest_opener
// แล้วนำ URL โมเดลใหม่มาแทนบรรทัดถัดไป
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/wEOUzks49/";
const CONFIDENCE_LIMIT = 0.80;

// Fix 5: throttle การ predict เพราะ pose estimation หนัก ไม่จำเป็นต้องรันทุกเฟรม (60fps)
// สำหรับเกมที่เน้นค้างท่านิ่งๆ 100ms (~10fps) ก็เพียงพอ ประหยัดแบต/CPU มาก
const PREDICT_INTERVAL_MS = 100;
let lastPredictTime = 0;

let model;
let webcam;
let cameraCtx;
let maxPredictions;
let isRunning = false;

let currentPose = "neutral";
let currentConfidence = 0;

// ===============================
// Stretch Break sequence config
// ===============================
const STRETCH_SEQUENCE = [
  { key: "neck_stretch", label: "ยืดคอ", instruction: "เอียงคอไปด้านข้างเบาๆ ค้างไว้", holdSeconds: 8 },
  { key: "shoulder_roll", label: "หมุนไหล่", instruction: "ยกไหล่ขึ้นแล้วหมุนเป็นวงช้าๆ", holdSeconds: 8 },
  { key: "arms_overhead", label: "ยกแขนเหนือหัว", instruction: "ยกแขนสองข้างเหยียดขึ้นเหนือศีรษะ", holdSeconds: 8 },
  { key: "chest_opener", label: "เปิดอก", instruction: "กางแขนไปด้านหลัง เปิดหน้าอก", holdSeconds: 8 }
];

const HOLD_DECAY_PER_SEC = 1.6; // ความเร็วที่วงจะลดลงเมื่อหลุดท่า

// ===============================
// Game Variables
// ===============================
const gameCanvas = document.getElementById("gameCanvas");
const gameCtx = gameCanvas.getContext("2d");
gameCtx.imageSmoothingEnabled = false;
const confettiCanvasEl = document.getElementById("confettiCanvas");
const GAME_FONT = "'Press Start 2P', 'JetBrains Mono', monospace";

let gameRunning = false;
let gameOver = false; // true = จบ 1 รอบพักแล้ว (ใช้ชื่อเดิมไว้ให้ tooling/CSS เข้ากันได้)
let stepIndex = 0;
let heldSeconds = 0;
let totalHeldSeconds = 0; // เวลาที่ค้างท่าสำเร็จรวมทั้งรอบ (แสดงเป็นคะแนน)
let lastFrameTime = null;
let hasPlayedStepChime = false;

const STREAK_KEY = "stretchBreakStreak";
const STREAK_DATE_KEY = "stretchBreakLastDate";

// ===============================
// Fix 3: localStorage อาจ throw ได้ (Safari private mode, cookies ปิด ฯลฯ)
// ครอบทุกจุดที่แตะ localStorage ด้วย try/catch ไม่ให้เกมพังทั้งฟังก์ชัน
// ===============================
function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn("localStorage ใช้งานไม่ได้:", e);
    return null;
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn("localStorage ใช้งานไม่ได้:", e);
    return false;
  }
}

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

function getStreak() {
  return parseInt(safeGetItem(STREAK_KEY) || "0", 10);
}

function registerCompletionForStreak() {
  const today = getTodayString();
  const lastDate = safeGetItem(STREAK_DATE_KEY);

  if (lastDate === today) {
    // ทำสำเร็จไปแล้ววันนี้ ไม่นับซ้ำ
    return getStreak();
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayString = yesterday.toISOString().slice(0, 10);

  let streak = getStreak();
  streak = lastDate === yesterdayString ? streak + 1 : 1;

  safeSetItem(STREAK_KEY, String(streak));
  safeSetItem(STREAK_DATE_KEY, today);

  return streak;
}

// ===============================
// Fix 4: Sound + Vibration feedback
// ใช้ WebAudio เสียงสั้นๆ (ไม่ต้องพึ่งไฟล์เสียงภายนอก) และ navigator.vibrate บนมือถือ
// เผื่อ user ไม่ได้จ้องจอตลอดตอนกำลังยืดเหยียด
// ===============================
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();
  }
  return audioCtx;
}

function playChime(frequency, durationMs) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + durationMs / 1000);
  } catch (e) {
    console.warn("เล่นเสียงไม่ได้:", e);
  }
}

function vibrateIfSupported(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (e) {
    // เงียบไว้ ไม่ใช่ฟีเจอร์จำเป็น
  }
}

function playStepCompleteFeedback() {
  playChime(880, 180);
  vibrateIfSupported(120);
}

function playRoundCompleteFeedback() {
  playChime(660, 150);
  setTimeout(() => playChime(990, 220), 160);
  vibrateIfSupported([100, 60, 100, 60, 200]);
}

// ===============================
// Fix 6: Responsive canvas — ให้ canvas วาดตามความกว้างจริงของ container
// แทนที่จะ fix 600x300 ตายตัว ป้องกันตัวหนังสือ/ring เล็กเกินไปบนจอมือถือแคบๆ
// ===============================
function resizeGameCanvas() {
  const wrap = gameCanvas.parentElement;
  const displayWidth = Math.round(wrap.clientWidth);
  const displayHeight = Math.round(displayWidth / 2); // รักษาสัดส่วน 2:1 เท่าของเดิม (600x300)

  gameCanvas.width = displayWidth;
  gameCanvas.height = displayHeight;
  confettiCanvasEl.width = displayWidth;
  confettiCanvasEl.height = displayHeight;

  drawGame();
}

window.addEventListener("resize", resizeGameCanvas);

async function init() {
  const startBtn = document.getElementById("startBtn");
  const actionText = document.getElementById("action");

  startBtn.disabled = true;
  startBtn.innerHTML = "กำลังโหลด...";
  actionText.innerHTML = "สถานะ: กำลังโหลดโมเดล";

  // Fix 2: แยกขั้นตอนโหลดโมเดล vs เปิดกล้อง เพื่อบอก user ได้ตรงจุดว่าปัญหาอยู่ที่ไหน

  // ----- ขั้นที่ 1: โหลดโมเดล -----
  try {
    const modelURL = MODEL_URL + "model.json";
    const metadataURL = MODEL_URL + "metadata.json";

    model = await tmPose.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();

    if (maxPredictions !== 4) {
      actionText.innerHTML = "คำเตือน: โมเดลนี้ไม่ได้มี 4 Class ตามท่ายืดเหยียดที่กำหนด";
    }
  } catch (error) {
    console.error("โหลดโมเดลไม่สำเร็จ:", error);
    startBtn.disabled = false;
    startBtn.innerHTML = "เริ่มพัก";
    actionText.innerHTML = "เกิดข้อผิดพลาด: โหลดโมเดลไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตหรือ MODEL_URL";
    return;
  }

  // ----- ขั้นที่ 2: เปิดกล้อง -----
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    startBtn.disabled = false;
    startBtn.innerHTML = "เริ่มพัก";
    actionText.innerHTML = "เบราว์เซอร์นี้ไม่รองรับการเปิดกล้อง กรุณาใช้ Chrome/Edge/Safari เวอร์ชันล่าสุด";
    return;
  }

  try {
    actionText.innerHTML = "สถานะ: กำลังขอสิทธิ์เปิดกล้อง...";

    const size = 400;
    const flip = true;

    webcam = new tmPose.Webcam(size, size, flip);

    await webcam.setup();
    await webcam.play();

    const cameraCanvas = document.getElementById("cameraCanvas");
    cameraCanvas.width = size;
    cameraCanvas.height = size;
    cameraCtx = cameraCanvas.getContext("2d");

    isRunning = true;
    startBtn.innerHTML = "กำลังใช้งาน";
    actionText.innerHTML = "สถานะ: เริ่มตรวจจับท่าทางแล้ว";

    resizeGameCanvas();
    startGame();

    window.requestAnimationFrame(loop);
  } catch (error) {
    console.error("เปิดกล้องไม่สำเร็จ:", error);
    startBtn.disabled = false;
    startBtn.innerHTML = "เริ่มพัก";

    if (error && error.name === "NotAllowedError") {
      actionText.innerHTML = "กรุณาอนุญาตการใช้กล้องในเบราว์เซอร์ แล้วกดเริ่มพักอีกครั้ง";
    } else if (error && error.name === "NotFoundError") {
      actionText.innerHTML = "ไม่พบกล้องบนอุปกรณ์นี้";
    } else {
      actionText.innerHTML = "เกิดข้อผิดพลาด: เปิดกล้องไม่สำเร็จ";
    }
  }
}

async function loop(timestamp) {
  if (!isRunning) return;

  webcam.update();

  // Fix 5: predict เฉพาะเมื่อครบ interval ที่กำหนด ไม่ใช่ทุกเฟรม
  if (timestamp - lastPredictTime >= PREDICT_INTERVAL_MS) {
    lastPredictTime = timestamp;
    await predict();
  } else {
    // ยังอัปเดตภาพกล้อง (โครงกระดูก) จาก pose ล่าสุดไม่ได้ถ้าไม่ predict ใหม่
    // แต่ยัง draw ภาพกล้องสดได้เพื่อไม่ให้จอค้าง
    if (cameraCtx) cameraCtx.drawImage(webcam.canvas, 0, 0);
  }

  updateGame(timestamp);
  drawGame();

  window.requestAnimationFrame(loop);
}

async function predict() {
  const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
  const prediction = await model.predict(posenetOutput);

  const class1Name = prediction[0].className;
  const class1Score = prediction[0].probability;

  const class2Name = prediction[1].className;
  const class2Score = prediction[1].probability;

  const class3Name = prediction[2] ? prediction[2].className : "-";
  const class3Score = prediction[2] ? prediction[2].probability : 0;

  document.getElementById("class1").innerHTML =
    class1Name + ": " + (class1Score * 100).toFixed(2) + "%";

  document.getElementById("class2").innerHTML =
    class2Name + ": " + (class2Score * 100).toFixed(2) + "%";

  document.getElementById("class3").innerHTML =
    class3Name + ": " + (class3Score * 100).toFixed(2) + "%";

  let bestPrediction = prediction[0];

  for (let i = 1; i < prediction.length; i++) {
    if (prediction[i].probability > bestPrediction.probability) {
      bestPrediction = prediction[i];
    }
  }

  const resultName = bestPrediction.className;
  const resultScore = bestPrediction.probability;

  document.getElementById("result").innerHTML =
    "ผลลัพธ์: " + resultName;

  document.getElementById("confidence").innerHTML =
    "ความมั่นใจ: " + (resultScore * 100).toFixed(2) + "%";

  if (resultScore < CONFIDENCE_LIMIT) {
    currentPose = "unknown";
    currentConfidence = resultScore;

    document.getElementById("action").innerHTML =
      "สถานะ: ยังไม่มั่นใจพอ";
  } else {
    currentPose = resultName.toLowerCase();
    currentConfidence = resultScore;

    document.getElementById("action").innerHTML =
      "สถานะ: ตรวจพบ " + resultName;
  }

  drawPose(pose);
}

function drawPose(pose) {
  cameraCtx.drawImage(webcam.canvas, 0, 0);

  if (pose) {
    const minPartConfidence = 0.5;
    tmPose.drawKeypoints(pose.keypoints, minPartConfidence, cameraCtx);
    tmPose.drawSkeleton(pose.keypoints, minPartConfidence, cameraCtx);
  }
}

// ===============================
// Game Logic: Stretch Break (hold-timer sequence)
// ===============================
function startGame() {
  gameRunning = true;
  gameOver = false;
  stepIndex = 0;
  heldSeconds = 0;
  totalHeldSeconds = 0;
  lastFrameTime = null;
  hasPlayedStepChime = false;

  currentPose = "neutral";

  const step = STRETCH_SEQUENCE[stepIndex];
  document.getElementById("gameStatus").innerHTML =
    "ทำท่า: " + step.label + " (1/" + STRETCH_SEQUENCE.length + ")";
  document.getElementById("gameScore").innerHTML =
    "ค้างท่าแล้ว: 0 วิ";
}

function restartGame() {
  startGame();
}

// Fix 7: ปุ่ม "ข้ามท่านี้" — เผื่อ user ไม่สะดวกทำท่าใดท่าหนึ่งกลางรอบ
// ข้ามไปท่าถัดไปทันทีโดยไม่ได้คะแนนของท่านั้น (ไม่ใช่ช่องโหว่ให้โกงคะแนนรวม)
function skipCurrentStep() {
  if (!gameRunning || gameOver) return;

  stepIndex += 1;
  heldSeconds = 0;
  hasPlayedStepChime = false;

  if (stepIndex >= STRETCH_SEQUENCE.length) {
    completeRound();
  } else {
    const step = STRETCH_SEQUENCE[stepIndex];
    document.getElementById("gameStatus").innerHTML =
      "ข้ามท่าแล้ว — ทำท่า: " + step.label + " (" + (stepIndex + 1) + "/" + STRETCH_SEQUENCE.length + ")";
  }
}

function updateGame(timestamp) {
  if (!gameRunning || gameOver) {
    lastFrameTime = null;
    return;
  }

  if (lastFrameTime === null) {
    lastFrameTime = timestamp;
    return;
  }

  const dt = (timestamp - lastFrameTime) / 1000;
  lastFrameTime = timestamp;

  const step = STRETCH_SEQUENCE[stepIndex];
  const isCorrectPose = currentPose === step.key;

  if (isCorrectPose) {
    heldSeconds = Math.min(step.holdSeconds, heldSeconds + dt);

    document.getElementById("gameStatus").innerHTML =
      "ทำท่า: " + step.label + " (" + (stepIndex + 1) + "/" + STRETCH_SEQUENCE.length + ")";
  } else {
    heldSeconds = Math.max(0, heldSeconds - dt * HOLD_DECAY_PER_SEC);
    hasPlayedStepChime = false;

    if (currentPose === "unknown") {
      document.getElementById("gameStatus").innerHTML =
        "รอให้โมเดลมั่นใจก่อน — ทำท่า: " + step.label;
    } else {
      document.getElementById("gameStatus").innerHTML =
        "ยังไม่ตรงท่า — ทำท่า: " + step.label;
    }
  }

  document.getElementById("gameScore").innerHTML =
    "ค้างท่าแล้ว: " + Math.round(totalHeldSeconds + heldSeconds) + " วิ";

  if (heldSeconds >= step.holdSeconds) {
    if (!hasPlayedStepChime) {
      hasPlayedStepChime = true;
      playStepCompleteFeedback();
    }

    totalHeldSeconds += step.holdSeconds;
    heldSeconds = 0;
    stepIndex += 1;
    hasPlayedStepChime = false;

    if (stepIndex >= STRETCH_SEQUENCE.length) {
      completeRound();
    }
  }
}

function completeRound() {
  gameRunning = false;
  gameOver = true;

  const streak = registerCompletionForStreak();
  playRoundCompleteFeedback();

  document.getElementById("gameStatus").innerHTML =
    "เสร็จสิ้น 1 รอบพัก! ต่อเนื่อง " + streak + " วัน";
  document.getElementById("gameScore").innerHTML =
    "ค้างท่ารวม: " + Math.round(totalHeldSeconds) + " วิ";
}

// ===============================
// Draw: progress ring + step list
// Fix 6: ใช้ scale factor ให้ font/ring ปรับตามขนาด canvas จริง (responsive)
// ===============================
function drawGame() {
  const w = gameCanvas.width;
  const h = gameCanvas.height;
  const scale = w / 600; // 600 คือความกว้างฐานเดิมที่ออกแบบไว้

  gameCtx.clearRect(0, 0, w, h);

  // พื้นหลัง
  gameCtx.fillStyle = "#F4F9EC";
  gameCtx.fillRect(0, 0, w, h);

  if (!gameRunning && !gameOver) {
    gameCtx.fillStyle = "#111111";
    gameCtx.font = "600 " + Math.round(22 * scale) + "px " + GAME_FONT;
    gameCtx.textAlign = "center";
    gameCtx.fillText("กดเริ่มพักเพื่อเริ่มรอบพัก", w / 2, h / 2);
    gameCtx.textAlign = "left";
    return;
  }

  const ringCenterX = w / 2;
  const ringCenterY = h / 2 - 10 * scale;
  const ringRadius = 78 * scale;

  if (gameOver) {
    // หน้าจอสรุปผล
    gameCtx.fillStyle = "#111111";
    gameCtx.font = "600 " + Math.round(28 * scale) + "px " + GAME_FONT;
    gameCtx.textAlign = "center";
    gameCtx.fillText("เสร็จสิ้น 1 รอบพัก", w / 2, h / 2 - 20 * scale);

    gameCtx.font = "400 " + Math.round(16 * scale) + "px " + GAME_FONT;
    gameCtx.fillStyle = "#4A4A4A";
    gameCtx.fillText("ค้างท่ารวม " + Math.round(totalHeldSeconds) + " วินาที", w / 2, h / 2 + 12 * scale);
    gameCtx.fillText("กดปุ่ม เริ่มใหม่ เพื่อเล่นอีกรอบ", w / 2, h / 2 + 38 * scale);
    gameCtx.textAlign = "left";
    return;
  }

  const step = STRETCH_SEQUENCE[stepIndex];
  const progress = step ? heldSeconds / step.holdSeconds : 0;

  // วงพื้นหลัง (track) — เส้นประบล็อกๆ ให้ดูสไตล์ 8-bit
  gameCtx.setLineDash([8 * scale, 4 * scale]);
  gameCtx.beginPath();
  gameCtx.arc(ringCenterX, ringCenterY, ringRadius, 0, Math.PI * 2);
  gameCtx.strokeStyle = "#CFCFCF";
  gameCtx.lineWidth = 12 * scale;
  gameCtx.stroke();

  // วง progress
  gameCtx.beginPath();
  gameCtx.arc(
    ringCenterX,
    ringCenterY,
    ringRadius,
    -Math.PI / 2,
    -Math.PI / 2 + Math.PI * 2 * progress
  );
  gameCtx.strokeStyle = currentPose === step.key ? "#2ECC71" : "#E63946";
  gameCtx.lineWidth = 12 * scale;
  gameCtx.stroke();
  gameCtx.setLineDash([]);

  // ตัวเลขวินาทีตรงกลางวง
  gameCtx.fillStyle = "#111111";
  gameCtx.font = "600 " + Math.round(30 * scale) + "px " + GAME_FONT;
  gameCtx.textAlign = "center";
  gameCtx.fillText(Math.ceil(step.holdSeconds - heldSeconds) + "s", ringCenterX, ringCenterY + 10 * scale);

  // ชื่อท่าปัจจุบัน
  gameCtx.font = "600 " + Math.round(20 * scale) + "px " + GAME_FONT;
  gameCtx.fillText(step.label, ringCenterX, ringCenterY - ringRadius - 24 * scale);

  gameCtx.font = "400 " + Math.round(13 * scale) + "px " + GAME_FONT;
  gameCtx.fillStyle = "#4A4A4A";
  gameCtx.fillText(step.instruction, ringCenterX, ringCenterY + ringRadius + 34 * scale);

  gameCtx.textAlign = "left";

  // จุดแสดงลำดับท่า (step dots) ด้านล่าง
  const dotsY = h - 26 * scale;
  const dotSpacing = 34 * scale;
  const dotRadius = 6 * scale;
  const dotsStartX = w / 2 - ((STRETCH_SEQUENCE.length - 1) * dotSpacing) / 2;

  STRETCH_SEQUENCE.forEach((s, i) => {
    const dotX = dotsStartX + i * dotSpacing;

    gameCtx.beginPath();
    gameCtx.arc(dotX, dotsY, dotRadius, 0, Math.PI * 2);

    if (i < stepIndex) {
      gameCtx.fillStyle = "#2ECC71"; // ทำเสร็จแล้ว
    } else if (i === stepIndex) {
      gameCtx.fillStyle = "#111111"; // กำลังทำ
    } else {
      gameCtx.fillStyle = "#CFCFCF"; // ยังไม่ถึง
    }

    gameCtx.fill();
  });
}

drawGame();