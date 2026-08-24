// ===============================
// camera.js - โมดูลกล้องและการตรวจจับ AI
// ===============================
import { AI_MODEL } from './config.js';

let model, webcam, cameraCtx, maxPredictions;
let lastPredictTime = 0;

export const cameraState = {
    isRunning: false,
    currentPose: "neutral"
};

export async function initCamera() {
    const startBtn = document.getElementById("startBtn");
    const actionEl = document.getElementById("action");

    if (startBtn) startBtn.innerHTML = "กำลังโหลดกล้อง...";
    if (actionEl) actionEl.innerHTML = "สถานะ: กำลังเชื่อมต่อกล้อง...";

    try {
        model = await tmPose.load(AI_MODEL.URL + "model.json", AI_MODEL.URL + "metadata.json");
        maxPredictions = model.getTotalClasses();
        webcam = new tmPose.Webcam(400, 400, true);
        await webcam.setup();
        await webcam.play();
        cameraCtx = document.getElementById("cameraCanvas").getContext("2d");

        cameraState.isRunning = true;
        if (startBtn) startBtn.innerHTML = "กำลังใช้งาน";
        if (actionEl) actionEl.innerHTML = "สถานะ: เริ่มตรวจจับท่าทาง...";
    } catch (error) {
        if (startBtn) startBtn.innerHTML = "ขัดข้อง";
        if (actionEl) actionEl.innerHTML = "เกิดข้อผิดพลาด: โปรดอนุญาตกล้อง";

        // 🔴 แจ้งเตือนสาเหตุที่กล้องเปิดไม่ได้บนหน้าจอเลย
        alert("❌ ไม่สามารถเปิดกล้องได้!\n\nสาเหตุที่เป็นไปได้:\n1. ลิงก์ AI_MODEL ใน config.js ยังไม่ได้กด Update/Publish โมเดลบนคลาวด์\n2. คุณไม่ได้รันเว็บผ่าน Localhost (เช่น Live Server)\n3. เบราว์เซอร์บล็อกสิทธิ์กล้องอยู่");

        console.error("Camera Init Error:", error);
        throw error;
    }
}

export async function updateCamera(timestamp) {
    if (!webcam || !cameraState.isRunning) return;

    webcam.update();
    if (timestamp - lastPredictTime >= AI_MODEL.PREDICT_INTERVAL_MS) {
        lastPredictTime = timestamp;
        await predict();
    } else if (cameraCtx) {
        cameraCtx.drawImage(webcam.canvas, 0, 0);
    }
}

async function predict() {
    if (!model || !webcam) return;

    const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
    const prediction = await model.predict(posenetOutput);
    let best = prediction[0];

    for (let i = 0; i < maxPredictions; i++) {
        let el = document.getElementById("class" + (i + 1));
        if (prediction[i] && el) el.innerHTML = prediction[i].className + ": " + (prediction[i].probability * 100).toFixed(0) + "%";
        if (prediction[i].probability > best.probability) best = prediction[i];
    }

    const resultEl = document.getElementById("result");
    if (resultEl) resultEl.innerHTML = "ท่าที่จับได้: " + best.className;

    let actionEl = document.getElementById("action");
    if (best.probability < AI_MODEL.CONFIDENCE_LIMIT) {
        cameraState.currentPose = "unknown";
        if (actionEl) actionEl.innerHTML = "สถานะ: ยังไม่มั่นใจพอ";
    } else {
        cameraState.currentPose = best.className.toLowerCase();
        if (actionEl) actionEl.innerHTML = "สถานะ: ตรวจพบ " + best.className;
    }

    if (cameraCtx && pose) {
        cameraCtx.drawImage(webcam.canvas, 0, 0);
        tmPose.drawKeypoints(pose.keypoints, 0.5, cameraCtx);
        tmPose.drawSkeleton(pose.keypoints, 0.5, cameraCtx);
    }
}