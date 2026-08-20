// ===============================
// Teachable Machine Model
// ===============================
// หมายเหตุ: ต้องเทรนโมเดลใหม่ใน Teachable Machine (Pose Project) ด้วย 4 class
// ชื่อ class ต้องตรงกับ key ใน STRETCH_SEQUENCE ด้านล่างเป๊ะ ๆ (ตัวพิมพ์เล็ก):
//   neck_stretch, shoulder_roll, arms_overhead, chest_opener
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/wEOUzks49/";
const CONFIDENCE_LIMIT = 0.80;

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

let gameRunning = false;
let gameOver = false; // true = จบ 1 รอบพักแล้ว (ใช้ชื่อเดิมไว้ให้ tooling/CSS เข้ากันได้)
let stepIndex = 0;
let heldSeconds = 0;
let totalHeldSeconds = 0; // เวลาที่ค้างท่าสำเร็จรวมทั้งรอบ (แสดงเป็นคะแนน)
let lastFrameTime = null;

const STREAK_KEY = "stretchBreakStreak";
const STREAK_DATE_KEY = "stretchBreakLastDate";

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

function getStreak() {
  return parseInt(localStorage.getItem(STREAK_KEY) || "0", 10);
}

function registerCompletionForStreak() {
  const today = getTodayString();
  const lastDate = localStorage.getItem(STREAK_DATE_KEY);

  if (lastDate === today) {
    // ทำสำเร็จไปแล้ววันนี้ ไม่นับซ้ำ
    return getStreak();
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayString = yesterday.toISOString().slice(0, 10);

  let streak = getStreak();
  streak = lastDate === yesterdayString ? streak + 1 : 1;

  localStorage.setItem(STREAK_KEY, String(streak));
  localStorage.setItem(STREAK_DATE_KEY, today);

  return streak;
}

async function init() {
  const startBtn = document.getElementById("startBtn");
  const actionText = document.getElementById("action");

  try {
    startBtn.disabled = true;
    startBtn.innerHTML = "กำลังโหลด...";
    actionText.innerHTML = "สถานะ: กำลังโหลดโมเดล";

    const modelURL = MODEL_URL + "model.json";
    const metadataURL = MODEL_URL + "metadata.json";

    model = await tmPose.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();

    if (maxPredictions !== 4) {
      actionText.innerHTML = "คำเตือน: โมเดลนี้ไม่ได้มี 4 Class ตามท่ายืดเหยียดที่กำหนด";
    }

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

    startGame();

    window.requestAnimationFrame(loop);
  } catch (error) {
    console.error(error);
    startBtn.disabled = false;
    startBtn.innerHTML = "เริ่มเกม";
    actionText.innerHTML = "เกิดข้อผิดพลาด: เปิดกล้องหรือโหลดโมเดลไม่ได้";
  }
}

async function loop(timestamp) {
  if (!isRunning) return;

  webcam.update();
  await predict();

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
    totalHeldSeconds += step.holdSeconds;
    heldSeconds = 0;
    stepIndex += 1;

    if (stepIndex >= STRETCH_SEQUENCE.length) {
      completeRound();
    }
  }
}

function completeRound() {
  gameRunning = false;
  gameOver = true;

  const streak = registerCompletionForStreak();

  document.getElementById("gameStatus").innerHTML =
    "เสร็จสิ้น 1 รอบพัก! ต่อเนื่อง " + streak + " วัน";
  document.getElementById("gameScore").innerHTML =
    "ค้างท่ารวม: " + Math.round(totalHeldSeconds) + " วิ";
}

// ===============================
// Draw: progress ring + step list
// ===============================
function drawGame() {
  const w = gameCanvas.width;
  const h = gameCanvas.height;

  gameCtx.clearRect(0, 0, w, h);

  // พื้นหลัง
  gameCtx.fillStyle = "#F7F7F8";
  gameCtx.fillRect(0, 0, w, h);

  if (!gameRunning && !gameOver) {
    gameCtx.fillStyle = "#111111";
    gameCtx.font = "600 22px Arial";
    gameCtx.textAlign = "center";
    gameCtx.fillText("กดเริ่มเกมเพื่อเริ่มรอบพัก", w / 2, h / 2);
    gameCtx.textAlign = "left";
    return;
  }

  const ringCenterX = w / 2;
  const ringCenterY = h / 2 - 10;
  const ringRadius = 78;

  if (gameOver) {
    // หน้าจอสรุปผล
    gameCtx.fillStyle = "#111111";
    gameCtx.font = "600 28px Arial";
    gameCtx.textAlign = "center";
    gameCtx.fillText("เสร็จสิ้น 1 รอบพัก", w / 2, h / 2 - 20);

    gameCtx.font = "400 16px Arial";
    gameCtx.fillStyle = "#6B6B70";
    gameCtx.fillText("ค้างท่ารวม " + Math.round(totalHeldSeconds) + " วินาที", w / 2, h / 2 + 12);
    gameCtx.fillText("กดปุ่ม เริ่มใหม่ เพื่อเล่นอีกรอบ", w / 2, h / 2 + 38);
    gameCtx.textAlign = "left";
    return;
  }

  const step = STRETCH_SEQUENCE[stepIndex];
  const progress = step ? heldSeconds / step.holdSeconds : 0;

  // วงพื้นหลัง (track)
  gameCtx.beginPath();
  gameCtx.arc(ringCenterX, ringCenterY, ringRadius, 0, Math.PI * 2);
  gameCtx.strokeStyle = "#E5E5E8";
  gameCtx.lineWidth = 10;
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
  gameCtx.strokeStyle = currentPose === step.key ? "#16A34A" : "#DC2626";
  gameCtx.lineWidth = 10;
  gameCtx.lineCap = "round";
  gameCtx.stroke();
  gameCtx.lineCap = "butt";

  // ตัวเลขวินาทีตรงกลางวง
  gameCtx.fillStyle = "#111111";
  gameCtx.font = "600 30px 'JetBrains Mono', monospace";
  gameCtx.textAlign = "center";
  gameCtx.fillText(Math.ceil(step.holdSeconds - heldSeconds) + "s", ringCenterX, ringCenterY + 10);

  // ชื่อท่าปัจจุบัน
  gameCtx.font = "600 20px Arial";
  gameCtx.fillText(step.label, ringCenterX, ringCenterY - ringRadius - 24);

  gameCtx.font = "400 13px Arial";
  gameCtx.fillStyle = "#6B6B70";
  gameCtx.fillText(step.instruction, ringCenterX, ringCenterY + ringRadius + 34);

  gameCtx.textAlign = "left";

  // จุดแสดงลำดับท่า (step dots) ด้านล่าง
  const dotsY = h - 26;
  const dotSpacing = 34;
  const dotsStartX = w / 2 - ((STRETCH_SEQUENCE.length - 1) * dotSpacing) / 2;

  STRETCH_SEQUENCE.forEach((s, i) => {
    const dotX = dotsStartX + i * dotSpacing;

    gameCtx.beginPath();
    gameCtx.arc(dotX, dotsY, 6, 0, Math.PI * 2);

    if (i < stepIndex) {
      gameCtx.fillStyle = "#16A34A"; // ทำเสร็จแล้ว
    } else if (i === stepIndex) {
      gameCtx.fillStyle = "#111111"; // กำลังทำ
    } else {
      gameCtx.fillStyle = "#E5E5E8"; // ยังไม่ถึง
    }

    gameCtx.fill();
  });
}

drawGame();