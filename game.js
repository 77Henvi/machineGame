// ===============================
// game.js - เอนจิ้นระบบต่อสู้และการวาดกราฟิก
// ===============================
import { CHAR_CONFIG, FILE_NAMES, MAP_DATA, EFFECT_CONFIG, GAME_SETTINGS } from './config.js';
import { cameraState } from './camera.js';

const gameCanvas = document.getElementById("gameCanvas");
const gameCtx = gameCanvas.getContext("2d");
gameCtx.imageSmoothingEnabled = false;
const GAME_FONT = "'Press Start 2P', 'JetBrains Mono', monospace";

export let gameState = 'IDLE';
let gameRunning = false;
let turnTimer = 0;
let poseHoldTime = 0;
let lastFrameTime = null;
let combatLog = "รอโหลดทรัพยากร...";

let currentMapName = '';
let currentRoomIdx = 0;
export let sessionClearedMaps = [];

let player = { name: '', baseX: 120, xOffset: 0, hp: 100, maxHp: 100, ultGauge: 0, isDefending: false, anim: 'idle', frame: 0, tick: 0, animFinished: false, debuffTurn: 0, assets: {} };
let bot = { id: '', config: null, baseX: 480, xOffset: 0, hp: 100, maxHp: 100, isDefending: false, anim: 'idle', frame: 0, tick: 0, animFinished: false, turnCount: 0, cd: 0, phase2: false, assets: {} };

let activeAction = null;
let botAttackQueue = [];
let effects = [];
let projectiles = [];
let bgImage = new Image();
let effectAssets = {};

// 🔴 โหลด QTE Icon เตรียมวาด
let qteIconImg = new Image();
qteIconImg.src = "Icon/QTE_Icon.png";

function loadEffectAssets() {
    for (const [effKey, config] of Object.entries(EFFECT_CONFIG)) {
        if (config.type === 'sheet') {
            let img = new Image(); img.src = config.file; effectAssets[effKey] = img;
        } else {
            effectAssets[effKey] = [];
            for (let i = 1; i <= config.frames; i++) {
                let img = new Image();
                let numStr = i.toString().padStart(2, '0');
                img.src = `${config.folder}${config.prefix}${numStr}.png`;
                effectAssets[effKey].push(img);
            }
        }
    }
}

function loadPlayerAssets(charName) {
    let assets = {};
    for (const [animKey, fileName] of Object.entries(FILE_NAMES)) {
        let img = new Image(); img.src = `Character(Player)/${charName}/${fileName}`; assets[animKey] = img;
    }
    return assets;
}

function loadBotAssets(botConfig) {
    let assets = {};
    for (const [animKey, fileData] of Object.entries(botConfig.anims)) {
        let img = new Image(); img.src = `Character(Bot)/${botConfig.folder}${fileData[0]}`; assets[animKey] = img;
    }
    return assets;
}

export function resizeGameCanvas() {
    const wrap = gameCanvas.parentElement;
    gameCanvas.width = Math.round(wrap.clientWidth);
    gameCanvas.height = Math.round(gameCanvas.width / 2);
    drawGame();
}

export function initGameEngine(playerName, mapName) {
    currentMapName = mapName;
    currentRoomIdx = 0;

    loadEffectAssets();
    player.name = playerName;
    player.assets = loadPlayerAssets(playerName);

    const oldMapUI = document.getElementById('currentMapNameUI');
    if (oldMapUI) oldMapUI.style.display = "none";
    const oldStatusUI = document.getElementById('gameStatus');
    if (oldStatusUI) oldStatusUI.style.display = "none";

    startGame();
}

export function renderManualControls() {
    const container = document.querySelector('.manual-controls');
    if (!container) return;

    if (gameState === 'BOSS_CLEARED') {
        const MAP_ORDER = ['Forest', 'Graveyard', 'Vampire_Castle'];
        let nextMap = null;
        let currIdx = MAP_ORDER.indexOf(currentMapName);
        if (currIdx !== -1 && currIdx < MAP_ORDER.length - 1) {
            nextMap = MAP_ORDER[currIdx + 1];
        }

        let btns = '';
        if (nextMap) {
            btns += `<button class="btn-action" style="background:#2ECC71; color:#fff;" onclick="goToNextMap('${nextMap}')">➡️ ลุยด่านต่อไป (${nextMap})</button>`;
        }
        btns += `<button class="btn-action" style="background:#E63946; color:#fff;" onclick="showSummary()">🛑 หยุดพัก</button>`;
        container.innerHTML = btns;
    }
    else if (gameState === 'SUMMARY' || gameState === 'GAME_OVER') {
        container.innerHTML = `<button class="btn-action" style="background:#111; color:#fff;" onclick="location.reload()">🏠 กลับหน้าแรก</button>`;
    }
    else {
        // 🔴 เปลี่ยน Emoji ในปุ่มบังคับให้เรียกใช้ภาพ Icon
        container.innerHTML = `
      <button class="btn-action" onclick="manualAction('attack')"><img src="Icon/Attack_Icon.png" class="inline-icon"> โจมตี</button>
      <button class="btn-action" onclick="manualAction('guard')"><img src="Icon/Guard_Icon.png" class="inline-icon"> ป้องกัน</button>
      <button class="btn-action" onclick="manualAction('ultimate')"><img src="Icon/Ult_Icon.png" class="inline-icon"> ไม้ตาย</button>
    `;
    }
}

export function goToNextMap(nextMapName) {
    player.maxHp = 100;
    player.hp = 100;
    player.ultGauge = 0;
    player.debuffTurn = 0;
    currentMapName = nextMapName;
    loadRoom(0);
}

export function showSummary() {
    gameState = 'SUMMARY';
    combatLog = "สรุปผลการต่อสู้ของคุณ!";
    renderManualControls();
}

function startGame() {
    player.hp = 100; player.maxHp = 100; player.ultGauge = 0; player.debuffTurn = 0;
    loadRoom(0);
}

function loadRoom(idx) {
    currentRoomIdx = idx;
    document.getElementById('roomCountUI').innerText = `${idx + 1}/4`;
    let botConfig = MAP_DATA[currentMapName].rooms[idx];

    bgImage.src = botConfig.bg;

    bot.config = botConfig;
    bot.id = botConfig.id;
    bot.hp = botConfig.hp; bot.maxHp = botConfig.hp;
    bot.assets = loadBotAssets(botConfig);
    bot.turnCount = 0; bot.cd = 0; bot.phase2 = false; bot.xOffset = 0;

    bot.anim = '';
    setAnim(bot, 'idle');

    gameRunning = true; activeAction = null; effects = []; botAttackQueue = []; projectiles = [];
    player.xOffset = 0; player.baseX = 120;

    startPlayerTurn();
    renderManualControls();
}

function setAnim(charObj, newAnim) {
    if (charObj.anim === 'dead') return;
    if (charObj.id === 'Gorgon(Boss)' && charObj.phase2) {
        const p2Map = { idle: 'idle2', walk: 'walk2', attack1: 'atk1_2', attack2: 'atk2_2', hurt: 'hurt2' };
        if (p2Map[newAnim]) newAnim = p2Map[newAnim];
    }
    charObj.anim = newAnim; charObj.frame = 0; charObj.tick = 0; charObj.animFinished = false;
}

function startPlayerTurn() {
    if (checkGameOver()) return;
    gameState = 'PLAYER_TURN'; turnTimer = GAME_SETTINGS.PLAYER_TURN_TIME; player.isDefending = false;
    setAnim(player, 'idle');

    if (player.debuffTurn > 0) {
        player.debuffTurn--;
        if (player.debuffTurn === 0) { player.hp = Math.min(player.maxHp, player.hp + 10); combatLog = "ล้างคำสาปแล้ว! ฟื้นฟู 10 HP"; }
    } else { combatLog = "เทิร์นของคุณ! โจมตี / ป้องกัน / ไม้ตาย"; }
}

function startBotTurn() {
    if (checkGameOver()) return;
    gameState = 'BOT_TURN'; turnTimer = 1.0; bot.isDefending = false;
    setAnim(bot, 'idle'); combatLog = "ตาของศัตรู...";
}

function triggerQTE() {
    gameState = 'QTE_EVENT'; turnTimer = GAME_SETTINGS.QTE_TIME; setAnim(bot, 'idle');
    // 🔴 เปลี่ยนข้อความใน Log ให้แสดงภาพไอคอน QTE ด้วย
    combatLog = `<img src="Icon/QTE_Icon.png" class="inline-icon"> QTE! ป้องกันด่วน!! (มีเวลา 3 วิ)`;
}

function showResult(message, nextStateFunc) {
    gameState = 'SHOW_RESULT'; turnTimer = GAME_SETTINGS.RESULT_DELAY; combatLog = message;
    window.nextStateAfterResult = nextStateFunc;
}

function checkGameOver() {
    if (player.hp <= 0) {
        gameState = 'GAME_OVER';
        combatLog = "คุณพ่ายแพ้! Game Over";
        setAnim(player, 'dead');
        renderManualControls();
        return true;
    }

    if (bot.id === 'Gorgon(Boss)' && bot.hp <= 100 && !bot.phase2 && bot.hp > 0) {
        bot.phase2 = true; bot.config.atk = 30; setAnim(bot, 'idle');
        showResult("Gorgon เข้าสู่เฟส 2! โจมตีแรงขึ้น", startPlayerTurn); return true;
    }

    if (bot.hp <= 0) {
        setAnim(bot, 'dead');
        if (currentRoomIdx === 3) {
            let badges = JSON.parse(localStorage.getItem('fighter_badges')) || {};
            badges[currentMapName] = true;
            localStorage.setItem('fighter_badges', JSON.stringify(badges));

            if (!sessionClearedMaps.includes(currentMapName)) sessionClearedMaps.push(currentMapName);

            gameState = 'BOSS_CLEARED';
            combatLog = "🎉 ชนะบอสแล้ว! ได้รับเหรียญตรา เลือกว่าจะไปต่อหรือหยุดพัก";
            renderManualControls();
        } else {
            gameState = 'ROOM_CLEAR'; combatLog = "ศัตรูถูกกำจัด! กำลังไปห้องต่อไป...";
            setAnim(player, 'walk');
        }
        return true;
    }
    return false;
}

function startAttackSequence(attacker, defender, actionType, dmg, msg, nextState) {
    gameState = 'ANIMATING_ACTION';
    let atkAnim = actionType === 'ultimate' ? 'ult' : (Math.random() < 0.5 ? 'attack1' : 'attack2');
    if (attacker !== player && !attacker.config.anims[atkAnim]) { atkAnim = 'attack1'; }

    activeAction = { attacker: attacker, defender: defender, dmg: dmg, msg: msg, next: nextState, actionType: actionType, anim: atkAnim };
    let isMelee = (attacker === player) ? CHAR_CONFIG[attacker.name].type === 'melee' : attacker.config.type === 'melee';

    if (isMelee) {
        activeAction.phase = 'move_forward'; setAnim(attacker, 'walk');
    } else {
        activeAction.phase = 'attacking'; setAnim(attacker, atkAnim);
    }
}

function applyDamageAndEffect(att, def, type, dmg) {
    def.hp -= dmg;
    let effType = 'hit';
    let isMelee = (att === player) ? CHAR_CONFIG[att.name].type === 'melee' : att.config.type === 'melee';

    if (def === player && player.isDefending && type === 'attack') {
        setAnim(def, 'defend'); effType = 'block';
    } else {
        setAnim(def, 'hurt');
        if (isMelee) effType = 'slash';
    }

    if (att.config && att.config.lifesteal && def.hp > 0 && dmg > 0 && type === 'attack') {
        att.hp = Math.min(att.maxHp, att.hp + att.config.lifesteal);
    }
    effects.push({ x: def.baseX, y: 180, type: effType, frame: 0, tick: 0 });
}

function finishActionSequence() {
    if (checkGameOver()) { activeAction = null; return; }
    showResult(activeAction.msg, activeAction.next);
    activeAction = null;
}

function processBotQueue() {
    if (botAttackQueue.length > 0) {
        let nextAtk = botAttackQueue.shift();
        if (nextAtk.isQte) {
            activeAction = { attacker: bot, defender: player, dmg: nextAtk.dmg, msg: nextAtk.msg, next: nextAtk.nextFunc, actionType: 'attack', anim: 'attack1', phase: 'attacking' };
            triggerQTE();
        } else {
            startAttackSequence(bot, player, 'attack', nextAtk.dmg, nextAtk.msg, nextAtk.nextFunc);
        }
    } else {
        startPlayerTurn();
    }
}

function getPlayerDmg() {
    let d = 20;
    if (player.debuffTurn === 2) d -= 10;
    else if (player.debuffTurn === 1) d -= 5;
    return Math.max(0, d);
}

function executePlayerAction(actionType) {
    if (actionType === 'attack') {
        let dmg = getPlayerDmg();
        player.ultGauge = Math.min(4, player.ultGauge + 1);
        startAttackSequence(player, bot, 'attack', dmg, `คุณโจมตีทำดาเมจ ${dmg}!`, startBotTurn);
    } else if (actionType === 'guard' || actionType === 'defend') {
        player.isDefending = true; setAnim(player, 'defend'); player.ultGauge = Math.min(4, player.ultGauge + 1);
        showResult("คุณตั้งการ์ดป้องกัน! (-10 ดาเมจเทิร์นหน้า)", startBotTurn);
    } else if (actionType === 'ultimate') {
        if (player.ultGauge >= 4) {
            player.ultGauge = 0; startAttackSequence(player, bot, 'ultimate', 50, "ULTIMATE! ทำดาเมจมหาศาล 50!", startBotTurn);
        } else { poseHoldTime = 0; }
    }
}

function executeQTEAction(success) {
    let nextState = activeAction ? activeAction.next : startPlayerTurn;
    let failDmg = (activeAction && activeAction.dmg) ? activeAction.dmg * 2 : 40;
    activeAction = null;

    if (success) {
        startAttackSequence(player, bot, 'attack', 30, "PERFECT PARRY! สวนกลับ 30 ดาเมจ!", nextState);
    } else {
        startAttackSequence(bot, player, 'attack', failDmg, `พลาด! โดนสวนกลับรุนแรง ${failDmg} ดาเมจ`, nextState);
    }
}

function executeBotLogic() {
    bot.turnCount++;
    let bc = bot.config;

    if (bot.id === 'Minotaur(Boss)' && bot.turnCount % 2 !== 0) {
        showResult("Minotaur กำลังรวบรวมพลัง...", startPlayerTurn); return;
    }

    if (bc.isQueen && bot.cd <= 0) {
        bot.cd = 3; player.debuffTurn = 2;
        setAnim(bot, 'ult');
        showResult("Vampire Queen ร่ายคำสาป! พลังโจมตีคุณลดลง 2 เทิร์น", startPlayerTurn); return;
    }
    if (bc.isQueen) bot.cd--;

    let hits = bc.hits || (bc.isQueen ? 2 : 1);
    botAttackQueue = [];

    for (let i = 0; i < hits; i++) {
        let dmg = bc.atk || 20;
        if (bc.isQueen && i === 1) dmg = 10;
        if (player.isDefending && !bc.unblockable) dmg -= 10;
        dmg = Math.max(0, dmg);

        let qte = Math.random() < 0.20;
        let msg = bc.unblockable ? `โจมตีทะลุการ์ด! โดน ${dmg}` : `ศัตรูโจมตี! โดน ${dmg}`;
        let nextFunc = (i === hits - 1) ? startPlayerTurn : processBotQueue;
        botAttackQueue.push({ isQte: qte, dmg: dmg, msg: msg, nextFunc: nextFunc });
    }

    processBotQueue();
}

export function manualAction(actionType) {
    if (!['PLAYER_TURN', 'QTE_EVENT'].includes(gameState)) return;
    if (gameState === 'PLAYER_TURN') executePlayerAction(actionType);
    else if (gameState === 'QTE_EVENT' && (actionType === 'defend' || actionType === 'guard')) executeQTEAction(true);
}

function handlePlayerInput(dt) {
    if (['attack', 'guard', 'ultimate'].includes(cameraState.currentPose)) {
        poseHoldTime += dt;
        if (poseHoldTime >= GAME_SETTINGS.REQUIRED_HOLD_TIME) { poseHoldTime = 0; executePlayerAction(cameraState.currentPose); }
    } else { poseHoldTime = Math.max(0, poseHoldTime - dt * 2); }
}

function handleQTEInput(dt) {
    if (cameraState.currentPose === 'guard' || cameraState.currentPose === 'defend') {
        poseHoldTime += dt;
        if (poseHoldTime >= 0.5) { poseHoldTime = 0; executeQTEAction(true); }
    } else { poseHoldTime = 0; }
}

export function updateGame(timestamp) {
    if (!gameRunning) return;
    if (lastFrameTime === null) { lastFrameTime = timestamp; return; }
    const dt = (timestamp - lastFrameTime) / 1000;
    lastFrameTime = timestamp;

    [player, bot].forEach(c => {
        if (!c.name && !c.id) return;
        let framesObj = (c === player) ? CHAR_CONFIG[c.name].frames : c.config.anims;
        if (!framesObj[c.anim]) c.anim = 'idle';

        let totalFrames = (c === player) ? framesObj[c.anim] : framesObj[c.anim][1];
        if (!totalFrames) totalFrames = 1;

        c.tick += dt * 1000;
        if (c.tick > 100) {
            c.tick = 0;
            if (c.anim === 'dead') { if (c.frame < totalFrames - 1) c.frame++; }
            else {
                c.frame++;
                if (c.frame >= totalFrames) {
                    c.animFinished = true;
                    if (['attack1', 'attack2', 'atk1_2', 'atk2_2', 'ult', 'hurt', 'hurt2'].includes(c.anim)) {
                        setAnim(c, c.isDefending ? 'defend' : 'idle');
                    } else { c.frame = 0; }
                }
            }
        }
    });

    for (let i = effects.length - 1; i >= 0; i--) {
        effects[i].tick += dt * 1000;
        if (effects[i].tick > 70) { effects[i].tick = 0; effects[i].frame++; if (effects[i].frame >= EFFECT_CONFIG[effects[i].type].frames) effects.splice(i, 1); }
    }

    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.tick += dt * 1000;
        if (p.tick > 100) { p.tick = 0; p.frame = (p.frame + 1) % p.frames; }

        let dx = p.targetX - p.x;
        let dy = p.targetY - p.y;
        let dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < p.speed * dt) {
            applyDamageAndEffect(p.action.attacker, p.action.defender, p.action.actionType, p.action.dmg);
            if (p.action.phase === 'wait_projectile') finishActionSequence();
            projectiles.splice(i, 1);
        } else {
            p.x += (dx / dist) * p.speed * dt;
            p.y += (dy / dist) * p.speed * dt;
        }
    }

    if (gameState === 'ROOM_CLEAR') {
        player.xOffset += 200 * dt;
        if (player.xOffset > 600) {
            player.maxHp += 10; player.hp = player.maxHp; loadRoom(currentRoomIdx + 1);
        }
        return;
    }

    if (gameState === 'ANIMATING_ACTION' && activeAction) {
        let att = activeAction.attacker; let def = activeAction.defender; let dir = (att === player) ? 1 : -1;
        let moveSpeed = 600 * dt; let targetXOffset = 220 * dir;
        let isMelee = (att === player) ? CHAR_CONFIG[att.name].type === 'melee' : att.config.type === 'melee';

        if (activeAction.phase === 'move_forward') {
            att.xOffset += moveSpeed * dir;
            if (Math.abs(att.xOffset) >= Math.abs(targetXOffset)) { att.xOffset = targetXOffset; activeAction.phase = 'attacking'; setAnim(att, activeAction.anim); }
        } else if (activeAction.phase === 'attacking') {
            if (att.animFinished) {
                att.animFinished = false;
                if (isMelee) {
                    applyDamageAndEffect(att, def, activeAction.actionType, activeAction.dmg);
                    activeAction.phase = 'move_back'; setAnim(att, 'walk');
                } else {
                    activeAction.phase = 'wait_projectile';
                    setAnim(att, 'idle');

                    let projImg = null; let projFrames = 1;
                    if (att !== player && att.config && att.config.anims) {
                        let bKey = 'bullet';
                        if (att.id === 'Yurei(3)' && activeAction.anim === 'attack2') bKey = 'bullet2';
                        if (att.config.anims[bKey]) { projImg = att.assets[bKey]; projFrames = att.config.anims[bKey][1]; }
                    }

                    projectiles.push({
                        x: att.baseX + att.xOffset, y: 180, targetX: def.baseX, targetY: 180,
                        speed: 800, action: activeAction, img: projImg, frames: projFrames, frame: 0, tick: 0
                    });
                }
            }
        } else if (activeAction.phase === 'move_back') {
            att.xOffset -= moveSpeed * dir;
            if ((dir === 1 && att.xOffset <= 0) || (dir === -1 && att.xOffset >= 0)) { att.xOffset = 0; setAnim(att, 'idle'); finishActionSequence(); }
        }
    }

    if (!['ANIMATING_ACTION', 'GAME_OVER', 'ROOM_CLEAR', 'BOSS_CLEARED', 'SUMMARY'].includes(gameState)) {
        if (turnTimer > 0) turnTimer -= dt;
    }

    let p1Hp = Math.ceil(Math.max(0, player.hp));
    let p1Pct = (p1Hp / player.maxHp) * 100;
    let p2Hp = Math.ceil(Math.max(0, bot.hp));
    let p2Pct = Math.max(0, (p2Hp / bot.maxHp) * 100);

    let ultHTML = '';
    for (let i = 0; i < 4; i++) {
        ultHTML += `<span style="color: ${i < player.ultGauge ? '#FFC93C' : '#555'}; font-size: 16px; text-shadow: 1px 1px 0 #000;">●</span>`;
    }

    let pColor = player.debuffTurn > 0 ? "#9B59B6" : "#2ECC71";
    let cleanBotName = bot.id ? bot.id.split('(')[0] : '';

    let turnText = "เตรียมตัว..."; let turnColor = "#111";
    if (gameState === 'PLAYER_TURN') { turnText = "Player Turn"; turnColor = "#2ECC71"; }
    else if (gameState === 'BOT_TURN') { turnText = "Enemy Turn"; turnColor = "#E63946"; }
    // 🔴 นำ Icon เข้ามาใช้โชว์ UI บนสุดแทน ⚠️
    else if (gameState === 'QTE_EVENT') { turnText = `<img src="Icon/QTE_Icon.png" class="inline-icon"> QTE! ป้องกันด่วน!`; turnColor = "#E63946"; }
    else if (gameState === 'GAME_OVER') { turnText = "Game Over"; turnColor = "#111"; }
    else if (gameState === 'ROOM_CLEAR') { turnText = "Room Clear"; turnColor = "#FFC93C"; }
    else if (gameState === 'BOSS_CLEARED') { turnText = "Boss Defeated!"; turnColor = "#FFC93C"; }
    else if (gameState === 'SUMMARY') { turnText = "Summary"; turnColor = "#111"; }

    const uiHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; font-family: var(--font-pixel), sans-serif; font-size: 12px; margin-top: 10px; margin-bottom: 10px; color: #111; min-height: 65px;">
      <div style="text-align: left; width: 35%;">
        <div style="margin-bottom: 6px; font-weight: bold; font-size: 14px;">Player : ${p1Hp}</div>
        <div style="width: 100%; height: 18px; background: #2C2C2C; border: 3px solid #111; box-shadow: 2px 2px 0 #000;">
          <div style="width: ${p1Pct}%; height: 100%; background: ${pColor}; transition: width 0.2s;"></div>
        </div>
        <div style="margin-top: 8px;">Ult: ${ultHTML}</div>
      </div>
      <div style="text-align: center; width: 30%; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; min-height: 65px;">
         <div style="font-weight: bold; font-size: 12px; color: #555; margin-bottom: 10px; text-transform: uppercase;">Map: ${currentMapName || 'Arena'}</div>
         <div style="font-weight: bold; font-size: clamp(9px, 1.5vw, 12px); color: ${turnColor}; background: #fff; padding: 0 6px; border: 2px solid #111; box-shadow: 2px 2px 0 #000; width: 100%; max-width: 160px; height: 36px; display: flex; align-items: center; justify-content: center;">${turnText}</div>
      </div>
      <div style="text-align: right; width: 35%;">
        <div style="margin-bottom: 6px; font-weight: bold; font-size: 14px; color: #E63946;">${cleanBotName} : ${p2Hp}</div>
        <div style="width: 100%; height: 18px; background: #2C2C2C; border: 3px solid #111; box-shadow: 2px 2px 0 #000; margin-left: auto;">
          <div style="width: ${p2Pct}%; height: 100%; background: #E63946; transition: width 0.2s;"></div>
        </div>
      </div>
    </div>
  `;

    const scoreEl = document.getElementById("gameScore");
    if (scoreEl) {
        scoreEl.innerHTML = uiHTML;
        scoreEl.style.background = "transparent"; scoreEl.style.border = "none";
        scoreEl.style.width = "100%"; scoreEl.style.padding = "0"; scoreEl.style.boxShadow = "none";
    }

    const statusRow = document.getElementById("gameStatus").parentElement;
    if (statusRow) {
        statusRow.style.flexDirection = "column"; statusRow.style.alignItems = "stretch"; statusRow.style.gap = "0px";
    }

    if (window.nextStateAfterResult && window.nextStateAfterResult.name) { }

    switch (gameState) {
        case 'PLAYER_TURN': handlePlayerInput(dt); if (turnTimer <= 0) showResult("หมดเวลา! คุณเสียเทิร์น", startBotTurn); break;
        case 'QTE_EVENT': handleQTEInput(dt); if (turnTimer <= 0) executeQTEAction(false); break;
        case 'BOT_TURN': if (turnTimer <= 0) executeBotLogic(); break;
        case 'SHOW_RESULT': if (turnTimer <= 0 && window.nextStateAfterResult && !checkGameOver()) window.nextStateAfterResult(); break;
    }
}

function drawCharacter(ctx, charObj, x, y, scale, isFlipped) {
    if (!charObj.anim) return;
    const img = charObj.assets[charObj.anim];
    if (!img || !img.complete || img.width === 0) return;

    let totalFrames = (charObj === player) ? CHAR_CONFIG[charObj.name].frames[charObj.anim] : charObj.config.anims[charObj.anim][1];
    if (!totalFrames) totalFrames = 1;
    const fw = img.width / totalFrames; const fh = img.height;

    ctx.save(); ctx.translate(x, y);
    let isMovingBack = (activeAction && activeAction.phase === 'move_back');
    if (isFlipped) { if (charObj === bot && isMovingBack) ctx.scale(1, 1); else ctx.scale(-1, 1); }
    else { if (charObj === player && isMovingBack) ctx.scale(-1, 1); }

    ctx.drawImage(img, charObj.frame * fw, 0, fw, fh, -(fw * scale) / 2, -(fh * scale), fw * scale, fh * scale);
    ctx.restore();
}

export function drawGame() {
    const w = gameCanvas.width; const h = gameCanvas.height; const scale = w / 600;
    gameCtx.clearRect(0, 0, w, h);

    if (bgImage.complete && bgImage.width > 0) gameCtx.drawImage(bgImage, 0, 0, w, h);
    else { gameCtx.fillStyle = "#2C2C2C"; gameCtx.fillRect(0, 0, w, h); }

    if (!gameRunning) return;

    const floorY = h - 25 * scale; const charScale = scale * 2.2;

    if (gameState !== 'SUMMARY') {
        drawCharacter(gameCtx, player, (player.baseX + player.xOffset) * scale, floorY, charScale, false);
        if (gameState !== 'ROOM_CLEAR' || bot.hp > 0) {
            drawCharacter(gameCtx, bot, (bot.baseX + bot.xOffset) * scale, floorY, charScale, true);

            // 🔴 วาด QTE Icon ลอยกระเด้งเหนือหัวศัตรู
            if (gameState === 'QTE_EVENT' && qteIconImg.complete && qteIconImg.width > 0) {
                let qSize = 36 * scale;
                let bounce = Math.sin(Date.now() / 150) * 8 * scale;
                gameCtx.save();
                gameCtx.translate((bot.baseX + bot.xOffset) * scale, floorY - 130 * scale + bounce);
                gameCtx.drawImage(qteIconImg, -qSize / 2, -qSize / 2, qSize, qSize);
                gameCtx.restore();
            }
        }

        if (player.debuffTurn > 0 && bot.id === 'Vampire_Queen(Boss)') {
            let markImg = bot.assets['mark'];
            if (markImg && markImg.complete && markImg.width > 0) {
                let fw = markImg.width / 3; let fh = markImg.height;
                let mFrame = Math.floor(Date.now() / 150) % 3;
                gameCtx.save(); gameCtx.translate((player.baseX + player.xOffset) * scale, floorY);
                gameCtx.drawImage(markImg, mFrame * fw, 0, fw, fh, -(fw * charScale) / 2, -(fh * charScale), fw * charScale, fh * charScale);
                gameCtx.restore();
            }
        }

        effects.forEach(eff => {
            let effConf = EFFECT_CONFIG[eff.type]; let imgData = effectAssets[eff.type];
            let effScale = (eff.type === 'hit') ? scale * 0.8 : scale * 1.5;
            if (effConf.type === 'sheet') {
                let img = imgData;
                if (img && img.complete && img.width > 0) {
                    let fw = img.width / effConf.frames; let fh = img.height;
                    gameCtx.save(); gameCtx.translate(eff.x * scale, eff.y * scale); if (eff.x < 300) gameCtx.scale(-1, 1);
                    gameCtx.drawImage(img, eff.frame * fw, 0, fw, fh, -(fw * effScale) / 2, -(fh * effScale) / 2, fw * effScale, fh * effScale); gameCtx.restore();
                }
            } else {
                if (imgData && imgData.length > 0) {
                    let img = imgData[eff.frame];
                    if (img && img.complete && img.width > 0) {
                        gameCtx.save(); gameCtx.translate(eff.x * scale, eff.y * scale); if (eff.x < 300) gameCtx.scale(-1, 1);
                        gameCtx.drawImage(img, 0, 0, img.width, img.height, -(img.width * effScale) / 2, -(img.height * effScale) / 2, img.width * effScale, img.height * effScale); gameCtx.restore();
                    }
                }
            }
        });

        projectiles.forEach(p => {
            if (p.img && p.img.complete && p.img.width > 0) {
                let fw = p.img.width / p.frames; let fh = p.img.height; let pScale = scale * 2.0;
                gameCtx.save(); gameCtx.translate(p.x * scale, p.y * scale);
                if (p.x > p.targetX) gameCtx.scale(-1, 1);
                gameCtx.drawImage(p.img, p.frame * fw, 0, fw, fh, -(fw * pScale) / 2, -(fh * pScale) / 2, fw * pScale, fh * pScale);
                gameCtx.restore();
            } else {
                gameCtx.fillStyle = (p.action.attacker === player) ? '#8ECAE6' : '#E63946'; gameCtx.beginPath();
                gameCtx.arc(p.x * scale, p.y * scale, 12 * scale, 0, Math.PI * 2); gameCtx.fill();
                gameCtx.fillStyle = '#FFFFFF88'; gameCtx.beginPath();
                gameCtx.arc((p.x - (p.targetX - p.x) * 0.05) * scale, p.y * scale, 6 * scale, 0, Math.PI * 2); gameCtx.fill();
            }
        });
    }

    if (gameState === 'SUMMARY') {
        gameCtx.fillStyle = "rgba(0,0,0,0.85)"; gameCtx.fillRect(0, 0, w, h);
        gameCtx.fillStyle = "#FFC93C"; gameCtx.textAlign = "center"; gameCtx.font = "600 " + Math.round(28 * scale) + "px " + GAME_FONT;
        gameCtx.fillText("STAGE CLEARED!", w / 2, h / 2 - 30 * scale);
        gameCtx.fillStyle = "#FFFFFF"; gameCtx.font = "400 " + Math.round(14 * scale) + "px " + GAME_FONT;
        let mapsText = sessionClearedMaps.join(" ➔ ");
        if (sessionClearedMaps.length === 0) mapsText = "ยังไม่ผ่านด่านใดเลย";
        gameCtx.fillText("ด่านที่พิชิตได้: " + mapsText, w / 2, h / 2 + 10 * scale); gameCtx.textAlign = "left";
    } else {
        if (gameState === 'QTE_EVENT') {
            gameCtx.textAlign = "center"; gameCtx.fillStyle = "#E63946"; gameCtx.font = "600 " + Math.round(34 * scale) + "px " + GAME_FONT;
            gameCtx.fillText(Math.ceil(turnTimer), w / 2, h / 2 - 40 * scale); gameCtx.textAlign = "left";
        }
        if ((gameState === 'PLAYER_TURN' || gameState === 'QTE_EVENT') && poseHoldTime > 0) {
            const reqTime = gameState === 'QTE_EVENT' ? 0.5 : GAME_SETTINGS.REQUIRED_HOLD_TIME; const holdBarW = 200 * scale;
            gameCtx.fillStyle = "#111111"; gameCtx.fillRect((w - holdBarW) / 2, h - 50 * scale, holdBarW, 8 * scale);
            gameCtx.fillStyle = "#FFC93C"; gameCtx.fillRect((w - holdBarW) / 2 + 2, h - 50 * scale + 2, Math.min(1, poseHoldTime / reqTime) * (holdBarW - 4), 4 * scale);
        }
    }

    const logUI = document.getElementById("combatLogUI");
    if (logUI) {
        // 🔴 แก้ไขให้ใช้ innerHTML เพื่อให้ tag img แสดงผลได้
        logUI.innerHTML = combatLog;
        logUI.style.minHeight = "40px"; logUI.style.display = "flex"; logUI.style.alignItems = "center"; logUI.style.justifyContent = "center";
        if (gameState === 'QTE_EVENT') logUI.classList.add('qte-alert'); else logUI.classList.remove('qte-alert');
    }
}