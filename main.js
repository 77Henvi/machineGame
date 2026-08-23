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

document.addEventListener('DOMContentLoaded', () => {
    resizeGameCanvas();
    window.addEventListener('resize', resizeGameCanvas);
    checkBadges();

    const charCards = document.querySelectorAll('.char-card');
    charCards.forEach(card => {
        card.addEventListener('click', function () {
            charCards.forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            playerCharSelection = this.getAttribute('data-char');
        });
    });

    document.getElementById('tutorialNextBtn').addEventListener('click', function () {
        document.getElementById('tutorialOverlay').style.display = 'none';
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

    initCamera().then(() => {
        window.requestAnimationFrame(gameLoop);
    }).catch(err => console.error("Camera Error:", err));
};

function gameLoop(timestamp) {
    if (!cameraState.isRunning) return;
    updateCamera(timestamp);
    updateGame(timestamp);
    drawGame();
    window.requestAnimationFrame(gameLoop);
}

function checkBadges() {
    let badges = JSON.parse(localStorage.getItem('fighter_badges')) || {};
    let badgeStr = "เหรียญตรา: ";

    // 🔴 อัปเดต Path ให้ตรงกับโฟลเดอร์ Map_Icon
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
        1: document.querySelector('[data-bar="1"]'),
        2: document.querySelector('[data-bar="2"]'),
        3: document.querySelector('[data-bar="3"]'),
        4: document.querySelector('[data-bar="4"]')
    };
    const classEls = {
        1: document.getElementById('class1'),
        2: document.getElementById('class2'),
        3: document.getElementById('class3'),
        4: document.getElementById('class4')
    };

    function parsePercent(text) {
        const match = text.match(/([\d.]+)\s*%/);
        return match ? parseFloat(match[1]) : 0;
    }

    function tick() {
        const actionText = actionEl.textContent || '';
        const hasFeed = actionText.includes('ตรวจพบ') || actionText.includes('ยังไม่มั่นใจ') || actionText.includes('เริ่มตรวจจับ');
        cameraWrap.classList.toggle('has-feed', hasFeed);

        const isWarn = actionText.includes('ยังไม่มั่นใจ') || actionText.includes('ข้อผิดพลาด');
        const isLive = hasFeed && !isWarn;

        cameraWrap.classList.toggle('tracking-live', isLive);
        cameraWrap.classList.toggle('tracking-warn', isWarn);
        liveDot.classList.toggle('is-live', isLive);
        liveDot.classList.toggle('is-warn', isWarn);

        [1, 2, 3, 4].forEach(function (i) {
            if (!classEls[i]) return;
            const pct = parsePercent(classEls[i].textContent || '');
            if (bars[i]) bars[i].style.width = pct + '%';
        });
        requestAnimationFrame(tick);
    }
    tick();
}