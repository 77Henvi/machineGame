// ===============================
// config.js - ฐานข้อมูลและตั้งค่า
// ===============================
export const AI_MODEL = {
    URL: "https://teachablemachine.withgoogle.com/models/_6nxgyh4J/",
    CONFIDENCE_LIMIT: 0.80,
    PREDICT_INTERVAL_MS: 100
};

export const GAME_SETTINGS = {
    PLAYER_TURN_TIME: 5,
    QTE_TIME: 3,
    RESULT_DELAY: 1.2,
    REQUIRED_HOLD_TIME: 1.0
};

export const CHAR_CONFIG = {
    Samurai: { type: 'melee', frames: { idle: 6, walk: 8, attack1: 3, attack2: 4, ult: 6, defend: 2, hurt: 2, dead: 3 } },
    Fighter: { type: 'melee', frames: { idle: 6, walk: 8, attack1: 4, attack2: 3, ult: 4, defend: 2, hurt: 3, dead: 3 } },
    Knight: { type: 'melee', frames: { idle: 4, walk: 8, attack1: 4, attack2: 4, ult: 5, defend: 5, hurt: 2, dead: 6 } },
    Wizard: { type: 'melee', frames: { idle: 7, walk: 7, attack1: 10, attack2: 4, ult: 13, defend: 7, hurt: 3, dead: 5 } }
};

export const FILE_NAMES = {
    idle: "Idle.png", walk: "Walk.png", attack1: "Attack_1.png", attack2: "Attack_2.png",
    ult: "Ult.png", defend: "Shield.png", hurt: "Hurt.png", dead: "Dead.png"
};

export const MAP_DATA = {
    'Forest': {
        rooms: [
            { bg: "Background/Forest/Spring.png", id: 'Slime(1)', type: 'melee', hp: 50, atk: 5, folder: "In_Forest/Slime(1)/", anims: { idle: ["Idle.png", 8], walk: ["Walk.png", 8], attack1: ["Attack_1.png", 4], attack2: ["Attack_2.png", 4], hurt: ["Hurt.png", 6], dead: ["Dead.png", 3] } },
            { bg: "Background/Forest/Summer.png", id: 'Werewolf(2)', type: 'melee', hp: 100, atk: 10, folder: "In_Forest/Werewolf(2)/", anims: { idle: ["Idle.png", 8], walk: ["Walk.png", 11], attack1: ["Attack_1.png", 5], attack2: ["Attack_2.png", 4], hurt: ["Hurt.png", 2], dead: ["Dead.png", 2] } },
            { bg: "Background/Forest/Autumn.png", id: 'Satyr(3)', type: 'ranged', hp: 50, atk: 15, hits: 2, folder: "In_Forest/Satyr(3)/", anims: { idle: ["Idle.png", 7], walk: ["Idle.png", 7], attack1: ["Attack_1.png", 8], bullet: ["Attack1_Bullet.png", 8], hurt: ["Hurt.png", 4], dead: ["Dead.png", 4] } },
            { bg: "Background/Forest/Winter.png", id: 'Minotaur(Boss)', type: 'melee', hp: 150, atk: 40, cd: 2, folder: "In_Forest/Minotaur(Boss)/", anims: { idle: ["Idle.png", 10], walk: ["Walk.png", 12], attack1: ["Attack_1.png", 5], hurt: ["Hurt.png", 3], dead: ["Dead.png", 5] } }
        ]
    },
    'Graveyard': {
        rooms: [
            { bg: "Background/Graveyard/Graveyard.png", id: 'Zombie(1)', type: 'melee', hp: 70, atk: 10, folder: "In_Graveyard/Zombie(1)/", anims: { idle: ["Idle.png", 6], walk: ["Walk.png", 10], attack1: ["Attack_1.png", 4], attack2: ["Attack_1.png", 4], hurt: ["Hurt.png", 4], dead: ["Dead.png", 5] } },
            { bg: "Background/Graveyard/Graveyard.png", id: 'Skeleton(2)', type: 'melee', hp: 100, atk: 15, folder: "In_Graveyard/Skeleton(2)/", anims: { idle: ["Idle.png", 7], walk: ["Walk.png", 7], attack1: ["Attack_1.png", 5], attack2: ["Attack_2.png", 4], hurt: ["Hurt.png", 2], dead: ["Dead.png", 4] } },
            { bg: "Background/Graveyard/Graveyard.png", id: 'Yurei(3)', type: 'ranged', hp: 90, atk: 15, unblockable: true, folder: "In_Graveyard/Yurei(3)/", anims: { idle: ["Idle.png", 5], walk: ["Idle.png", 5], attack1: ["Attack_1.png", 7], bullet: ["Attack1_Bullet.png", 3], attack2: ["Attack_2.png", 7], bullet2: ["Attack2_Bullet.png", 4], hurt: ["Hurt.png", 3], dead: ["Dead.png", 4] } },
            { bg: "Background/Graveyard/Graveyard.png", id: 'Gorgon(Boss)', type: 'melee', hp: 200, atk: 15, hasPhase2: true, folder: "In_Graveyard/Gorgon(Boss)/", anims: { idle: ["Idle_Form1.png", 5], walk: ["Walk_Form1.png", 13], attack1: ["Attack_Form1.png", 7], attack2: ["Attack_Form1.png", 7], hurt: ["Hurt_Form1.png", 3], dead: ["Dead.png", 3], idle2: ["Idle_Form2.png", 5], walk2: ["Walk_Form2.png", 13], atk1_2: ["Attack_Form2.png", 10], atk2_2: ["Attack_Form2.png", 10], hurt2: ["Hurt_Form2.png", 3] } }
        ]
    },
    'Vampire_Castle': {
        rooms: [
            { bg: "Background/Vamprie_Castle/dead forest(1).png", id: 'Skeleton(1)', type: 'ranged', hp: 100, atk: 10, folder: "In_Vampire_Castle/Skeleton(1)/", anims: { idle: ["Idle.png", 7], walk: ["Idle.png", 7], attack1: ["Attack_1.png", 15], bullet: ["Attack1_Arrow.png", 1], hurt: ["Hurt.png", 2], dead: ["Dead.png", 5] } },
            { bg: "Background/Vamprie_Castle/Outside_Castle(2).png", id: 'Vampire(2)', type: 'melee', hp: 100, atk: 5, lifesteal: 5, folder: "In_Vampire_Castle/Vampire(2)/", anims: { idle: ["Idle.png", 5], walk: ["Walk.png", 6], attack1: ["Attack_1.png", 5], attack2: ["Attack_2.png", 5], hurt: ["Hurt.png", 2], dead: ["Dead.png", 10] } },
            { bg: "Background/Vamprie_Castle/Inside_Castle(3).png", id: 'Vampire_Duke(3)', type: 'melee', hp: 120, atk: 15, lifesteal: 5, folder: "In_Vampire_Castle/Vampire_Duke(3)/", anims: { idle: ["Idle.png", 5], walk: ["Walk.png", 8], attack1: ["Attack_1.png", 4], attack2: ["Attack_2.png", 3], hurt: ["Hurt.png", 1], dead: ["Dead.png", 8] } },
            { bg: "Background/Vamprie_Castle/Throne_room(4).png", id: 'Vampire_Queen(Boss)', type: 'ranged', hp: 200, atk: 20, isQueen: true, lifesteal: 10, folder: "In_Vampire_Castle/Vampire_Queen(Boss)/", anims: { idle: ["Idle.png", 5], walk: ["Idle.png", 5], attack1: ["Attack_1.png", 6], bullet: ["Attack1_Bullet.png", 3], attack2: ["Attack_2.png", 3], ult: ["Attack_2.png", 3], hurt: ["Hurt.png", 2], dead: ["Dead.png", 8], mark: ["Attack2_Mark.png", 3] } }
        ]
    }
};

export const EFFECT_CONFIG = {
    block: { type: 'sheet', file: "Effect/Block.png", frames: 1 },
    slash: { type: 'sequence', folder: "Effect/Slash/", prefix: "Slash_", frames: 12 },
    hit: { type: 'sequence', folder: "Effect/Hit/", prefix: "Hit_", frames: 10 }
};