// ===============================
// main.js - ไฟล์กลางควบคุมแอปพลิเคชันและผูก Event
// ===============================
import { initCamera, updateCamera, cameraState } from './camera.js';
import {
    initGameEngine, updateGame, drawGame, resizeGameCanvas,
    manualAction, goToNextMap, showSummary
} from './game.js';

// ===============================
// 🔴 ระบบ Background Music (YouTube)
// ===============================
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

const BGM_TRACKS = {
    'MainMenu': 'oksESAMg7WM',
    'Forest': '6P5iPI1FjO8',
    'Graveyard': 'dBvlnyvgOnw',
    'Vampire_Castle': 'LDnENTDuAiI'
};

let pendingTrack = null;
let bgmVolume = 50;  // 🔴 ตั้งระดับเสียงเริ่มต้นที่ 50%
let isMuted = false;

window.onYouTubeIframeAPIReady = function () {
    window.bgmPlayer = new YT.Player('ytplayer', {
        height: '0',
        width: '0',
        videoId: '',
        playerVars: { 'autoplay': 0, 'controls': 0, 'showinfo': 0, 'rel': 0, 'loop': 1 },
        events: {
            'onReady': function (event) {
                window.bgmPlayer.setVolume(bgmVolume); // เซ็ตเสียง 50% ทันทีที่โหลดเสร็จ
                updateVolUI();
                if (pendingTrack) playBGM(pendingTrack);
            }
        }
    });
};

function playBGM(trackName) {
    pendingTrack = trackName;
    if (window.bgmPlayer && typeof window.bgmPlayer.loadVideoById === 'function') {
        let vidId = BGM_TRACKS[trackName];
        if (vidId) {
            window.bgmPlayer.loadVideoById({ 'videoId': vidId, 'startSeconds': 0 });
            window.bgmPlayer.setLoop(true);
        }
    }
}

function stopBGM() {
    if (window.bgmPlayer && typeof window.bgmPlayer.stopVideo === 'function') {
        window.bgmPlayer.stopVideo();
    }
}

// 🔴 ฟังก์ชันควบคุมระดับเสียง
window.bgmVolumeUp = function () {
    if (bgmVolume < 100) bgmVolume += 10;
    if (bgmVolume > 100) bgmVolume = 100;
    isMuted = false; // ยกเลิก Mute อัตโนมัติถ้ากดเพิ่มเสียง

    if (window.bgmPlayer && typeof window.bgmPlayer.setVolume === 'function') {
        window.bgmPlayer.unMute();
        window.bgmPlayer.setVolume(bgmVolume);
    }
    updateVolUI();
};

window.bgmVolumeDown = function () {
    if (bgmVolume > 0) bgmVolume -= 10;
    if (bgmVolume <= 0) {
        bgmVolume = 0;
        isMuted = true;
    }

    if (window.bgmPlayer && typeof window.bgmPlayer.setVolume === 'function') {
        window.bgmPlayer.setVolume(bgmVolume);
        if (isMuted) window.bgmPlayer.mute();
    }
    updateVolUI();
};

window.bgmToggleMute = function () {
    if (!window.bgmPlayer || typeof window.bgmPlayer.isMuted !== 'function') return;
    if (isMuted) {
        window.bgmPlayer.unMute();
        isMuted = false;
        if (bgmVolume === 0) bgmVolume = 10; // ถ้าเสียงเป็น 0 อยู่ ให้เด้งมาที่ 10%
        window.bgmPlayer.setVolume(bgmVolume);
    } else {
        window.bgmPlayer.mute();
        isMuted = true;
    }
    updateVolUI();
};

function updateVolUI() {
    const volDisplay = document.getElementById('volDisplay');
    const muteBtn = document.getElementById('bgmMuteBtn');
    if (volDisplay) volDisplay.innerText = bgmVolume + '%';
    if (muteBtn) muteBtn.innerText = isMuted || bgmVolume === 0 ? '🔇' : '🔔';
}
// ===============================

window.manualAction = manualAction;

window.goToNextMap = function (nextMapName) {
    goToNextMap(nextMapName);
    playBGM(nextMapName);
};

window.showSummary = function () {
    showSummary();
    stopBGM();
};

let playerCharSelection = 'Samurai';

// 🔴 ฐานข้อมูลคำอธิบายตัวละคร
const CHAR_INFO = {
    'Samurai': {
        name: 'Samurai', diff: 'Easy', color: '#2ECC71',
        stats: '❤️ HP: 100 | ⚔️ Attack: 25 (+Heal 5) | 🛡️ Guard: ลดดาเมจ 10 | 🌟 Ult: 3 เกจ (50 DMG) | ⚡ QTE: 30 DMG',
        passive: 'เมื่อโจมตีปกติ มีโอกาส 70% ที่จะฟาดฟันโจมตีซ้ำอีกครั้งในเทิร์นเดียวกัน'
    },
    'Fighter': {
        name: 'Fighter', diff: 'Normal', color: '#F39C12',
        stats: '❤️ HP: 100 | ⚔️ Attack: 15 | 🛡️ Guard: ลดดาเมจ 10 | 🌟 Ult: 4 เกจ (15 DMG +Heal 20) | ⚡ QTE: 30 DMG',
        passive: 'เลือดเดือด: เมื่อได้รับความเสียหายเข้า HP ความเสียหายของการโจมตีทุกประเภท (ปกติ, สวนกลับ, ไม้ตาย) จะเพิ่มขึ้น 5 หน่วยต่อขั้น (สะสมได้สูงสุด 5 ขั้น)'
    },
    'Knight': {
        name: 'Knight', diff: 'Normal', color: '#F39C12',
        stats: '❤️ HP: 150 | ⚔️ Attack: 10 | 🛡️ Guard: ลดดาเมจ 20 | 🌟 Ult: 2 เกจ (30 DMG) | ⚡ QTE: 40 DMG',
        passive: 'ระบบป้องกัน QTE ให้อัตโนมัติ<br>🔹 <b>Ability:</b> หากตั้งการ์ดป้องกันแล้วไม่ได้รับความเสียหายเข้า HP เลย จะทำการปัดป้องอัตโนมัติ (ทำความเสียหายเท่ากับ QTE + ดาเมจโจมตีปกติทันที)'
    },
    'Wizard': {
        name: 'Battle Mage', diff: 'Hard', color: '#E63946',
        stats: '❤️ HP: 50 | ⚔️ Attack: 15 | 🛡️ Guard: ลดดาเมจ 5 (+โล่ 30 HP นาน 3 เทิร์น) | 🌟 Ult: 6 เกจ (100 DMG) | ⚡ QTE: 30 DMG',
        passive: 'ขณะที่โล่เวทย์ทำงาน: โจมตีแรงขึ้น 5, โดนดาเมจเบาลง 5, QTE แรงขึ้น 20<br>🔹 <b>Ability:</b> เมื่อโล่ถูกทำลายหรือหมดเวลา จะได้รับเกจ Ult เพิ่ม 3 จุดทันที'
    }
};

// ฟังก์ชันอัปเดตข้อมูลบนหน้าจอ
function updateCharInfo(charKey) {
    const info = CHAR_INFO[charKey];
    const panel = document.getElementById('charInfoPanel');
    if (!panel) return;
    panel.innerHTML = `
        <div style="font-family: var(--font-pixel); font-size: 15px; margin-bottom: 8px; color: ${info.color}; text-transform: uppercase;">
            ${info.name} <span style="font-size: 11px;">(${info.diff})</span>
        </div>
        <div style="margin-bottom: 10px; font-weight: 600; font-size: 12px; background: #fff; padding: 10px; border: 2px solid var(--line);">${info.stats}</div>
        <div style="color: var(--text-dim); font-size: 13px;"><b>Passive:</b> ${info.passive}</div>
    `;
}

let calibUlt = false;
let calibGuard = false;
let calibAttack = false;
let calibReq = null;
let calibHoldPose = '';
let calibHoldTime = 0;
let lastCalibTime = null;

window.bypassCamera = false;

document.addEventListener('DOMContentLoaded', () => {
    resizeGameCanvas();
    window.addEventListener('resize', resizeGameCanvas);
    checkBadges();

    // เริ่มต้นแสดงข้อมูลของซามูไรก่อน
    updateCharInfo('Samurai');

    const charCards = document.querySelectorAll('.char-card');
    charCards.forEach(card => {
        card.addEventListener('click', function () {
            charCards.forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            playerCharSelection = this.getAttribute('data-char');
            // 🔴 เมื่อคลิกเปลี่ยนตัวละคร ให้อัปเดตคำอธิบายทันที
            updateCharInfo(playerCharSelection);
        });
    });

    document.addEventListener('keydown', function (e) {
        if (e.code === 'Space') {
            const tutOverlay = document.getElementById('tutorialOverlay');
            if (tutOverlay.style.display !== 'none') {
                e.preventDefault();
                window.bypassCamera = true;

                tutOverlay.style.display = 'none';

                const charOverlay = document.getElementById('charSelectOverlay');
                charOverlay.style.display = 'flex';
                setTimeout(() => charOverlay.style.opacity = '1', 10);

                playBGM('MainMenu');

                const startBtn = document.getElementById("startBtn");
                const actionEl = document.getElementById("action");
                const placeholder = document.querySelector(".camera-placeholder");
                if (startBtn) startBtn.innerHTML = "ปิดกล้อง (Bypass Mode)";
                if (actionEl) actionEl.innerHTML = "สถานะ: โหมดใช้ปุ่มกด";
                if (placeholder) placeholder.innerHTML = "คุณกำลังเล่นด้วยปุ่มกด<br>(ข้ามกล้อง)";
            }
        }
    });

    document.getElementById('tutorialNextBtn').addEventListener('click', function () {
        document.getElementById('tutorialOverlay').style.display = 'none';

        const calibOverlay = document.getElementById('calibrationOverlay');
        calibOverlay.style.display = 'flex';
        setTimeout(() => calibOverlay.style.opacity = '1', 10);

        const camWrap = document.getElementById('cameraWrap');
        document.getElementById('calibCameraContainer').appendChild(camWrap);

        calibHoldPose = '';
        calibHoldTime = 0;
        lastCalibTime = null;

        initCamera().then(() => {
            calibrationLoop(performance.now());
        }).catch(err => console.error("Camera Error:", err));
    });

    function markCalibDone(id) {
        const el = document.getElementById(id);
        if (el) {
            el.style.opacity = '1';
            el.style.borderColor = '#2ECC71';
            el.style.backgroundColor = '#E8F8F5';
            el.querySelector('.status-icon').innerText = '✅';
        }
    }

    function calibrationLoop(timestamp) {
        if (!cameraState.isRunning) {
            calibReq = requestAnimationFrame(calibrationLoop);
            return;
        }
        updateCamera(timestamp);

        if (lastCalibTime === null) lastCalibTime = timestamp;
        const dt = (timestamp - lastCalibTime) / 1000;
        lastCalibTime = timestamp;

        const pose = cameraState.currentPose;
        let normalizedPose = '';

        if (pose === 'attack') normalizedPose = 'attack';
        else if (pose === 'guard' || pose === 'defend') normalizedPose = 'guard';
        else if (pose === 'ultimate' || pose === 'ult') normalizedPose = 'ultimate';

        if (normalizedPose) {
            if (calibHoldPose === normalizedPose) {
                calibHoldTime += dt;
                if (calibHoldTime >= 1.5) {
                    if (normalizedPose === 'attack' && !calibAttack) markCalibDone('checkAttack');
                    if (normalizedPose === 'guard' && !calibGuard) markCalibDone('checkGuard');
                    if (normalizedPose === 'ultimate' && !calibUlt) markCalibDone('checkUlt');

                    if (normalizedPose === 'attack') calibAttack = true;
                    if (normalizedPose === 'guard') calibGuard = true;
                    if (normalizedPose === 'ultimate') calibUlt = true;
                }
            } else {
                calibHoldPose = normalizedPose;
                calibHoldTime = 0;
            }
        } else {
            calibHoldPose = '';
            calibHoldTime = 0;
        }

        if (!calibAttack) document.querySelector('#checkAttack .status-icon').innerText = (calibHoldPose === 'attack' && calibHoldTime > 0) ? `⏳ ${(1.5 - calibHoldTime).toFixed(1)}s` : '❌';
        if (!calibGuard) document.querySelector('#checkGuard .status-icon').innerText = (calibHoldPose === 'guard' && calibHoldTime > 0) ? `⏳ ${(1.5 - calibHoldTime).toFixed(1)}s` : '❌';
        if (!calibUlt) document.querySelector('#checkUlt .status-icon').innerText = (calibHoldPose === 'ultimate' && calibHoldTime > 0) ? `⏳ ${(1.5 - calibHoldTime).toFixed(1)}s` : '❌';

        if (calibUlt && calibGuard && calibAttack) {
            document.getElementById('calibNextBtn').style.display = 'block';
        }

        calibReq = requestAnimationFrame(calibrationLoop);
    }

    document.getElementById('calibNextBtn').addEventListener('click', function () {
        cancelAnimationFrame(calibReq);
        document.getElementById('aiZoneLeftPanel').appendChild(document.getElementById('cameraWrap'));

        document.getElementById('calibrationOverlay').style.display = 'none';
        document.getElementById('charSelectOverlay').style.display = 'flex';
        document.getElementById('charSelectOverlay').style.opacity = '1';

        playBGM('MainMenu');
    });

    document.getElementById('toMapBtn').addEventListener('click', function () {
        document.getElementById('charSelectOverlay').style.display = 'none';
        document.getElementById('mapSelectOverlay').style.display = 'flex';
        document.getElementById('mapSelectOverlay').style.opacity = '1';
    });

    startLiveUI();
});

window.startMap = function (mapName) {
    document.getElementById('mapSelectOverlay').style.display = 'none';
    document.body.classList.remove('is-locked');
    document.getElementById('appShell').classList.add('is-visible');

    initGameEngine(playerCharSelection, mapName);
    playBGM(mapName);

    // 🔴 ตรวจสอบโหมด: ถ้าเป็น Bypass ให้รันเกมเลยโดยไม่เปิดกล้อง
    if (window.bypassCamera) {
        window.requestAnimationFrame(gameLoop);
    } else {
        if (!cameraState.isRunning) {
            initCamera().then(() => {
                window.requestAnimationFrame(gameLoop);
            }).catch(err => console.error("Camera Error:", err));
        } else {
            window.requestAnimationFrame(gameLoop);
        }
    }
};

function gameLoop(timestamp) {
    // 🔴 ถ้าไม่ได้ Bypass และกล้องไม่ได้รันอยู่ ให้หยุด (เพื่อให้รอเปิดกล้องเสร็จ)
    if (!window.bypassCamera && !cameraState.isRunning) return;

    // อัปเดตกล้องเฉพาะตอนที่ไม่ได้ Bypass
    if (!window.bypassCamera) {
        updateCamera(timestamp);
    }

    updateGame(timestamp);
    drawGame();
    window.requestAnimationFrame(gameLoop);
}

function checkBadges() {
    let badges = JSON.parse(localStorage.getItem('fighter_badges')) || {};
    let badgeStr = "เหรียญตรา: ";

    if (badges['Forest']) badgeStr += '<img src="Icon/Map_Icon/Forest_Icon.png" class="inline-icon"> ';
    if (badges['Graveyard']) badgeStr += '<img src="Icon/Map_Icon/Graveyard_Icon.png" class="inline-icon"> ';
    if (badges['Vampire_Castle']) badgeStr += '<img src="Icon/Map_Icon/Vampire_Icon.png" class="inline-icon"> ';

    document.getElementById('badgeContainer').innerHTML = badgeStr;

    if (badges['Forest'] && badges['Graveyard'] && badges['Vampire_Castle']) {
        document.getElementById('secretMapBtn').style.display = 'block';
    }
}

function startLiveUI() {
    const cameraWrap = document.getElementById('cameraWrap');
    const liveDot = document.getElementById('liveDot');
    const actionEl = document.getElementById('action');
    const bars = {
        1: document.querySelector('[data-bar="1"]'), 2: document.querySelector('[data-bar="2"]'),
        3: document.querySelector('[data-bar="3"]'), 4: document.querySelector('[data-bar="4"]')
    };
    const classEls = {
        1: document.getElementById('class1'), 2: document.getElementById('class2'),
        3: document.getElementById('class3'), 4: document.getElementById('class4')
    };

    function parsePercent(text) {
        const match = text.match(/([\d.]+)\s*%/);
        return match ? parseFloat(match[1]) : 0;
    }

    function tick() {
        // 🔴 หยุดทำงาน UI ฝั่ง AI ทั้งหมดถ้าอยู่ในโหมด Bypass
        if (window.bypassCamera) return;

        const actionText = actionEl.textContent || '';
        const hasFeed = actionText.includes('ตรวจพบ') || actionText.includes('ยังไม่มั่นใจ') || actionText.includes('เริ่มตรวจจับ');
        if (cameraWrap) cameraWrap.classList.toggle('has-feed', hasFeed);

        const isWarn = actionText.includes('ยังไม่มั่นใจ') || actionText.includes('ข้อผิดพลาด');
        const isLive = hasFeed && !isWarn;

        if (cameraWrap) cameraWrap.classList.toggle('tracking-live', isLive);
        if (cameraWrap) cameraWrap.classList.toggle('tracking-warn', isWarn);
        if (liveDot) liveDot.classList.toggle('is-live', isLive);
        if (liveDot) liveDot.classList.toggle('is-warn', isWarn);

        [1, 2, 3, 4].forEach(function (i) {
            if (!classEls[i]) return;
            const pct = parsePercent(classEls[i].textContent || '');
            if (bars[i]) bars[i].style.width = pct + '%';
        });
        requestAnimationFrame(tick);
    }
    tick();
}