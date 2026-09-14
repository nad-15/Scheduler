/**
 * ============================================================================
 * SKHAYEDULER - THE ADVENTUROUS CAT'S BALLOON POPPING MINI-GAME
 * ============================================================================
 * A playable mini-game right in the scheduler drawer!
 *
 * Gameplay Mechanics:
 *   - DEFAULT (No clicking): The cat embarks on its continuous grand journey
 *     across the 4 biomes (Forest, Desert, City, Rooftops), doing its own
 *     natural animations (walking, running, pausing, loafing, flinching).
 *     It does not chase balloons. If it happens to jump into a low balloon
 *     during a dune leap or rooftop jump, it pops it by coincidence!
 *   - PLAYER INTERACTION (Click to Jump!):
 *     Whenever you click or tap the canvas, the cat JUMPS on command!
 *     Time your clicks as balloons drift past:
 *     - If your jump hits a balloon: The cat swipes with its claws (ATTACK),
 *       bursting the balloon into a shower of colorful pixel confetti
 *       with a vibrant "✦ POP! ✦" effect!
 *     - If no balloon is near: The cat performs an athletic leap and lands
 *       smoothly back on its paws.
 *
 * Layout Guarantee:
 *   - Spans 100% width of the row (aligns with the padding of other rows).
 *   - Anchored at bottom: 0, claiming 10px into the violet space above.
 *   - ZERO changes to existing CSS stylesheets or drawer height!
 * ============================================================================
 */

(function () {
    'use strict';

    // ------------------------------------------------------------------------
    // 1. Sprite Asset Preloader (All 7 Sheets Active)
    // ------------------------------------------------------------------------
    const SPRITES = {
        walk: { img: new Image(), frames: 12, src: './images/cat/WALK.png' },
        idle: { img: new Image(), frames: 8, src: './images/cat/IDLE.png' },
        jump: { img: new Image(), frames: 3, src: './images/cat/JUMP.png' },
        runningJump: { img: new Image(), frames: 3, src: './images/cat/RUNNING_JUMP.png' },
        run: { img: new Image(), frames: 8, src: './images/cat/RUN.png' },
        attack: { img: new Image(), frames: 8, src: './images/cat/ATTACK.png' },
        hurt: { img: new Image(), frames: 4, src: './images/cat/HURT.png' }
    };

    Object.keys(SPRITES).forEach(key => {
        SPRITES[key].img.src = SPRITES[key].src;
    });

    // ------------------------------------------------------------------------
    // 2. Constants & Proportions (Enlarged Cat Sprite)
    // ------------------------------------------------------------------------
    const DEFAULT_WIDTH = 380;
    const CANVAS_HEIGHT = 40; // 40px height for larger cat and balloons
    const GROUND_Y = 35;      // Feet land on ground line at y = 35
    const CAT_SCREEN_X = 75;  // Cat anchored at left-center
    const WORLD_WIDTH = 1600; // Continuous loop length in pixels

    // Sprite Scale: Player Mode Runner (42x34)
    const CAT_DEST_W = 42;
    const CAT_DEST_H = 34;
    const CAT_BASE_Y = 9.5;   // 9.5 + (48 * 34 / 64) = 35 (exact ground alignment)

    // Sprite Scale: Normal Mode Virtual Pet (Extra Big & Fluffy: 60x48)
    const PET_DEST_W = 60;
    const PET_DEST_H = 48;
    const PET_BASE_Y = -1;    // -1 + (48 * 48 / 64) = 35 (exact ground alignment)

    let currentLogicalWidth = DEFAULT_WIDTH;

    // ------------------------------------------------------------------------
    // 3. Audio Synth (Active strictly for User Interaction)
    // ------------------------------------------------------------------------
    let audioCtx = null;

    function initAudio() {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return null;
            if (!audioCtx) audioCtx = new AudioContextClass();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            return audioCtx;
        } catch (e) {
            return null;
        }
    }

    // Swift aerodynamic whoosh sound when the cat leaps (single crisp swift leap)
    function playRetroJumpSound() {
        try {
            const ctx = initAudio();
            if (!ctx) return;

            const t = ctx.currentTime;
            const duration = 0.08;

            // 1. Aerodynamic air swoosh (bandpass filtered noise)
            const bufferSize = Math.floor(ctx.sampleRate * duration);
            const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = ctx.createBufferSource();
            noise.buffer = noiseBuffer;

            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.Q.setValueAtTime(2.0, t);
            filter.frequency.setValueAtTime(380, t);
            filter.frequency.exponentialRampToValueAtTime(1200, t + 0.035);
            filter.frequency.exponentialRampToValueAtTime(300, t + duration);

            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.001, t);
            noiseGain.gain.linearRampToValueAtTime(0.06, t + 0.025);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(ctx.destination);

            noise.start(t);
            noise.stop(t + duration);

            // 2. Soft swift upward tone for clean game feedback
            const osc = ctx.createOscillator();
            const oscGain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(280, t);
            osc.frequency.exponentialRampToValueAtTime(540, t + 0.04);
            osc.frequency.exponentialRampToValueAtTime(320, t + 0.07);

            oscGain.gain.setValueAtTime(0.025, t);
            oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

            osc.connect(oscGain);
            oscGain.connect(ctx.destination);

            osc.start(t);
            osc.stop(t + 0.07);
        } catch (e) {
            // Fails silently if browser blocks audio
        }
    }

    // Crisp retro balloon pop sound (plays ONLY when user jump bursts a balloon!)
    function playRetroPopSound() {
        try {
            const ctx = initAudio();
            if (!ctx) return;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(540, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);

            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.08);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.09);
        } catch (e) {
            // Fails silently if browser blocks audio
        }
    }

    // Soft comic 8-bit tumble sound when the cat trips on an obstacle
    function playRetroHurtSound() {
        try {
            const ctx = initAudio();
            if (!ctx) return;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(75, ctx.currentTime + 0.12);

            gain.gain.setValueAtTime(0.04, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.12);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.13);
        } catch (e) {
            // Fails silently if browser blocks audio
        }
    }

    // Retro arcade countdown beep (480Hz for 3-2-1, bright 880->1320Hz chime for GO!)
    function playRetroCountdownBeep(isGo = false) {
        try {
            const ctx = initAudio();
            if (!ctx) return;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = isGo ? 'triangle' : 'sine';
            osc.frequency.setValueAtTime(isGo ? 880 : 480, ctx.currentTime);
            if (isGo) {
                osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
            }

            gain.gain.setValueAtTime(0.06, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (isGo ? 0.22 : 0.09));

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + (isGo ? 0.23 : 0.10));
        } catch (e) {
            // Fails silently if browser blocks audio
        }
    }

    // ------------------------------------------------------------------------
    // 4. World Balloons Mini-Game System
    // ------------------------------------------------------------------------
    // 12 colorful balloons drifting across the 1600px ribbon at guaranteed reachable heights
    const WORLD_BALLOONS = [
        // Forest (0 - 400px)
        { id: 'b_f1', worldX: 110, baseY: 11, color: '#f43f5e', highlight: '#fda4af', popped: false, popTimer: 0 },
        { id: 'b_f2', worldX: 240, baseY: 10, color: '#10b981', highlight: '#6ee7b7', popped: false, popTimer: 0 },
        { id: 'b_f3', worldX: 370, baseY: 11, color: '#38bdf8', highlight: '#bae6fd', popped: false, popTimer: 0 },
        // Desert (400 - 800px)
        { id: 'b_d1', worldX: 510, baseY: 10, color: '#eab308', highlight: '#fef08a', popped: false, popTimer: 0 },
        { id: 'b_d2', worldX: 650, baseY: 11, color: '#fb923c', highlight: '#fed7aa', popped: false, popTimer: 0 },
        { id: 'b_d3', worldX: 780, baseY: 10, color: '#f43f5e', highlight: '#fda4af', popped: false, popTimer: 0 },
        // City Streets (800 - 1200px)
        { id: 'b_c1', worldX: 910, baseY: 11, color: '#0ea5e9', highlight: '#7dd3fc', popped: false, popTimer: 0 },
        { id: 'b_c2', worldX: 1040, baseY: 10, color: '#ec4899', highlight: '#fbcfe8', popped: false, popTimer: 0 },
        { id: 'b_c3', worldX: 1170, baseY: 11, color: '#22c55e', highlight: '#bbf7d0', popped: false, popTimer: 0 },
        // Rooftops (1200 - 1600px)
        { id: 'b_r1', worldX: 1300, baseY: 10, color: '#a855f7', highlight: '#d8b4fe', popped: false, popTimer: 0 },
        { id: 'b_r2', worldX: 1430, baseY: 11, color: '#6366f1', highlight: '#c7d2fe', popped: false, popTimer: 0 },
        { id: 'b_r3', worldX: 1560, baseY: 10, color: '#fbbf24', highlight: '#fde68a', popped: false, popTimer: 0 }
    ];

    // ------------------------------------------------------------------------
    // 4b. Dino Runner Ground Obstacles (Carefully Spaced - Never Impossible!)
    // Minimum distance between obstacles is 170px (Cat jump length is ~55px)
    // ------------------------------------------------------------------------
    const WORLD_OBSTACLES = [
        // Zone 1: Forest (210px rhythm perfectly balanced for high-speed runs!)
        { id: 'obs_f1', worldX: 220, width: 7, height: 8, type: 'stump' },
        { id: 'obs_f2', worldX: 430, width: 8, height: 8, type: 'log' },

        // Zone 2: Desert (In active movement stretches)
        { id: 'obs_d1', worldX: 640, width: 7, height: 9, type: 'cactus' },
        { id: 'obs_d2', worldX: 850, width: 8, height: 9, type: 'cactus_pair' },

        // Zone 3: City Streets (During active street walk and run)
        { id: 'obs_c1', worldX: 1060, width: 7, height: 8, type: 'hydrant' },
        { id: 'obs_c2', worldX: 1270, width: 8, height: 8, type: 'cone' },

        // Zone 4: Rooftops & Dawn Walk (Safely spaced)
        { id: 'obs_r1', worldX: 1480, width: 8, height: 8, type: 'vent' }
    ];

    // Confetti particles when a balloon pops
    let confettiParticles = [];

    // Floating notifications (strictly for "✦ OUCH! ✦" when hitting an obstacle)
    let popNotifications = [];

    // Player Mini-Game Control States
    let userJumpTimer = 0;   // Player-triggered jump countdown
    let justPoppedTimer = 0; // Claw slash spark effect when popping

    // Dynamic Speed & Jump Scaling (From relaxing jog to don't-blink hyperspeed!)
    let currentSpeed = 38;         // 38 px/s escalating to 290+ px/s
    let currentMaxJumpTime = 0.88; // Dynamic jump duration tuned to currentSpeed

    // Dino Runner Mode Active States
    let isDinoMode = false;       // Active only when player taps to play
    let dinoScore = 0;           // Points earned in active run
    let hurtTimer = 0;           // Cat stumble state after tripping on obstacle
    let invulnerableTimer = 0;   // Post-hurt recovery grace period (flashing)
    let idlePlayTimer = 0;       // Inactivity timer to return to calm ambient mode
    let hasAnnouncedSprint = false; // Flag to pop SPRINT announcement at 200 pts

    // Countdown State before Player Mode Starts (3, 2, 1, GO!)
    let countdownTimer = 0;      // > 0 when counting down (3.0 -> 0.0)
    let lastBeepSec = -1;        // Tracks 3, 2, 1 beeps
    let goBannerTimer = 0;       // > 0 when flashing 'GO!'

    // Persistent High Score Management (Saved directly inside appSettings in localStorage)
    function getSavedHighScore() {
        try {
            const raw = localStorage.getItem('appSettings');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed['catrunner-highscore'] === 'number' && !isNaN(parsed['catrunner-highscore'])) {
                    return Math.max(0, Math.floor(parsed['catrunner-highscore']));
                }
            }
        } catch (e) {}
        return 0;
    }

    function saveHighScore(score) {
        try {
            const raw = localStorage.getItem('appSettings');
            const settings = raw ? JSON.parse(raw) : {};
            settings['catrunner-highscore'] = score;
            localStorage.setItem('appSettings', JSON.stringify(settings));
            if (typeof appSettings !== 'undefined' && appSettings) {
                appSettings['catrunner-highscore'] = score;
            }
        } catch (e) {}
    }

    let catRunnerHighScore = getSavedHighScore();
    let isNewHighScoreSession = false; // True when current run beats previous record

    function popBalloon(x, y, color, isUserPop = false) {
        // Sound plays ONLY if the balloon was popped as a result of a player tap!
        if (isUserPop) {
            playRetroPopSound();
        }

        // Burst 8 colorful pixel confetti particles
        const particleColors = [color, '#ffffff', '#fde047', '#f43f5e'];
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 / 8) * i + (Math.random() * 0.4 - 0.2);
            const speed = 20 + Math.random() * 24;
            confettiParticles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 10,
                color: particleColors[i % particleColors.length],
                size: Math.random() > 0.5 ? 2 : 1,
                life: 0.6,
                maxLife: 0.6
            });
        }
    }

    // ------------------------------------------------------------------------
    // 5. Story Beats & Narrative Schedule (Continuous Ribbon)
    // ------------------------------------------------------------------------
    // Total distance = 180 + 220 + 150 + 100 + 150 + 200 + 200 + 100 + 300 = 1600px!
    const STORY_BEATS = [
        // --- ZONE 1: FOREST (0 - 400px) ---
        { id: 'forest_walk', action: 'walk', targetDist: 180, speed: 34 },
        { id: 'forest_rest', action: 'idle', duration: 2.6, speed: 0, prop: 'leaf' },
        { id: 'forest_run', action: 'run', targetDist: 220, speed: 76 },

        // --- ZONE 2: DESERT (400 - 800px) ---
        { id: 'desert_walk', action: 'walk', targetDist: 150, speed: 34 },
        { id: 'desert_hurt', action: 'hurt', duration: 1.5, speed: 0, prop: 'critter' },
        { id: 'desert_fight', action: 'attack', duration: 2.2, speed: 0, prop: 'sparks' },
        { id: 'desert_leap', action: 'runningJump', targetDist: 100, speed: 52, jumpArc: true },
        { id: 'desert_exit', action: 'walk', targetDist: 150, speed: 34 },

        // --- ZONE 3: CITY STREETS (800 - 1200px) ---
        { id: 'city_walk', action: 'walk', targetDist: 200, speed: 34 },
        { id: 'city_lamp_rest', action: 'idle', duration: 3.0, speed: 0, prop: 'lamp_heart' },
        { id: 'city_run', action: 'run', targetDist: 200, speed: 76 },

        // --- ZONE 4: ROOFTOPS & NIGHT (1200 - 1600px) ---
        { id: 'roof_leap', action: 'jump', targetDist: 100, speed: 48, jumpArc: true },
        { id: 'roof_star', action: 'attack', duration: 2.2, speed: 0, prop: 'shooting_star' },
        { id: 'roof_sleep', action: 'idle', duration: 3.8, speed: 0, prop: 'sleeping_zzz' },
        { id: 'dawn_walk', action: 'walk', targetDist: 300, speed: 34 }
    ];

    // ------------------------------------------------------------------------
    // 6. World Scenery Registry
    // ------------------------------------------------------------------------
    const SCENERY = {
        // Celestial bodies
        sun: { worldX: 120, y: 4, size: 9 },
        sunsetSun: { worldX: 620, y: 5, size: 10 },
        moon: { worldX: 1380, y: 4, size: 6 },

        // Stars (Rooftop & Night section: 1200 - 1600)
        stars: [
            { worldX: 1230, y: 3 }, { worldX: 1270, y: 7 }, { worldX: 1315, y: 3 },
            { worldX: 1360, y: 8 }, { worldX: 1410, y: 3 }, { worldX: 1460, y: 7 },
            { worldX: 1510, y: 4 }, { worldX: 1560, y: 8 }
        ],

        // Distant Hills / Skylines (Parallax factor 0.3)
        farLandmarks: [
            { type: 'hill', worldX: 100, r: 35, color: '#bbf7d0' },
            { type: 'hill', worldX: 280, r: 42, color: '#86efac' },
            { type: 'dune', worldX: 520, r: 48, color: '#fed7aa' },
            { type: 'dune', worldX: 720, r: 56, color: '#fde68a' },
            { type: 'skyline', worldX: 950, w: 28, h: 14, color: '#475569' },
            { type: 'skyline', worldX: 1100, w: 36, h: 17, color: '#334155' },
            { type: 'skyline', worldX: 1270, w: 24, h: 14, color: '#1e293b' },
            { type: 'skyline', worldX: 1440, w: 28, h: 18, color: '#1e293b' }
        ],

        // Foreground / Midground Scenery (Parallax factor 1.0)
        items: [
            // --- FOREST (0 - 400) ---
            { type: 'pine', worldX: 60 },
            { type: 'flower', worldX: 115, color: '#ec4899' },
            { type: 'oak', worldX: 180 }, // Oak tree where cat rests
            { type: 'flower', worldX: 205, color: '#f43f5e' },
            { type: 'pine', worldX: 280 },
            { type: 'flower', worldX: 340, color: '#eab308' },
            { type: 'pine', worldX: 370 },

            // --- DESERT (400 - 800) ---
            { type: 'rock', worldX: 450, w: 10, h: 5 },
            { type: 'cactus', worldX: 490 },
            { type: 'critter', worldX: 575 }, // Desert scorpion
            { type: 'cactus', worldX: 640 },
            { type: 'rock', worldX: 720, w: 12, h: 6 },

            // --- CITY STREETS (800 - 1200) ---
            { type: 'house', worldX: 840, w: 36, h: 17, color: '#475569' },
            { type: 'house', worldX: 930, w: 42, h: 19, color: '#334155' },
            { type: 'streetlamp', worldX: 1000 }, // Warm glowing lamp
            { type: 'house', worldX: 1080, w: 38, h: 17, color: '#475569' },

            // --- ROOFTOPS (1200 - 1600) ---
            { type: 'antenna', worldX: 1230 },
            { type: 'skylight', worldX: 1350 },
            { type: 'antenna', worldX: 1530 }
        ]
    };

    // ------------------------------------------------------------------------
    // 7. Sky Color Palette & Dynamic Interpolation
    // ------------------------------------------------------------------------
    const SKY_STOPS = [
        { wx: 0, color: [224, 242, 254] },
        { wx: 300, color: [186, 230, 253] },
        { wx: 550, color: [254, 215, 170] },
        { wx: 750, color: [251, 146, 60] },
        { wx: 900, color: [148, 115, 140] },
        { wx: 1050, color: [51, 65, 85] },
        { wx: 1250, color: [15, 23, 42] },
        { wx: 1450, color: [8, 12, 24] },
        { wx: 1550, color: [60, 60, 95] },
        { wx: 1600, color: [224, 242, 254] }
    ];

    function getSkyColor(worldX) {
        const wx = ((worldX % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH;
        let c1 = SKY_STOPS[0];
        let c2 = SKY_STOPS[1];

        for (let i = 0; i < SKY_STOPS.length - 1; i++) {
            if (wx >= SKY_STOPS[i].wx && wx <= SKY_STOPS[i + 1].wx) {
                c1 = SKY_STOPS[i];
                c2 = SKY_STOPS[i + 1];
                break;
            }
        }

        const span = c2.wx - c1.wx;
        const t = span === 0 ? 0 : (wx - c1.wx) / span;

        const r = Math.round(c1.color[0] + (c2.color[0] - c1.color[0]) * t);
        const g = Math.round(c1.color[1] + (c2.color[1] - c1.color[1]) * t);
        const b = Math.round(c1.color[2] + (c2.color[2] - c1.color[2]) * t);

        return `rgb(${r}, ${g}, ${b})`;
    }

    // ------------------------------------------------------------------------
    // 8. Coordinates & Parallax Helper
    // ------------------------------------------------------------------------
    function worldToScreenX(itemWorldX, cameraX, parallax = 1.0) {
        const effectiveCamX = cameraX * parallax;
        let dx = itemWorldX - (effectiveCamX % WORLD_WIDTH);
        dx = ((dx % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH;
        if (dx > WORLD_WIDTH - 250) {
            dx -= WORLD_WIDTH;
        }
        return Math.round(dx);
    }

    // ------------------------------------------------------------------------
    // 9. Drawing Helpers: Sprites, Scenery, Balloons
    // ------------------------------------------------------------------------
    function drawCatSprite(ctx, spriteKey, frameIndex, drawX, drawY, flipRight = true, customW = CAT_DEST_W, customH = CAT_DEST_H) {
        const sprite = SPRITES[spriteKey];
        if (!sprite || !sprite.img || !sprite.img.complete || sprite.img.naturalWidth === 0) {
            return;
        }

        const fw = 80;
        const fh = 64;
        const totalFrames = sprite.frames || 1;
        const currentFrame = Math.floor(frameIndex) % totalFrames;
        const sx = currentFrame * fw;
        const sy = 0;

        ctx.save();
        ctx.imageSmoothingEnabled = false;

        if (flipRight) {
            ctx.translate(Math.round(drawX + customW), Math.round(drawY));
            ctx.scale(-1, 1);
            ctx.drawImage(sprite.img, sx, sy, fw, fh, 0, 0, customW, customH);
        } else {
            ctx.drawImage(sprite.img, sx, sy, fw, fh, Math.round(drawX), Math.round(drawY), customW, customH);
        }

        ctx.restore();
    }

    function drawPixelBalloon(ctx, x, y, color, highlight, sway) {
        const drawX = Math.round(x);
        const drawY = Math.round(y);

        // Balloon body (6x7 pixel oval with full volume)
        ctx.fillStyle = color;
        ctx.fillRect(drawX + 1, drawY, 4, 1);
        ctx.fillRect(drawX, drawY + 1, 6, 5);
        ctx.fillRect(drawX + 1, drawY + 6, 4, 1);

        // Specular highlight
        ctx.fillStyle = highlight;
        ctx.fillRect(drawX + 1, drawY + 1, 2, 2);

        // Balloon knot
        ctx.fillStyle = color;
        ctx.fillRect(drawX + 2, drawY + 7, 2, 1);

        // Swaying string
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(drawX + 2, drawY + 8, 1, 3);
        ctx.fillRect(drawX + 2 + Math.round(sway), drawY + 11, 1, 4);
    }

    function drawSpeechBubble(ctx, text, x, y, isPop = false) {
        ctx.font = 'bold 8px monospace, sans-serif';
        const textWidth = Math.round(ctx.measureText(text).width);
        const padX = 4;
        const padY = 2;
        const bubbleW = textWidth + padX * 2;
        const bubbleH = 11;

        // Clamp safely so it NEVER clips off top, bottom, or sides
        const bubbleX = Math.max(3, Math.min(currentLogicalWidth - bubbleW - 3, Math.round(x - bubbleW / 2)));
        const bubbleY = Math.max(2, Math.min(CANVAS_HEIGHT - bubbleH - 3, Math.round(y)));

        // Subtle drop shadow for high contrast against any sky
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(bubbleX + 1, bubbleY + 1, bubbleW, bubbleH);

        // Bubble background (bright retro yellow for pop, white for dialogue)
        ctx.fillStyle = isPop ? '#fef08a' : '#ffffff';
        ctx.fillRect(bubbleX, bubbleY, bubbleW, bubbleH);

        // Border
        ctx.strokeStyle = isPop ? '#f43f5e' : '#e11d48';
        ctx.lineWidth = 1;
        ctx.strokeRect(bubbleX + 0.5, bubbleY + 0.5, bubbleW - 1, bubbleH - 1);

        // Text
        ctx.fillStyle = '#0f172a';
        ctx.textBaseline = 'top';
        ctx.fillText(text, bubbleX + padX, bubbleY + padY);
    }

    function drawPixelText(ctx, text, x, y, color, size = 7) {
        ctx.fillStyle = color;
        ctx.font = `bold ${size}px monospace, sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(text, Math.round(x), Math.round(y));
    }

    // ------------------------------------------------------------------------
    // 10. Continuous Ground Renderer (Thin 1px Minimalist Baseline)
    // ------------------------------------------------------------------------
    function drawContinuousGround(ctx, cameraX, width, groundY) {
        // Crisp 1px thin ground baseline (Chrome Dino style - zero bulky thickness)
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(0, groundY, width, 1);

        // Subtle 1px ground texture specks that scroll to give a sense of motion
        for (let sx = 0; sx < width; sx += 8) {
            const wx = (((cameraX + sx) % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH;
            if (wx % 32 === 0) {
                ctx.fillStyle = '#cbd5e1';
                ctx.fillRect(sx, groundY + 2, 3, 1);
            } else if (wx % 48 === 16) {
                ctx.fillStyle = '#e2e8f0';
                ctx.fillRect(sx, groundY + 3, 2, 1);
            }
        }
    }

    // ------------------------------------------------------------------------
    // 11. Scenery Objects Renderer
    // ------------------------------------------------------------------------
    function drawScenery(ctx, cameraX, movieTime) {
        // A. Celestial bodies
        // 1. Morning Sun
        const sunSx = worldToScreenX(SCENERY.sun.worldX, cameraX, 0.2);
        if (sunSx >= -20 && sunSx <= currentLogicalWidth + 20) {
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(sunSx, SCENERY.sun.y, SCENERY.sun.size, SCENERY.sun.size);
            ctx.fillStyle = '#fde68a';
            ctx.fillRect(sunSx + 1, SCENERY.sun.y + 1, SCENERY.sun.size - 2, SCENERY.sun.size - 2);
        }

        // 2. Sunset Sun
        const sunsetSx = worldToScreenX(SCENERY.sunsetSun.worldX, cameraX, 0.2);
        if (sunsetSx >= -20 && sunsetSx <= currentLogicalWidth + 20) {
            ctx.fillStyle = '#f43f5e';
            ctx.fillRect(sunsetSx, SCENERY.sunsetSun.y, SCENERY.sunsetSun.size, SCENERY.sunsetSun.size);
            ctx.fillStyle = '#fb923c';
            ctx.fillRect(sunsetSx + 1, SCENERY.sunsetSun.y + 1, SCENERY.sunsetSun.size - 2, SCENERY.sunsetSun.size - 2);
        }

        // 3. Crescent Moon
        const moonSx = worldToScreenX(SCENERY.moon.worldX, cameraX, 0.15);
        if (moonSx >= -20 && moonSx <= currentLogicalWidth + 20) {
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(moonSx + 3, SCENERY.moon.y + 3, SCENERY.moon.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = getSkyColor(cameraX + moonSx);
            ctx.beginPath();
            ctx.arc(moonSx + 1, SCENERY.moon.y + 2, SCENERY.moon.size - 1, 0, Math.PI * 2);
            ctx.fill();
        }

        // 4. Stars
        SCENERY.stars.forEach((star, i) => {
            const starSx = worldToScreenX(star.worldX, cameraX, 0.15);
            if (starSx >= -5 && starSx <= currentLogicalWidth + 5) {
                const twinkle = Math.sin(movieTime * 3.5 + i) > 0;
                if (twinkle) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(starSx, star.y, 1, 1);
                }
            }
        });

        // B. Far Background Landmarks (Parallax 0.3)
        SCENERY.farLandmarks.forEach(item => {
            const sx = worldToScreenX(item.worldX, cameraX, 0.3);
            if (sx < -60 || sx > currentLogicalWidth + 60) return;

            if (item.type === 'hill' || item.type === 'dune') {
                ctx.fillStyle = item.color;
                ctx.beginPath();
                ctx.arc(sx, GROUND_Y + item.r * 0.45, item.r, Math.PI, 0, false);
                ctx.fill();
            } else if (item.type === 'skyline') {
                ctx.fillStyle = item.color;
                ctx.fillRect(sx, GROUND_Y - item.h, item.w, item.h);
                // Windows
                ctx.fillStyle = '#fef08a';
                ctx.fillRect(sx + 2, GROUND_Y - item.h + 3, 2, 2);
                ctx.fillRect(sx + 7, GROUND_Y - item.h + 7, 2, 2);
            }
        });

        // C. Foreground / Midground Scenery (Parallax 1.0)
        // Soften background scenery in Dino Mode so player can immediately spot obstacles!
        if (isDinoMode) {
            ctx.globalAlpha = 0.35;
        }
        SCENERY.items.forEach(item => {
            const sx = worldToScreenX(item.worldX, cameraX, 1.0);
            if (sx < -60 || sx > currentLogicalWidth + 60) return;

            switch (item.type) {
                case 'pine':
                    ctx.fillStyle = '#78350f';
                    ctx.fillRect(sx + 4, GROUND_Y - 5, 2, 5);
                    ctx.fillStyle = '#15803d';
                    ctx.fillRect(sx, GROUND_Y - 10, 10, 5);
                    ctx.fillRect(sx + 2, GROUND_Y - 14, 6, 4);
                    ctx.fillRect(sx + 3, GROUND_Y - 17, 4, 3);
                    break;

                case 'oak':
                    ctx.fillStyle = '#78350f';
                    ctx.fillRect(sx + 6, GROUND_Y - 6, 3, 6);
                    ctx.fillStyle = '#16a34a';
                    ctx.beginPath();
                    ctx.arc(sx + 7, GROUND_Y - 12, 8, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#22c55e';
                    ctx.beginPath();
                    ctx.arc(sx + 5, GROUND_Y - 13, 5, 0, Math.PI * 2);
                    ctx.fill();
                    break;

                case 'flower':
                    ctx.fillStyle = '#16a34a';
                    ctx.fillRect(sx, GROUND_Y - 3, 1, 3);
                    ctx.fillStyle = item.color;
                    ctx.fillRect(sx - 1, GROUND_Y - 4, 3, 2);
                    break;

                case 'cactus':
                    ctx.fillStyle = '#15803d';
                    ctx.fillRect(sx + 2, GROUND_Y - 12, 2, 12);
                    ctx.fillRect(sx, GROUND_Y - 8, 2, 2);
                    ctx.fillRect(sx, GROUND_Y - 10, 1, 3);
                    ctx.fillRect(sx + 4, GROUND_Y - 7, 2, 2);
                    ctx.fillRect(sx + 5, GROUND_Y - 9, 1, 3);
                    break;

                case 'rock':
                    ctx.fillStyle = '#c2410c';
                    ctx.fillRect(sx, GROUND_Y - item.h, item.w, item.h);
                    break;

                case 'critter':
                    // Desert scorpion
                    ctx.fillStyle = '#92400e';
                    ctx.fillRect(sx, GROUND_Y - 4, 5, 4);
                    ctx.fillRect(sx + 5, GROUND_Y - 3, 2, 2);
                    ctx.fillRect(sx - 1, GROUND_Y - 5, 1, 3);
                    ctx.fillRect(sx - 2, GROUND_Y - 6, 2, 1);
                    break;

                case 'house':
                    ctx.fillStyle = item.color;
                    ctx.fillRect(sx, GROUND_Y - item.h, item.w, item.h);
                    ctx.fillStyle = '#1e293b';
                    ctx.fillRect(sx - 1, GROUND_Y - item.h - 1, item.w + 2, 2);
                    ctx.fillStyle = '#fef08a';
                    ctx.fillRect(sx + 5, GROUND_Y - item.h + 4, 4, 4);
                    ctx.fillRect(sx + item.w - 9, GROUND_Y - item.h + 4, 4, 4);
                    break;

                case 'streetlamp':
                    ctx.fillStyle = '#1e293b';
                    ctx.fillRect(sx + 2, GROUND_Y - 18, 2, 18);
                    ctx.fillRect(sx - 1, GROUND_Y - 21, 8, 3);
                    ctx.fillStyle = '#facc15';
                    ctx.fillRect(sx, GROUND_Y - 18, 6, 4);

                    // Light cone spilling on cobblestones
                    ctx.fillStyle = 'rgba(254, 240, 138, 0.2)';
                    ctx.beginPath();
                    ctx.moveTo(sx + 3, GROUND_Y - 14);
                    ctx.lineTo(sx - 14, GROUND_Y);
                    ctx.lineTo(sx + 20, GROUND_Y);
                    ctx.closePath();
                    ctx.fill();
                    break;

                case 'antenna':
                    ctx.fillStyle = '#94a3b8';
                    ctx.fillRect(sx + 2, GROUND_Y - 19, 1, 19);
                    ctx.fillRect(sx - 1, GROUND_Y - 16, 7, 1);
                    if (Math.floor(movieTime * 2) % 2 === 0) {
                        ctx.fillStyle = '#ef4444';
                        ctx.fillRect(sx + 1, GROUND_Y - 20, 3, 2);
                    }
                    break;

                case 'skylight':
                    ctx.fillStyle = '#475569';
                    ctx.fillRect(sx, GROUND_Y - 5, 10, 5);
                    ctx.fillStyle = '#94a3b8';
                    ctx.fillRect(sx + 1, GROUND_Y - 6, 8, 1);
                    break;
            }
        });
        ctx.globalAlpha = 1.0;
    }

    // ------------------------------------------------------------------------
    // 11b. Dino Obstacle Pixel Renderer (High Contrast + Danger Beacons!)
    // ------------------------------------------------------------------------
    function drawObstacle(ctx, obs, sx) {
        const ox = Math.round(sx);

        // 1. Floating Pulsing Danger Beacon (Red & Yellow Warning Marker!)
        // Guarantees player spots obstacles from across the screen
        const markerX = Math.round(sx + obs.width / 2);
        const markerY = GROUND_Y - obs.height - 4;
        const blink = Math.sin(movieTime * 11) > 0;

        ctx.fillStyle = blink ? '#ef4444' : '#fbbf24';
        ctx.fillRect(markerX - 1, markerY, 3, 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(markerX, markerY, 1, 1);

        // 2. High-Contrast Pixel Cacti with Dark Outlines & Neon Spines (Chrome Dino Style)
        if (obs.type === 'cactus' || obs.type === 'stump' || obs.type === 'vent' || obs.type === 'pipe') {
            // Single Tall Desert Cactus: dark border + vivid emerald green body + neon spines
            // Dark silhouette outline
            ctx.fillStyle = '#052e16';
            ctx.fillRect(ox + 1, GROUND_Y - 10, 5, 10);
            ctx.fillRect(ox - 1, GROUND_Y - 8, 4, 6);
            ctx.fillRect(ox + 3, GROUND_Y - 6, 4, 5);

            // Vivid emerald green body
            ctx.fillStyle = '#16a34a';
            ctx.fillRect(ox + 2, GROUND_Y - 9, 3, 9);
            ctx.fillRect(ox, GROUND_Y - 7, 2, 4);
            ctx.fillRect(ox + 4, GROUND_Y - 5, 2, 3);

            // Neon lime spines
            ctx.fillStyle = '#86efac';
            ctx.fillRect(ox + 3, GROUND_Y - 8, 1, 3);
            ctx.fillRect(ox, GROUND_Y - 7, 1, 1);
            ctx.fillRect(ox + 5, GROUND_Y - 5, 1, 1);
        } else {
            // Double Cacti Pair: small cactus + tall cactus with bold outlines
            // Left small cactus
            ctx.fillStyle = '#052e16';
            ctx.fillRect(ox - 1, GROUND_Y - 7, 4, 7);
            ctx.fillStyle = '#16a34a';
            ctx.fillRect(ox, GROUND_Y - 6, 2, 6);
            ctx.fillStyle = '#86efac';
            ctx.fillRect(ox, GROUND_Y - 5, 1, 2);

            // Right tall cactus
            ctx.fillStyle = '#052e16';
            ctx.fillRect(ox + 3, GROUND_Y - 9, 5, 9);
            ctx.fillRect(ox + 6, GROUND_Y - 6, 3, 4);
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(ox + 4, GROUND_Y - 8, 3, 8);
            ctx.fillRect(ox + 6, GROUND_Y - 5, 2, 2);
            ctx.fillStyle = '#bbf7d0';
            ctx.fillRect(ox + 5, GROUND_Y - 7, 1, 3);
        }
    }

    // ------------------------------------------------------------------------
    // 12. Engine State & Lifecycle
    // ------------------------------------------------------------------------
    let canvas = null;
    let ctx = null;
    let animationFrameId = null;
    let lastTime = 0;
    let movieTime = 0;
    let isRunning = false;
    let isVisible = false; // Hidden until triggered via subtle button
    let resizeObserver = null;

    let catWorldX = 0;
    let currentBeatIndex = 0;
    let beatProgress = 0;

    function resizeCanvasToContainer() {
        if (!canvas) return;
        const box = canvas.parentElement || document.querySelector('.jumping-text-box');
        const targetW = Math.round(box ? box.clientWidth : (canvas.clientWidth || DEFAULT_WIDTH));

        if (targetW > 50 && Math.abs(targetW - currentLogicalWidth) > 1) {
            currentLogicalWidth = targetW;
            const dpr = Math.min(window.devicePixelRatio || 1, 3);
            canvas.width = Math.round(currentLogicalWidth * dpr);
            canvas.height = Math.round(CANVAS_HEIGHT * dpr);
            if (ctx) {
                ctx.scale(dpr, dpr);
                ctx.imageSmoothingEnabled = false;
            }
        }
    }

    function createMovieCanvas() {
        if (canvas) return canvas;

        canvas = document.createElement('canvas');
        canvas.id = 'cat-runner-canvas';
        canvas.setAttribute('title', 'Click to make the cat jump and pop balloons!');

        // Layout: Spans 100% width of row, anchored at bottom = 0
        // Aligns with the exact padding of all other rows above it!
        canvas.style.display = 'block';
        canvas.style.position = 'absolute';
        canvas.style.bottom = '0';
        canvas.style.left = '0';
        canvas.style.right = '0';
        canvas.style.width = '100%';
        canvas.style.transform = 'none';
        canvas.style.margin = '0';
        canvas.style.cursor = 'pointer';
        canvas.style.userSelect = 'none';
        canvas.style.webkitUserSelect = 'none';
        canvas.style.imageRendering = 'pixelated';
        canvas.style.imageRendering = 'crisp-edges';
        canvas.style.overflow = 'visible';
        canvas.style.pointerEvents = 'auto';

        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        currentLogicalWidth = DEFAULT_WIDTH;
        canvas.width = Math.round(currentLogicalWidth * dpr);
        canvas.height = Math.round(CANVAS_HEIGHT * dpr);
        canvas.style.height = `${CANVAS_HEIGHT}px`;

        ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.imageSmoothingEnabled = false;

        canvas.addEventListener('click', onCanvasClick);
        canvas.addEventListener('touchstart', onCanvasClick, { passive: false });

        return canvas;
    }

    let lastTapTime = 0;

    // Player Mini-Game Control: Click / Tap makes the cat jump!
    function onCanvasClick(e) {
        if (e && e.cancelable) {
            e.preventDefault();
        }

        const now = Date.now();
        if (now - lastTapTime < 280) {
            return; // Strictly prevent duplicate touchstart + click double-fire
        }
        lastTapTime = now;

        initAudio(); // Unlocks Web Audio API directly on user gesture

        // If dead/stumbling from crash, tapping immediately resets distance to 0 and starts 3-2-1 countdown!
        if (hurtTimer > 0) {
            hurtTimer = 0;
            isDinoMode = false;
            dinoScore = 0;
            currentSpeed = 38;
            catWorldX = CAT_SCREEN_X;
            countdownTimer = 3.0;
            lastBeepSec = 3;
            goBannerTimer = 0;
            idlePlayTimer = 0;
            catRunnerHighScore = getSavedHighScore();
            isNewHighScoreSession = false;
            playRetroCountdownBeep(false); // First countdown beep for '3'
            return;
        }

        // If currently in countdown, allow cute preparatory jump
        if (countdownTimer > 0) {
            triggerUserJump();
            return;
        }

        if (isDinoMode) {
            idlePlayTimer = 0; // Reset inactivity timer
            triggerUserJump();
        }

        const taskInput = document.getElementById('task');
        if (taskInput) {
            taskInput.value = '';
        }
    }

    function getJumpDuration(speed) {
        // Smooth linear curve: 0.88s at 38 px/s down to 0.44s at 280 px/s
        return Math.max(0.44, 0.88 - Math.max(0, speed - 38) * 0.0018);
    }

    function triggerUserJump() {
        // Player command: Jump! Snappy and athletic as speed climbs!
        currentMaxJumpTime = getJumpDuration(currentSpeed);
        userJumpTimer = currentMaxJumpTime;
        playRetroJumpSound();  // Soft cute 8-bit hop feedback
    }

    // ------------------------------------------------------------------------
    // 12b. Cat Runner Mini-Game Lifecycle (Start & Exit)
    // ------------------------------------------------------------------------
    function startMiniGame() {
        initAudio();
        const jumpingTextContainer = document.querySelector('.jumping-text-container');
        if (jumpingTextContainer) {
            jumpingTextContainer.style.display = 'none';
        }
        const triggerBtn = document.getElementById('cat-runner-trigger-btn');
        if (triggerBtn) {
            triggerBtn.style.display = 'none';
        }

        const cvs = createMovieCanvas();
        cvs.style.display = 'block';
        resizeCanvasToContainer();

        catRunnerHighScore = getSavedHighScore();
        isNewHighScoreSession = false;

        isVisible = true;
        isDinoMode = false;
        dinoScore = 0;
        currentSpeed = 38;
        catWorldX = CAT_SCREEN_X;
        countdownTimer = 3.0;
        lastBeepSec = 3;
        goBannerTimer = 0;
        hurtTimer = 0;
        idlePlayTimer = 0;
        invulnerableTimer = 0;
        hasAnnouncedSprint = false;

        playRetroCountdownBeep(false); // First countdown beep for '3'
        start();
    }

    function exitMiniGame() {
        isVisible = false;
        isDinoMode = false;
        countdownTimer = 0;
        goBannerTimer = 0;
        hurtTimer = 0;
        userJumpTimer = 0;
        dinoScore = 0;
        currentSpeed = 38;
        idlePlayTimer = 0;
        lastBeepSec = -1;
        stop();

        if (canvas) {
            canvas.style.display = 'none';
        }
        const jumpingTextContainer = document.querySelector('.jumping-text-container');
        if (jumpingTextContainer) {
            jumpingTextContainer.style.display = '';
        }
        const triggerBtn = document.getElementById('cat-runner-trigger-btn');
        if (triggerBtn) {
            triggerBtn.style.display = '';
        }
    }

    // ------------------------------------------------------------------------
    // 13. Narrative & Balloon Progression
    // ------------------------------------------------------------------------
    function updateJourney(dt) {
        const isUserJump = (userJumpTimer > 0);

        // Countdown user jump and pop effect
        if (userJumpTimer > 0) {
            userJumpTimer = Math.max(0, userJumpTimer - dt);
        }
        if (justPoppedTimer > 0) {
            justPoppedTimer = Math.max(0, justPoppedTimer - dt);
        }

        // Dino Mode State Machine
        if (hurtTimer > 0) {
            hurtTimer = Math.max(0, hurtTimer - dt);
        }
        if (invulnerableTimer > 0) {
            invulnerableTimer = Math.max(0, invulnerableTimer - dt);
        }

        const beat = STORY_BEATS[currentBeatIndex];

        if (isDinoMode) {
            idlePlayTimer += dt;

            // Steady, Gradual Linear Acceleration System:
            // Walk (38-48) -> Fast Walk (48-62) -> Faster Walk (62-78) ->
            // Run (78-110) -> Fast Run (110-150) -> Faster Run (150-205) -> Fastest Run (205-280)
            // Completely seamless progression without sudden jumps or exponential runaway bursts!
            const targetSpeed = 38 + Math.min(242, dinoScore * 0.055);
            currentSpeed += (targetSpeed - currentSpeed) * Math.min(1.0, dt * 2.5);

            let effectiveSpeed = currentSpeed;
            if (hurtTimer > 0) {
                effectiveSpeed = 0; // Pause forward movement while stumbling
            }

            if (hurtTimer <= 0) {
                // Steady score/distance accumulation: 20 points per second
                dinoScore += dt * 20;
                const currentFloor = Math.floor(dinoScore);
                if (currentFloor > catRunnerHighScore) {
                    catRunnerHighScore = currentFloor;
                    isNewHighScoreSession = true;
                    saveHighScore(catRunnerHighScore);
                }
            }

            // Inactivity timeout: If player abandoned game for 10 seconds, or tripped without tapping for 3.5s,
            // immediately exit mini-game and return to jumping text!
            const isAfkStumble = (hurtTimer > 0 && idlePlayTimer > 3.5);
            if (idlePlayTimer > 10.0 || isAfkStumble) {
                exitMiniGame();
                return;
            }

            if (effectiveSpeed > 0) {
                const distStep = effectiveSpeed * dt;
                catWorldX = (catWorldX + distStep) % WORLD_WIDTH;
            }
        } else if (countdownTimer > 0) {
            // Pre-Game Countdown (3, 2, 1, GO!)
            countdownTimer = Math.max(0, countdownTimer - dt);

            const sec = Math.ceil(countdownTimer);
            if (sec > 0 && sec !== lastBeepSec) {
                lastBeepSec = sec;
                playRetroCountdownBeep(false); // Beep on 2, 1
            }

            if (countdownTimer <= 0) {
                isDinoMode = true;
                catWorldX = CAT_SCREEN_X; // Aligns camera at 0
                dinoScore = 0;
                currentSpeed = 38;
                hurtTimer = 0;
                invulnerableTimer = 1.2;
                idlePlayTimer = 0;
                hasAnnouncedSprint = false;
                goBannerTimer = 0.7; // Flash 'GO!'
                playRetroCountdownBeep(true); // Bright chime!
            }
        } else if (hurtTimer > 0) {
            // Stumble period after hit: wait up to 3.5s for restart tap
            idlePlayTimer += dt;
            if (idlePlayTimer > 3.5) {
                exitMiniGame();
                return;
            }
        } else {
            exitMiniGame();
            return;
        }

        if (goBannerTimer > 0) {
            goBannerTimer = Math.max(0, goBannerTimer - dt);
        }

        const cameraX = isDinoMode ? (catWorldX - CAT_SCREEN_X) : 0;

        // Calculate current cat height from user jump
        let activeJumpHeight = 0;
        let isJumping = false;

        if (userJumpTimer > 0) {
            const maxT = currentMaxJumpTime || 0.88;
            const phase = (maxT - userJumpTimer) / maxT; // 0 -> 1
            activeJumpHeight = Math.sin(phase * Math.PI) * 15.5; // High, floaty, satisfying arc!
            isJumping = true;
        }

        const catClawsY = GROUND_Y - activeJumpHeight - 5;

        // 1. Cat Runner Obstacle Collision Detection (Cat Run Mode ONLY)
        if (isDinoMode && hurtTimer <= 0 && invulnerableTimer <= 0) {
            WORLD_OBSTACLES.forEach(obs => {
                const sx = worldToScreenX(obs.worldX, cameraX, 1.0);
                // Fair, generous arcade collision hitbox: core cactus stem vs paws
                const obsLeft = sx + 2;
                const obsRight = sx + obs.width - 2;
                const catLeft = CAT_SCREEN_X + 17;
                const catRight = CAT_SCREEN_X + 23;

                if (obsRight >= catLeft && obsLeft <= catRight) {
                    // Vertical collision: paws must clear cactus with 2px forgiving margin
                    if (activeJumpHeight < obs.height - 2) {
                        // CRASH / DEAD: Stop running, stumble for 1.4s (keep score visible!)
                        hurtTimer = 1.4; // Cat stumbles for 1.4s
                        currentSpeed = 38; // Speed reset to starting walk speed!
                        isDinoMode = false; // Run ends
                        catWorldX = CAT_SCREEN_X; // Reset world camera back to start
                        userJumpTimer = 0;
                        invulnerableTimer = 0;
                        hasAnnouncedSprint = false;
                        playRetroHurtSound();

                        popNotifications.push({
                            text: '✦ OUCH! ✦',
                            x: CAT_SCREEN_X + 20,
                            y: GROUND_Y - 16,
                            life: 1.0,
                            maxLife: 1.0
                        });
                    }
                }
            });
        }

        // 2. Balloon Collision Detection (Dino Run Mode ONLY)
        if (isDinoMode) {
            WORLD_BALLOONS.forEach(b => {
                if (b.popped) {
                    b.popTimer += dt;
                    if (b.popTimer > 3.5) {
                        b.popped = false;
                        b.popTimer = 0;
                    }
                } else {
                    const sx = worldToScreenX(b.worldX, cameraX, 1.0);
                    const bobY = b.baseY + Math.sin(movieTime * 3 + b.worldX) * 1.5;

                    // Check collision if cat is jumping
                    if (isJumping && sx >= -10 && sx <= currentLogicalWidth + 10) {
                        const catCenterScreenX = CAT_SCREEN_X + 20;
                        const balloonCenterScreenX = sx + 3;
                        const hDist = Math.abs(catCenterScreenX - balloonCenterScreenX);

                        if (hDist < 20) {
                            if (catClawsY <= bobY + 12 && catClawsY >= bobY - 6) {
                                b.popped = true;
                                b.popTimer = 0;
                                justPoppedTimer = 0.35;
                                dinoScore += 100;
                                const currentFloor = Math.floor(dinoScore);
                                if (currentFloor > catRunnerHighScore) {
                                    catRunnerHighScore = currentFloor;
                                    isNewHighScoreSession = true;
                                    saveHighScore(catRunnerHighScore);
                                }
                                popBalloon(sx + 3, bobY + 3, b.color, isUserJump);
                            }
                        }
                    }
                }
            });
        }

        // Confetti Particles Physics
        for (let i = confettiParticles.length - 1; i >= 0; i--) {
            const p = confettiParticles[i];
            p.life -= dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 34 * dt; // Gravity

            if (p.life <= 0 || p.y > GROUND_Y + 4) {
                confettiParticles.splice(i, 1);
            }
        }

        // Pop Text Notifications Floating
        for (let i = popNotifications.length - 1; i >= 0; i--) {
            const n = popNotifications[i];
            n.life -= dt;
            n.y -= 2.5 * dt; // Drifts gently without flying off screen
            if (n.life <= 0) {
                popNotifications.splice(i, 1);
            }
        }
    }

    // ------------------------------------------------------------------------
    // 14. Main Render Pipeline
    // ------------------------------------------------------------------------
    function render(dt) {
        if (!ctx) return;

        // Auto-fit to row width dynamically
        resizeCanvasToContainer();

        movieTime += dt;
        updateJourney(dt);

        const cameraX = isDinoMode ? (catWorldX - CAT_SCREEN_X) : 0;

        // 1. Transparent Canvas (Clean minimalist aesthetic - zero background clutter)
        ctx.clearRect(0, 0, currentLogicalWidth, CANVAS_HEIGHT);

        // 2. World Balloons (Drifting in Dino Mode only)
        if (isDinoMode) {
            WORLD_BALLOONS.forEach(b => {
                if (!b.popped) {
                    const sx = worldToScreenX(b.worldX, cameraX, 1.0);
                    if (sx >= -20 && sx <= currentLogicalWidth + 20) {
                        const bobY = b.baseY + Math.sin(movieTime * 3 + b.worldX) * 1.5;
                        const sway = Math.sin(movieTime * 2.5 + b.worldX) * 1.2;
                        drawPixelBalloon(ctx, sx, bobY, b.color, b.highlight, sway);
                    }
                }
            });
        }

        // 3. Continuous Ground (Static baseline in Normal Mode, scrolling texture in Player Mode)
        drawContinuousGround(ctx, cameraX, currentLogicalWidth, GROUND_Y);

        // 4. Dino Ground Obstacles (Drawn ONLY when Dino Mode is active!)
        if (isDinoMode) {
            WORLD_OBSTACLES.forEach(obs => {
                const sx = worldToScreenX(obs.worldX, cameraX, 1.0);
                if (sx >= -15 && sx <= currentLogicalWidth + 15) {
                    drawObstacle(ctx, obs, sx);
                }
            });
        }

        // 5. Confetti Burst Particles
        confettiParticles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        });

        // 6. Pop Text Notifications (Vibrant Yellow Pop Badge)
        popNotifications.forEach(n => {
            drawSpeechBubble(ctx, n.text, n.x, n.y, true);
        });

        // 7. Cat Animation & Action Handler
        if (hurtTimer > 0) {
            // A. HURT / CRASH STATE (Cat tripped on obstacle - distance reset to 0!)
            const catDrawY = CAT_BASE_Y;
            const frameIndex = Math.min(3, Math.floor((1.4 - hurtTimer) * 4));
            drawCatSprite(ctx, 'hurt', frameIndex, CAT_SCREEN_X - 2, catDrawY, true, CAT_DEST_W, CAT_DEST_H);

            // Comic dizzy stars circling above head
            const starAngle = movieTime * 9;
            const sX1 = CAT_SCREEN_X + 18 + Math.cos(starAngle) * 8;
            const sY1 = catDrawY - 4 + Math.sin(starAngle) * 3;
            const sX2 = CAT_SCREEN_X + 18 + Math.cos(starAngle + Math.PI) * 8;
            const sY2 = catDrawY - 4 + Math.sin(starAngle + Math.PI) * 3;
            ctx.fillStyle = '#fde047';
            ctx.fillRect(Math.round(sX1), Math.round(sY1), 2, 2);
            ctx.fillStyle = '#fda4af';
            ctx.fillRect(Math.round(sX2), Math.round(sY2), 2, 2);
        } else if (countdownTimer > 0) {
            // Pre-Game Countdown (Cat is standing ready at starting line)
            const catDrawY = CAT_BASE_Y;
            if (userJumpTimer > 0) {
                const phase = (0.95 - userJumpTimer) / 0.95;
                const jumpHeight = Math.sin(phase * Math.PI) * 12.0;
                drawCatSprite(ctx, 'jump', phase < 0.5 ? 0 : 2, CAT_SCREEN_X, catDrawY - Math.round(jumpHeight), true, CAT_DEST_W, CAT_DEST_H);
            } else {
                const frameIndex = Math.floor(movieTime * 6) % 8;
                drawCatSprite(ctx, 'idle', frameIndex, CAT_SCREEN_X, catDrawY, true, CAT_DEST_W, CAT_DEST_H);
            }
        } else if (isDinoMode) {
            const catDrawY = CAT_BASE_Y;

            if (invulnerableTimer > 0 && Math.floor(movieTime * 14) % 2 === 0) {
                // Retro blink during post-hurt invulnerability
            } else if (userJumpTimer > 0) {
                // C. PLAYER-TRIGGERED JUMP (Mini-game action!)
                const maxT = currentMaxJumpTime || 0.88;
                const phase = (maxT - userJumpTimer) / maxT; // 0 -> 1
                const jumpHeight = Math.sin(phase * Math.PI) * 15.5;

                // If a balloon was just hit, show ATTACK claw swipe at apex
                if (justPoppedTimer > 0 || (phase > 0.3 && phase < 0.7)) {
                    const attackFrame = Math.floor(phase * 8) % 8;
                    drawCatSprite(ctx, 'attack', attackFrame, CAT_SCREEN_X, catDrawY - Math.round(jumpHeight), true);

                    if (justPoppedTimer > 0) {
                        ctx.fillStyle = '#fde047';
                        ctx.fillRect(CAT_SCREEN_X + 34, catDrawY - Math.round(jumpHeight) + 6, 2, 2);
                    }
                } else if (phase < 0.3) {
                    // Rising leap frame (JUMP frame 0, or RUNNING_JUMP if running)
                    const jumpSprite = (currentSpeed >= 78) ? 'runningJump' : 'jump';
                    drawCatSprite(ctx, jumpSprite, 0, CAT_SCREEN_X, catDrawY - Math.round(jumpHeight), true);
                } else {
                    // Landing frame (JUMP frame 2, or RUNNING_JUMP if running)
                    const jumpSprite = (currentSpeed >= 78) ? 'runningJump' : 'jump';
                    drawCatSprite(ctx, jumpSprite, 2, CAT_SCREEN_X, catDrawY - Math.round(jumpHeight), true);
                }
            } else {
                // D. PLAYER RUNNER MODE:
                // Walk -> Fast Walk -> Faster Walk -> Run -> Fast Run -> Faster Run -> Fastest Run
                if (currentSpeed < 78) {
                    // STAGES 1, 2, 3: WALKING PHASES (WALK.png, 12 frames)
                    // Walk (38-48 px/s): ~7.5 - 9.8 fps (relaxed casual walk)
                    // Fast Walk (48-62 px/s): ~9.8 - 12.9 fps (brisk walking pace)
                    // Faster Walk (62-78 px/s): ~12.9 - 16.5 fps (rapid power walk stride)
                    const walkFps = 7.5 + ((currentSpeed - 38) / 40) * 9.0;
                    const frameIndex = Math.floor(movieTime * walkFps) % 12;
                    drawCatSprite(ctx, 'walk', frameIndex, CAT_SCREEN_X, catDrawY, true);

                    // Light dust puff when fast/faster walking
                    if (currentSpeed > 60) {
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                        ctx.fillRect(CAT_SCREEN_X - 2, GROUND_Y - 2, 2, 1);
                    }
                } else {
                    // STAGES 4, 5, 6, 7: RUNNING PHASES (RUN.png, 8 frames)
                    // Run (78-110 px/s): 11.5 - 14.4 fps (fluid jog/run)
                    // Fast Run (110-150 px/s): 14.4 - 18.1 fps (energetic fast run + double dust)
                    // Faster Run (150-205 px/s): 18.1 - 23.1 fps (blistering sprint + wind streaks)
                    // Fastest Run (205-280 px/s): 23.1 - 30.0 fps (hyper-speed sprint + friction sparks!)
                    const runFps = Math.min(30, 11.5 + ((currentSpeed - 78) / 202) * 18.5);
                    const frameIndex = Math.floor(movieTime * runFps) % 8;
                    drawCatSprite(ctx, 'run', frameIndex, CAT_SCREEN_X, catDrawY, true);

                    // Dynamic multi-tier dust & speed streaks based on velocity!
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
                    ctx.fillRect(CAT_SCREEN_X - 3, GROUND_Y - 3, 3, 1);

                    if (currentSpeed > 110) {
                        // Fast Run: secondary dust puff behind cat
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
                        ctx.fillRect(CAT_SCREEN_X - 8, GROUND_Y - 2, 4, 1);
                    }
                    if (currentSpeed > 150) {
                        // Faster Run: Wind speed streaks rushing past behind the cat
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
                        ctx.fillRect(CAT_SCREEN_X - 16, GROUND_Y - 14, 12, 1);
                        ctx.fillRect(CAT_SCREEN_X - 12, GROUND_Y - 7, 8, 1);
                    }
                    if (currentSpeed > 205) {
                        // Fastest Run: Golden friction sparks trailing the hyper-running paws!
                        ctx.fillStyle = '#fde047';
                        const sparkY = GROUND_Y - 3 - (Math.floor(movieTime * 30) % 4);
                        ctx.fillRect(CAT_SCREEN_X - 6, sparkY, 2, 2);
                        ctx.fillStyle = '#fb923c';
                        ctx.fillRect(CAT_SCREEN_X - 14, sparkY + 1, 2, 1);
                    }
                }
            }
        }

        // 8. Cat Runner Mode HUD (Top-Left: HI <highScore>  ★ <sessionScore>)
        if (isDinoMode || hurtTimer > 0 || countdownTimer > 0) {
            const hiText = `HI ${catRunnerHighScore}`;
            const curScore = Math.floor(dinoScore);
            const curText = `★ ${curScore}`;

            ctx.save();
            ctx.font = 'bold 7px monospace';
            const hiW = ctx.measureText(hiText).width;
            const curW = ctx.measureText(curText).width;
            const padX = 4;
            const gap = 5;
            const boxW = Math.round(padX + hiW + gap + curW + padX);
            const boxH = 11;
            const boxX = 4;
            const boxY = 2;

            ctx.fillStyle = (currentSpeed > 220) ? 'rgba(30, 20, 10, 0.94)' : 'rgba(15, 23, 42, 0.90)';
            ctx.fillRect(boxX, boxY, boxW, boxH);

            if (isNewHighScoreSession) {
                // Flash/pulse gold border in real-time when surpassing high score!
                ctx.fillStyle = (Math.floor(movieTime * 8) % 2 === 0) ? '#fde047' : '#fbbf24';
                ctx.fillRect(boxX, boxY, boxW, 1);
                ctx.fillRect(boxX, boxY + boxH - 1, boxW, 1);
                ctx.fillRect(boxX, boxY, 1, boxH);
                ctx.fillRect(boxX + boxW - 1, boxY, 1, boxH);
            } else if (currentSpeed > 220) {
                // Golden danger glow border in hyper-speed mode!
                ctx.fillStyle = (Math.floor(movieTime * 10) % 2 === 0) ? '#fde047' : '#f97316';
                ctx.fillRect(boxX, boxY, boxW, 1);
                ctx.fillRect(boxX, boxY + boxH - 1, boxW, 1);
            } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
                ctx.fillRect(boxX, boxY, boxW, 1);
            }

            const textY = Math.round(boxY + boxH / 2);
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'left';

            // High score text: gold if beaten this run, sleek muted slate otherwise
            ctx.fillStyle = isNewHighScoreSession ? '#fde047' : '#94a3b8';
            ctx.fillText(hiText, boxX + padX, textY);

            // Session score text: vivid arcade gold
            ctx.fillStyle = (currentSpeed > 220 || isNewHighScoreSession) ? '#fef08a' : '#fde047';
            ctx.fillText(curText, Math.round(boxX + padX + hiW + gap), textY);
            ctx.restore();
        }

        // 9. Countdown Display (3, 2, 1) & GO! Notification Badge
        if (countdownTimer > 0) {
            const sec = Math.ceil(countdownTimer); // 3, 2, 1
            const cx = Math.round(currentLogicalWidth / 2);
            const cy = 13;

            ctx.save();
            ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
            ctx.fillRect(cx - 16, cy - 8, 32, 16);
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(cx - 16, cy - 8, 32, 1);
            ctx.fillRect(cx - 16, cy + 7, 32, 1);

            ctx.fillStyle = '#fde047';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${sec}`, cx, cy);
            ctx.restore();
        } else if (goBannerTimer > 0 && isDinoMode) {
            const cx = Math.round(currentLogicalWidth / 2);
            const cy = 13;

            ctx.save();
            ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
            ctx.fillRect(cx - 20, cy - 8, 40, 16);
            ctx.fillStyle = '#4ade80';
            ctx.fillRect(cx - 20, cy - 8, 40, 1);
            ctx.fillRect(cx - 20, cy + 7, 40, 1);

            ctx.fillStyle = '#4ade80';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('GO!', cx, cy);
            ctx.restore();
        }
    }

    // ------------------------------------------------------------------------
    // 15. Animation Loop & Resource Management
    // ------------------------------------------------------------------------
    function isDrawerOpen() {
        const drawer = document.getElementById('slidingInputView');
        if (!drawer) return false;
        return drawer.classList.contains('show') && drawer.style.display !== 'none';
    }

    function loop(timestamp) {
        if (!isRunning || !isVisible || !isDrawerOpen() || document.hidden) {
            stop();
            return;
        }

        if (!lastTime) lastTime = timestamp;
        const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
        lastTime = timestamp;

        render(dt);
        animationFrameId = requestAnimationFrame(loop);
    }

    // ------------------------------------------------------------------------
    // 16. Mount & Lifecycle Management
    // ------------------------------------------------------------------------
    let drawerObserver = null;

    function setupDrawerObserver() {
        if (drawerObserver) return;
        const drawer = document.getElementById('slidingInputView');
        if (!drawer) {
            setTimeout(setupDrawerObserver, 150);
            return;
        }

        const handleDrawerChange = () => {
            const open = isDrawerOpen();
            if (open) {
                if (isVisible) {
                    resizeCanvasToContainer();
                    start();
                }
            } else {
                exitMiniGame();
            }
        };

        drawerObserver = new MutationObserver(handleDrawerChange);
        drawerObserver.observe(drawer, {
            attributes: true,
            attributeFilter: ['class', 'style']
        });
    }

    function mount() {
        const box = document.querySelector('.jumping-text-box');
        if (!box) {
            setTimeout(mount, 100);
            return;
        }

        const jumpingTextContainer = document.querySelector('.jumping-text-container');
        const cvs = createMovieCanvas();

        if (!box.contains(cvs)) {
            box.appendChild(cvs);
        }

        const triggerBtn = document.getElementById('cat-runner-trigger-btn');
        if (triggerBtn && !triggerBtn.dataset.bound) {
            triggerBtn.dataset.bound = 'true';
            const handleTrigger = (e) => {
                e.preventDefault();
                e.stopPropagation();
                startMiniGame();
            };
            triggerBtn.addEventListener('click', handleTrigger);
            triggerBtn.addEventListener('touchstart', handleTrigger, { passive: false });
        }

        setupDrawerObserver();

        // Responsive ResizeObserver
        if (window.ResizeObserver && !resizeObserver) {
            resizeObserver = new ResizeObserver(() => {
                if (isVisible && isDrawerOpen()) resizeCanvasToContainer();
            });
            resizeObserver.observe(box);
        }
        window.addEventListener('resize', () => {
            if (isVisible && isDrawerOpen()) resizeCanvasToContainer();
        });

        // Always jumping text by default!
        cvs.style.display = 'none';
        if (jumpingTextContainer) jumpingTextContainer.style.display = '';
        if (triggerBtn) triggerBtn.style.display = '';
    }

    function start() {
        if (isRunning || !isVisible || !isDrawerOpen() || document.hidden) return;
        isRunning = true;
        lastTime = 0;
        animationFrameId = requestAnimationFrame(loop);
    }

    function stop() {
        isRunning = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    // ------------------------------------------------------------------------
    // 17. Public API (Zero Mutation of Existing CSS Stylesheets)
    // ------------------------------------------------------------------------
    window.CatRunner = {
        init: function () {
            mount();
        },

        start: function () {
            startMiniGame();
        },

        exit: function () {
            exitMiniGame();
        },

        isActive: function () {
            return isVisible && isRunning;
        },

        jump: function () {
            triggerUserJump();
        },

        getHighScore: function () {
            return catRunnerHighScore;
        },

        destroy: function () {
            exitMiniGame();
            if (resizeObserver) {
                resizeObserver.disconnect();
                resizeObserver = null;
            }
            window.removeEventListener('resize', resizeCanvasToContainer);
            if (canvas && canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
            canvas = null;
            ctx = null;
            console.log('[CatRunner] Cleaned up cleanly');
        }
    };

    // Backward compatibility alias for any existing code
    window.PixelMovie = window.CatRunner;

    // Battery & CPU Saver: Pause animation when screen is locked or tab is hidden
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            if (isRunning) stop();
        } else {
            if (isVisible && !isRunning) start();
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }

})();
