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
    // 4. Procedural Obstacles & Floating Balloons (Dino Run System)
    // ------------------------------------------------------------------------
    let activeObstacles = [];
    let activeBalloons = [];

    // Confetti particles when a balloon pops
    let confettiParticles = [];

    // Floating notifications (strictly for "✦ OUCH! ✦" when hitting an obstacle)
    let popNotifications = [];

    // Player Variable Jump Physics (Authentic Chrome Dino Parabolic Arc)
    let isJumping = false;
    let isHoldingJump = false;
    let jumpTime = 0;                  // Elapsed time of current jump in seconds
    let currentJumpDuration = 0.72;    // Tap: 0.72s, extends up to 0.84s on hold
    let currentJumpApexHeight = 11.0;  // Tap: 11.0px (easily clears 1 cactus), extends up to 14.2px on hold
    let catOffsetY = 0;                // 0 on ground, up to 14.2px at apex
    let jumpVy = 0;                    // Instantaneous vertical velocity in px/s
    let justPoppedTimer = 0;           // Claw slash spark effect when popping
    const START_SPEED = 48;            // 48 px/s starting speed (generous reaction time)

    // Dynamic Speed & Game States
    let currentSpeed = START_SPEED;    // Current running speed
    let isDinoMode = false;        // Active during run
    let isGameOver = false;        // True on collision (screen freeze + Game Over UI)
    let dinoScore = 0;             // Points earned in active run
    let invulnerableTimer = 0;     // Post-start grace period
    let idlePlayTimer = 0;         // Inactivity timer
    let milestoneFlashTimer = 0;   // Milestone flash every 100 points

    // Countdown State before Player Mode Starts (3, 2, 1, GO!)
    let countdownTimer = 0;        // > 0 when counting down (3.0 -> 0.0)
    let lastBeepSec = -1;          // Tracks 3, 2, 1 beeps
    let goBannerTimer = 0;         // > 0 when flashing 'GO!'

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

        // Distant Mountains, Sand Dunes & Skylines (Parallax factor 0.25 - ZERO GREEN TREES!)
        farLandmarks: [
            { type: 'mountain', worldX: 120, w: 70, h: 10, color: '#94a3b8' },
            { type: 'mountain', worldX: 280, w: 85, h: 12, color: '#64748b' },
            { type: 'dune', worldX: 520, w: 80, h: 8, color: '#fed7aa' },
            { type: 'dune', worldX: 720, w: 95, h: 9, color: '#fde68a' },
            { type: 'skyline', worldX: 950, w: 32, h: 12, color: '#475569' },
            { type: 'skyline', worldX: 1100, w: 40, h: 15, color: '#334155' },
            { type: 'skyline', worldX: 1270, w: 30, h: 12, color: '#1e293b' },
            { type: 'skyline', worldX: 1440, w: 34, h: 16, color: '#1e293b' }
        ],

        // Minimalist Ambient Features (ZERO GREEN TREES - Zero Cacti Camouflage!)
        items: [
            { type: 'rock', worldX: 180, w: 8, h: 3 },
            { type: 'rock', worldX: 450, w: 10, h: 4 },
            { type: 'rock', worldX: 720, w: 9, h: 4 },
            { type: 'antenna', worldX: 1230 },
            { type: 'skylight', worldX: 1350 }
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
    // 11. Minimalist Dino Background (Dynamic Sky & Distant Silhouettes - ZERO GREEN!)
    // ------------------------------------------------------------------------
    function drawDinoClouds(ctx, cameraX) {
        // High-altitude, gentle pixel clouds (Y: 2-5)
        const cloudPositions = [140, 420, 720, 1040, 1380];
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        cloudPositions.forEach(wx => {
            const sx = worldToScreenX(wx, cameraX, 0.15);
            if (sx >= -25 && sx <= currentLogicalWidth + 25) {
                ctx.fillRect(sx + 3, 3, 8, 1);
                ctx.fillRect(sx + 1, 4, 12, 1);
                ctx.fillRect(sx, 5, 14, 1);
            }
        });
    }

    function drawSimpleBackground(ctx, cameraX) {
        // 1. Dynamic atmospheric sky color cycle (daylight -> peach sunset -> starry night)
        ctx.fillStyle = getSkyColor(catWorldX);
        ctx.fillRect(0, 0, currentLogicalWidth, CANVAS_HEIGHT);

        const wx = ((catWorldX % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH;

        // 2. Celestial bodies (Sun, Sunset Sun, Crescent Moon, and Stars)
        // Morning/Daytime Sun (worldX: 0 - 500)
        const sunSx = worldToScreenX(160, cameraX, 0.05);
        if (sunSx >= -20 && sunSx <= currentLogicalWidth + 20) {
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(sunSx - 3, 3, 6, 6);
            ctx.fillStyle = '#fde047';
            ctx.fillRect(sunSx - 2, 4, 4, 4);
        }

        // Sunset Sun (worldX: 550 - 950)
        const sunsetSx = worldToScreenX(750, cameraX, 0.05);
        if (sunsetSx >= -20 && sunsetSx <= currentLogicalWidth + 20) {
            ctx.fillStyle = '#fb923c';
            ctx.fillRect(sunsetSx - 4, 4, 8, 8);
            ctx.fillStyle = '#ea580c';
            ctx.fillRect(sunsetSx - 3, 5, 6, 6);
        }

        // Crescent Moon (worldX: 1100 - 1600)
        const moonSx = worldToScreenX(1380, cameraX, 0.05);
        if (moonSx >= -20 && moonSx <= currentLogicalWidth + 20) {
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(moonSx - 2, 3, 5, 5);
            ctx.fillStyle = getSkyColor(1380);
            ctx.fillRect(moonSx - 1, 3, 3, 4);
        }

        // Twinkling stars in night sky
        if (wx >= 1050 && wx <= 1580) {
            ctx.fillStyle = '#ffffff';
            const starCoords = [
                { x: 30, y: 3 }, { x: 90, y: 6 }, { x: 150, y: 4 },
                { x: 220, y: 7 }, { x: 290, y: 3 }, { x: 350, y: 5 }
            ];
            starCoords.forEach((s, idx) => {
                if ((Math.floor(movieTime * 5) + idx) % 3 !== 0) {
                    ctx.fillRect(s.x, s.y, 1, 1);
                }
            });
        }

        // 3. High-altitude clouds (Parallax 0.15)
        drawDinoClouds(ctx, cameraX);

        // 4. Distant Silhouettes (Parallax 0.25 - ZERO GREEN TREES!)
        // Lavender-slate mountains, warm peach dunes, and evening skylines
        SCENERY.farLandmarks.forEach(lm => {
            const sx = worldToScreenX(lm.worldX, cameraX, 0.25);
            if (sx >= -100 && sx <= currentLogicalWidth + 100) {
                ctx.fillStyle = lm.color;
                if (lm.type === 'mountain') {
                    const hw = Math.round(lm.w / 2);
                    const topY = GROUND_Y - lm.h;
                    ctx.beginPath();
                    ctx.moveTo(sx - hw, GROUND_Y);
                    ctx.lineTo(sx, topY);
                    ctx.lineTo(sx + hw, GROUND_Y);
                    ctx.closePath();
                    ctx.fill();
                } else if (lm.type === 'dune') {
                    ctx.beginPath();
                    ctx.ellipse(sx, GROUND_Y, lm.w / 2, lm.h, 0, Math.PI, 0);
                    ctx.fill();
                } else if (lm.type === 'skyline') {
                    const blockY = GROUND_Y - lm.h;
                    ctx.fillRect(sx, blockY, lm.w, lm.h);
                    ctx.fillStyle = '#fef08a';
                    if (lm.w > 20) {
                        ctx.fillRect(sx + 4, blockY + 3, 2, 2);
                        ctx.fillRect(sx + lm.w - 6, blockY + 5, 2, 2);
                    }
                }
            }
        });
    }

    // ------------------------------------------------------------------------
    // 11b. Dino Obstacle Pixel Renderer (High Contrast Pixel Art Cacti)
    // ------------------------------------------------------------------------
    function drawSingleCactus(ctx, x, isTall) {
        const ox = Math.round(x);
        if (isTall) {
            // Tall cactus: 10px tall, ground baseline at GROUND_Y (35), top at 25
            // Ground soil base
            ctx.fillStyle = '#022c22';
            ctx.fillRect(ox - 1, GROUND_Y, 8, 1);

            // 1. Dark silhouette outline (ultra-high contrast on any background)
            ctx.fillStyle = '#022c22';
            ctx.fillRect(ox + 2, GROUND_Y - 10, 3, 10);
            ctx.fillRect(ox, GROUND_Y - 7, 3, 5);
            ctx.fillRect(ox + 4, GROUND_Y - 6, 3, 5);

            // 2. Vibrant emerald green body (high visibility)
            ctx.fillStyle = '#10b981';
            ctx.fillRect(ox + 2, GROUND_Y - 9, 2, 9);
            ctx.fillRect(ox + 1, GROUND_Y - 6, 1, 3);
            ctx.fillRect(ox + 4, GROUND_Y - 5, 1, 3);

            // 3. Crisp neon spine accents
            ctx.fillStyle = '#a7f3d0';
            ctx.fillRect(ox + 2, GROUND_Y - 8, 1, 2);
            ctx.fillRect(ox + 1, GROUND_Y - 6, 1, 1);
            ctx.fillRect(ox + 4, GROUND_Y - 5, 1, 1);
        } else {
            // Short cactus: 7px tall, ground baseline at GROUND_Y (35), top at 28
            // Ground soil base
            ctx.fillStyle = '#022c22';
            ctx.fillRect(ox - 1, GROUND_Y, 7, 1);

            // 1. Dark silhouette outline
            ctx.fillStyle = '#022c22';
            ctx.fillRect(ox + 1, GROUND_Y - 7, 3, 7);
            ctx.fillRect(ox, GROUND_Y - 5, 2, 4);
            ctx.fillRect(ox + 3, GROUND_Y - 4, 2, 3);

            // 2. Vibrant emerald green body
            ctx.fillStyle = '#059669';
            ctx.fillRect(ox + 1, GROUND_Y - 6, 2, 6);
            ctx.fillRect(ox, GROUND_Y - 4, 1, 2);
            ctx.fillRect(ox + 3, GROUND_Y - 3, 1, 2);

            // 3. Crisp neon spine accents
            ctx.fillStyle = '#6ee7b7';
            ctx.fillRect(ox + 1, GROUND_Y - 5, 1, 2);
            ctx.fillRect(ox, GROUND_Y - 4, 1, 1);
        }
    }

    function drawObstacle(ctx, obs, sx) {
        const ox = Math.round(sx);
        switch (obs.type) {
            case 'short_single':
                drawSingleCactus(ctx, ox, false);
                break;
            case 'tall_single':
                drawSingleCactus(ctx, ox, true);
                break;
            case 'short_double':
                drawSingleCactus(ctx, ox, false);
                drawSingleCactus(ctx, ox + 6, false);
                break;
            case 'tall_double':
                drawSingleCactus(ctx, ox, false);
                drawSingleCactus(ctx, ox + 6, true);
                break;
            case 'short_triple':
                drawSingleCactus(ctx, ox, false);
                drawSingleCactus(ctx, ox + 6, false);
                drawSingleCactus(ctx, ox + 12, false);
                break;
            case 'tall_triple':
                drawSingleCactus(ctx, ox, true);
                drawSingleCactus(ctx, ox + 7, false);
                drawSingleCactus(ctx, ox + 13, true);
                break;
            default:
                drawSingleCactus(ctx, ox, obs.height > 8);
                break;
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

        // Unified pointer handling for precise tap vs hold jump height
        canvas.addEventListener('mousedown', onPointerDown);
        canvas.addEventListener('touchstart', onPointerDown, { passive: false });
        window.addEventListener('mouseup', onPointerUp);
        window.addEventListener('touchend', onPointerUp, { passive: false });

        return canvas;
    }

    function getCanvasCoordinates(e) {
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        let clientX = e.clientX;
        let clientY = e.clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        }
        const scaleX = currentLogicalWidth / (rect.width || 1);
        const scaleY = CANVAS_HEIGHT / (rect.height || 1);
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    function onPointerDown(e) {
        if (e && e.cancelable) {
            e.preventDefault();
        }
        initAudio();

        const pos = getCanvasCoordinates(e);

        if (isGameOver) {
            // Game Over action buttons (Side-by-side centered below GAME OVER at y=22)
            const cx = Math.round(currentLogicalWidth / 2);
            // Replay Button bounds: [cx - 24, 22, 20, 12] with touch forgiveness
            // Exit Button bounds: [cx + 4, 22, 20, 12] with touch forgiveness
            if (pos.x >= cx + 2 && pos.x <= cx + 28 && pos.y >= 18 && pos.y <= 38) {
                // Clicked Exit button [✕]
                exitMiniGame();
                return;
            }
            if (pos.x >= cx - 28 && pos.x <= cx - 2 && pos.y >= 18 && pos.y <= 38) {
                // Clicked Replay button [↻]
                restartGame();
                return;
            }
            // Dino game style: tapping anywhere else on screen restarts
            restartGame();
            return;
        }

        if (countdownTimer > 0) {
            triggerPrepJump();
            return;
        }

        if (isDinoMode) {
            idlePlayTimer = 0;
            startJump();
        }

        const taskInput = document.getElementById('task');
        if (taskInput) {
            taskInput.value = '';
        }
    }

    function onPointerUp(e) {
        if (isDinoMode) {
            endJump();
        }
    }

    function startJump() {
        if (!isJumping && isDinoMode && !isGameOver) {
            isJumping = true;
            isHoldingJump = true;
            jumpTime = 0;
            currentJumpDuration = 0.48; // Base Short Jump duration (air travel = 23px: clears 1 cactus, fails on 3!)
            currentJumpApexHeight = 10.5; // Base Short Jump apex (clears 7px short cactus with 3.5px margin)
            jumpVy = (4 * 10.5) / 0.48;
            playRetroJumpSound();
        }
    }

    function endJump() {
        isHoldingJump = false;
    }

    function triggerPrepJump() {
        if (!isJumping) {
            isJumping = true;
            isHoldingJump = false;
            jumpTime = 0;
            currentJumpDuration = 0.50;
            currentJumpApexHeight = 9.5;
            jumpVy = (4 * 9.5) / 0.50;
            playRetroJumpSound();
        }
    }

    function spawnInitialTrack() {
        activeObstacles = [];
        activeBalloons = [];

        // Seed runway with classic Dino consecutive rhythm:
        // 1. First short single cactus (easy jump)
        activeObstacles.push({
            x: currentLogicalWidth + 40,
            type: 'short_single',
            width: 6,
            height: 7
        });
        // 2. Consecutive short cactus with tight Dino gap (88px later: "hop... land... hop!")
        activeObstacles.push({
            x: currentLogicalWidth + 128,
            type: 'short_single',
            width: 6,
            height: 7
        });
        // 3. Floating balloon right after the consecutive pair
        activeBalloons.push({
            id: 'b_init1',
            x: currentLogicalWidth + 195,
            baseY: 11,
            color: '#38bdf8',
            highlight: '#bae6fd',
            seed: 1.2
        });
        // 4. Tall single cactus after a breath gap
        activeObstacles.push({
            x: currentLogicalWidth + 280,
            type: 'tall_single',
            width: 7,
            height: 10
        });
        activeBalloons.push({
            id: 'b_init2',
            x: currentLogicalWidth + 345,
            baseY: 10,
            color: '#f43f5e',
            highlight: '#fda4af',
            seed: 3.4
        });
    }

    // ------------------------------------------------------------------------
    // 12b. Cat Runner Mini-Game Lifecycle (Start, Restart & Exit)
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
        isGameOver = false;
        dinoScore = 0;
        currentSpeed = START_SPEED;
        catWorldX = CAT_SCREEN_X;
        countdownTimer = 3.0;
        lastBeepSec = 3;
        goBannerTimer = 0;
        idlePlayTimer = 0;
        invulnerableTimer = 0;
        catOffsetY = 0;
        jumpVy = 0;
        jumpTime = 0;
        currentJumpDuration = 0.72;
        currentJumpApexHeight = 11.0;
        isJumping = false;
        isHoldingJump = false;
        confettiParticles = [];
        popNotifications = [];

        spawnInitialTrack();
        playRetroCountdownBeep(false); // First countdown beep for '3'
        start();
    }

    function restartGame() {
        initAudio();
        catRunnerHighScore = getSavedHighScore();
        isNewHighScoreSession = false;

        isVisible = true;
        isDinoMode = true;
        isGameOver = false;
        dinoScore = 0;
        currentSpeed = START_SPEED;
        catWorldX = CAT_SCREEN_X;
        countdownTimer = 0;
        goBannerTimer = 0.5;
        idlePlayTimer = 0;
        invulnerableTimer = 1.0;
        catOffsetY = 0;
        jumpVy = 0;
        jumpTime = 0;
        currentJumpDuration = 0.72;
        currentJumpApexHeight = 11.0;
        isJumping = false;
        isHoldingJump = false;
        confettiParticles = [];
        popNotifications = [];

        spawnInitialTrack();
        playRetroCountdownBeep(true); // Bright chirp on restart!
        start();
    }

    function exitMiniGame() {
        isVisible = false;
        isDinoMode = false;
        isGameOver = false;
        countdownTimer = 0;
        goBannerTimer = 0;
        isJumping = false;
        isHoldingJump = false;
        catOffsetY = 0;
        jumpVy = 0;
        jumpTime = 0;
        dinoScore = 0;
        currentSpeed = START_SPEED;
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
        if (isGameOver) {
            // Frozen state on GAME OVER — no movement, no score accumulation
            return;
        }

        if (justPoppedTimer > 0) {
            justPoppedTimer = Math.max(0, justPoppedTimer - dt);
        }
        if (milestoneFlashTimer > 0) {
            milestoneFlashTimer = Math.max(0, milestoneFlashTimer - dt);
        }
        if (invulnerableTimer > 0) {
            invulnerableTimer = Math.max(0, invulnerableTimer - dt);
        }

        if (isDinoMode) {
            idlePlayTimer += dt;

            // Steady, Gradual Linear Acceleration System:
            const targetSpeed = START_SPEED + Math.min(130, dinoScore * 0.045);
            currentSpeed += (targetSpeed - currentSpeed) * Math.min(1.0, dt * 2.5);

            // Steady score/distance accumulation: 20 points per second
            dinoScore += dt * 20;
            const currentFloor = Math.floor(dinoScore);
            if (currentFloor > catRunnerHighScore) {
                catRunnerHighScore = currentFloor;
                isNewHighScoreSession = true;
                saveHighScore(catRunnerHighScore);
            }

            // Milestone flash trigger every 100 points
            if (Math.floor(dinoScore / 100) > Math.floor((dinoScore - dt * 20) / 100)) {
                milestoneFlashTimer = 0.5;
            }

            // Continuous background world loop sync
            catWorldX = (catWorldX + currentSpeed * dt) % WORLD_WIDTH;

            // 1. Variable Jump Physics (Authentic Chrome Dino Parabolic Arc)
            // Short Jump: Tap -> 0.48s, 10.5px apex, air travel 23px (clears 1 cactus, fails on 3!)
            // Long Jump: Hold -> 0.82s, 14.5px apex, air travel 39.4px (cleanly sails over all 3 cacti!)
            if (isJumping) {
                jumpTime += dt;

                // When jump is held, smoothly extend towards full Long Jump
                if (isHoldingJump && jumpTime < 0.20) {
                    currentJumpApexHeight = Math.min(14.5, currentJumpApexHeight + dt * (14.5 - 10.5) / 0.15);
                    currentJumpDuration = Math.min(0.82, currentJumpDuration + dt * (0.82 - 0.48) / 0.15);
                }

                const progress = jumpTime / currentJumpDuration;
                if (progress >= 1.0) {
                    catOffsetY = 0;
                    jumpVy = 0;
                    isJumping = false;
                    isHoldingJump = false;
                    jumpTime = 0;
                } else {
                    catOffsetY = 4 * currentJumpApexHeight * progress * (1 - progress);
                    jumpVy = (4 * currentJumpApexHeight * (1 - 2 * progress)) / currentJumpDuration;
                }
            }

            // 2. Procedural Obstacles Movement & Spawning (Authentic Dino Consecutive Cacti)
            for (let i = activeObstacles.length - 1; i >= 0; i--) {
                activeObstacles[i].x -= currentSpeed * dt;
                if (activeObstacles[i].x + activeObstacles[i].width < -25) {
                    activeObstacles.splice(i, 1);
                }
            }

            let lastObsX = 0;
            let lastObsType = 'short_single';
            if (activeObstacles.length > 0) {
                const last = activeObstacles[activeObstacles.length - 1];
                lastObsX = last.x + last.width;
                lastObsType = last.type;
            }
            if (lastObsX < currentLogicalWidth + 60) {
                const speedFactor = currentSpeed / START_SPEED;
                const isPreviousTriple = (lastObsType === 'short_triple' || lastObsType === 'tall_triple');
                const roll = Math.random();

                let baseGap;
                let isConsecutive = false;

                if (!isPreviousTriple && roll < 0.38) {
                    // 1. TIGHT CONSECUTIVE SEQUENCE! (Rapid "hop... land... hop!" tempo)
                    // 78px - 104px gap gives ~1.6s - 2.1s reaction time
                    baseGap = 78 + Math.random() * 26;
                    isConsecutive = true;
                } else if (roll < 0.76) {
                    // 2. MEDIUM GAP (Standard pacing)
                    baseGap = 118 + Math.random() * 38;
                } else {
                    // 3. SPACIOUS GAP (Breathing room & ideal for floating balloons)
                    baseGap = 175 + Math.random() * 55;
                }

                const calculatedGap = Math.round(baseGap * speedFactor);
                const nextX = Math.max(currentLogicalWidth + 20, lastObsX + calculatedGap);

                // Progressive difficulty selection:
                const availableTypes = ['short_single'];
                if (dinoScore >= 80) {
                    availableTypes.push('tall_single');
                }
                // If tight consecutive gap, prefer single cacti so the rapid hop rhythm is fair & exciting
                if (!isConsecutive) {
                    if (dinoScore >= 200) {
                        availableTypes.push('short_double');
                    }
                    if (dinoScore >= 400) {
                        availableTypes.push('tall_double');
                    }
                    if (dinoScore >= 600) {
                        availableTypes.push('short_triple');
                    }
                    if (dinoScore >= 850) {
                        availableTypes.push('tall_triple');
                    }
                }
                const chosenType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
                let w = 6;
                let h = 7;
                if (chosenType === 'tall_single') { w = 7; h = 10; }
                else if (chosenType === 'short_double') { w = 13; h = 7; }
                else if (chosenType === 'tall_double') { w = 14; h = 10; }
                else if (chosenType === 'short_triple') { w = 19; h = 7; }
                else if (chosenType === 'tall_triple') { w = 21; h = 10; }

                activeObstacles.push({
                    x: nextX,
                    type: chosenType,
                    width: w,
                    height: h
                });
            }

            // 3. Procedural Floating Balloons Movement & Spawning
            for (let i = activeBalloons.length - 1; i >= 0; i--) {
                activeBalloons[i].x -= currentSpeed * dt;
                if (activeBalloons[i].x < -20) {
                    activeBalloons.splice(i, 1);
                }
            }

            let lastBalloonX = 0;
            if (activeBalloons.length > 0) {
                lastBalloonX = activeBalloons[activeBalloons.length - 1].x;
            }
            if (lastBalloonX < currentLogicalWidth + 40 && activeBalloons.length < 3) {
                const balloonGap = 160 + Math.random() * 110;
                const bSpawnX = Math.max(currentLogicalWidth + 25, lastBalloonX + balloonGap);
                const rainbow = [
                    { color: '#f43f5e', highlight: '#fda4af' },
                    { color: '#0ea5e9', highlight: '#7dd3fc' },
                    { color: '#ec4899', highlight: '#fbcfe8' },
                    { color: '#22c55e', highlight: '#bbf7d0' },
                    { color: '#a855f7', highlight: '#d8b4fe' },
                    { color: '#fbbf24', highlight: '#fde68a' }
                ];
                const c = rainbow[Math.floor(Math.random() * rainbow.length)];
                activeBalloons.push({
                    id: 'b_' + Math.random(),
                    x: bSpawnX,
                    baseY: 9 + Math.random() * 4,
                    color: c.color,
                    highlight: c.highlight,
                    seed: Math.random() * 10
                });
            }

            // 4. Cat Obstacle Collision Detection (Dino Run Mode)
            if (invulnerableTimer <= 0) {
                // Cat paws hitbox: 6px wide (under the cat's belly)
                const catLeft = CAT_SCREEN_X + 17;
                const catRight = CAT_SCREEN_X + 23;
                const catFeetY = GROUND_Y - catOffsetY;

                for (let i = 0; i < activeObstacles.length; i++) {
                    const obs = activeObstacles[i];
                    // 2px horizontal forgiveness inset on cactus edges
                    const obsLeft = obs.x + 2;
                    const obsRight = obs.x + obs.width - 2;
                    const obsTop = GROUND_Y - obs.height;

                    if (obsRight >= catLeft && obsLeft <= catRight) {
                        // Vertical clearance check with 2.0px forgiving buffer
                        if (catFeetY > obsTop + 2.0) {
                            // COLLISION / GAME OVER: Screen freezes, Game Over UI displays!
                            isGameOver = true;
                            isDinoMode = false;
                            currentSpeed = 0;
                            isJumping = false;
                            isHoldingJump = false;
                            catOffsetY = 0;
                            jumpVy = 0;
                            jumpTime = 0;
                            playRetroHurtSound();

                            popNotifications.push({
                                text: '✦ OUCH! ✦',
                                x: CAT_SCREEN_X + 20,
                                y: GROUND_Y - 16,
                                life: 1.2,
                                maxLife: 1.2
                            });
                            break;
                        }
                    }
                }
            }

            // 5. Balloon Collision Detection (Dino Run Mode)
            if (!isGameOver) {
                const catCenterScreenX = CAT_SCREEN_X + 20;
                const catClawsY = GROUND_Y - catOffsetY - 5;

                for (let i = activeBalloons.length - 1; i >= 0; i--) {
                    const b = activeBalloons[i];
                    const bobY = b.baseY + Math.sin(movieTime * 3 + b.seed) * 1.5;
                    const balloonCenterX = b.x + 3;
                    const hDist = Math.abs(catCenterScreenX - balloonCenterX);

                    if (isJumping && hDist < 16) {
                        if (catClawsY <= bobY + 13 && catClawsY >= bobY - 7) {
                            popBalloon(b.x + 3, bobY + 3, b.color, true);
                            justPoppedTimer = 0.35;
                            dinoScore += 100;
                            milestoneFlashTimer = 0.4;
                            const curFloor = Math.floor(dinoScore);
                            if (curFloor > catRunnerHighScore) {
                                catRunnerHighScore = curFloor;
                                isNewHighScoreSession = true;
                                saveHighScore(catRunnerHighScore);
                            }
                            activeBalloons.splice(i, 1);
                        }
                    }
                }
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
                catWorldX = CAT_SCREEN_X;
                dinoScore = 0;
                currentSpeed = START_SPEED;
                invulnerableTimer = 1.0;
                idlePlayTimer = 0;
                catOffsetY = 0;
                jumpVy = 0;
                jumpTime = 0;
                goBannerTimer = 0.7; // Flash 'GO!'
                playRetroCountdownBeep(true); // Bright chime!
            }

            // Gentle hop during countdown
            if (isJumping) {
                jumpTime += dt;
                const progress = jumpTime / currentJumpDuration;
                if (progress >= 1.0) {
                    catOffsetY = 0;
                    jumpVy = 0;
                    isJumping = false;
                    jumpTime = 0;
                } else {
                    catOffsetY = 4 * currentJumpApexHeight * progress * (1 - progress);
                    jumpVy = (4 * currentJumpApexHeight * (1 - 2 * progress)) / currentJumpDuration;
                }
            }
        } else {
            exitMiniGame();
            return;
        }

        if (goBannerTimer > 0) {
            goBannerTimer = Math.max(0, goBannerTimer - dt);
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
            n.y -= 2.5 * dt;
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

        // 1. Simple Ambient Background (Dynamic Sky, Celestial Orbs, Distant Silhouettes - ZERO GREEN TREES!)
        drawSimpleBackground(ctx, cameraX);

        // 3. Floating Balloons (Procedurally spawned in Dino Mode & Game Over)
        if (isDinoMode || isGameOver) {
            activeBalloons.forEach(b => {
                const sx = Math.round(b.x);
                if (sx >= -20 && sx <= currentLogicalWidth + 20) {
                    const bobY = b.baseY + Math.sin(movieTime * 3 + b.seed) * 1.5;
                    const sway = Math.sin(movieTime * 2.5 + b.seed) * 1.2;
                    drawPixelBalloon(ctx, sx, bobY, b.color, b.highlight, sway);
                }
            });
        }

        // 4. Continuous Ground (1px baseline)
        drawContinuousGround(ctx, cameraX, currentLogicalWidth, GROUND_Y);

        // 5. Procedural Dino Obstacles (Cactus Variety)
        if (isDinoMode || isGameOver) {
            activeObstacles.forEach(obs => {
                if (obs.x >= -25 && obs.x <= currentLogicalWidth + 25) {
                    drawObstacle(ctx, obs, obs.x);
                }
            });
        }

        // 6. Confetti Burst Particles
        confettiParticles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        });

        // 7. Pop Text Notifications (Vibrant Yellow Pop Badge)
        popNotifications.forEach(n => {
            drawSpeechBubble(ctx, n.text, n.x, n.y, true);
        });

        // 8. Cat Animation & Action Handler
        if (isGameOver) {
            // A. GAME OVER HURT STATE
            const catDrawY = CAT_BASE_Y;
            drawCatSprite(ctx, 'hurt', 0, CAT_SCREEN_X - 2, catDrawY, true, CAT_DEST_W, CAT_DEST_H);

            // Comic dizzy stars circling above cat head
            const starAngle = movieTime * 8;
            const sX1 = CAT_SCREEN_X + 18 + Math.cos(starAngle) * 8;
            const sY1 = catDrawY - 4 + Math.sin(starAngle) * 3;
            const sX2 = CAT_SCREEN_X + 18 + Math.cos(starAngle + Math.PI) * 8;
            const sY2 = catDrawY - 4 + Math.sin(starAngle + Math.PI) * 3;
            ctx.fillStyle = '#fde047';
            ctx.fillRect(Math.round(sX1), Math.round(sY1), 2, 2);
            ctx.fillStyle = '#fda4af';
            ctx.fillRect(Math.round(sX2), Math.round(sY2), 2, 2);
        } else if (countdownTimer > 0) {
            // B. COUNTDOWN STATE
            const catDrawY = CAT_BASE_Y - Math.round(catOffsetY);
            if (isJumping) {
                drawCatSprite(ctx, 'jump', jumpVy > 0 ? 0 : 2, CAT_SCREEN_X, catDrawY, true, CAT_DEST_W, CAT_DEST_H);
            } else {
                const frameIndex = Math.floor(movieTime * 6) % 8;
                drawCatSprite(ctx, 'idle', frameIndex, CAT_SCREEN_X, catDrawY, true, CAT_DEST_W, CAT_DEST_H);
            }
        } else if (isDinoMode) {
            const catDrawY = CAT_BASE_Y - Math.round(catOffsetY);

            if (invulnerableTimer > 0 && Math.floor(movieTime * 14) % 2 === 0) {
                // Post-start grace period blink
            } else if (isJumping) {
                // C. VARIABLE JUMP STATE (In Air)
                if (justPoppedTimer > 0) {
                    const attackFrame = Math.floor(movieTime * 16) % 8;
                    drawCatSprite(ctx, 'attack', attackFrame, CAT_SCREEN_X, catDrawY, true);
                    ctx.fillStyle = '#fde047';
                    ctx.fillRect(CAT_SCREEN_X + 34, catDrawY + 6, 2, 2);
                } else if (jumpVy > 0) {
                    const jumpSprite = (currentSpeed >= 78) ? 'runningJump' : 'jump';
                    drawCatSprite(ctx, jumpSprite, 0, CAT_SCREEN_X, catDrawY, true);
                } else {
                    const jumpSprite = (currentSpeed >= 78) ? 'runningJump' : 'jump';
                    drawCatSprite(ctx, jumpSprite, 2, CAT_SCREEN_X, catDrawY, true);
                }
            } else {
                // D. RUNNER MODE (On Ground)
                if (currentSpeed < 78) {
                    const walkFps = 7.5 + ((currentSpeed - 38) / 40) * 9.0;
                    const frameIndex = Math.floor(movieTime * walkFps) % 12;
                    drawCatSprite(ctx, 'walk', frameIndex, CAT_SCREEN_X, catDrawY, true);
                    if (currentSpeed > 60) {
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                        ctx.fillRect(CAT_SCREEN_X - 2, GROUND_Y - 2, 2, 1);
                    }
                } else {
                    const runFps = Math.min(30, 11.5 + ((currentSpeed - 78) / 202) * 18.5);
                    const frameIndex = Math.floor(movieTime * runFps) % 8;
                    drawCatSprite(ctx, 'run', frameIndex, CAT_SCREEN_X, catDrawY, true);

                    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
                    ctx.fillRect(CAT_SCREEN_X - 3, GROUND_Y - 3, 3, 1);

                    if (currentSpeed > 110) {
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
                        ctx.fillRect(CAT_SCREEN_X - 8, GROUND_Y - 2, 4, 1);
                    }
                    if (currentSpeed > 150) {
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
                        ctx.fillRect(CAT_SCREEN_X - 16, GROUND_Y - 14, 12, 1);
                        ctx.fillRect(CAT_SCREEN_X - 12, GROUND_Y - 7, 8, 1);
                    }
                    if (currentSpeed > 205) {
                        ctx.fillStyle = '#fde047';
                        const sparkY = GROUND_Y - 3 - (Math.floor(movieTime * 30) % 4);
                        ctx.fillRect(CAT_SCREEN_X - 6, sparkY, 2, 2);
                        ctx.fillStyle = '#fb923c';
                        ctx.fillRect(CAT_SCREEN_X - 14, sparkY + 1, 2, 1);
                    }
                }
            }
        }

        // 9. Retro Score HUD (Chrome Dino Style at Top-Right: HI 00000  00000)
        // Zero container box! Ultra-readable 9px sans-serif typography with razor-sharp 1px contrast outline
        if (isDinoMode || isGameOver || countdownTimer > 0) {
            const hiPadded = String(Math.min(99999, Math.floor(catRunnerHighScore))).padStart(5, '0');
            const curPadded = String(Math.min(99999, Math.floor(dinoScore))).padStart(5, '0');

            ctx.save();
            ctx.font = 'bold 9px "Roboto", Arial, -apple-system, sans-serif';
            ctx.textBaseline = 'top';

            const hiText = `HI ${hiPadded}`;
            const curText = curPadded;

            const hiW = ctx.measureText(hiText).width;
            const curW = ctx.measureText(curText).width;
            const gap = 8;
            const totalContentW = hiW + gap + curW;

            const hudRight = currentLogicalWidth - 8;
            const hudY = 3;
            const startX = Math.round(hudRight - totalContentW);

            const hiColor = isNewHighScoreSession ? '#fde047' : '#cbd5e1';
            const curScoreColor = (milestoneFlashTimer > 0 && Math.floor(movieTime * 12) % 2 === 0)
                ? '#fde047'
                : '#ffffff';

            // 1. Razor-sharp subtle dark outline (Guarantees 100% readability without any container box!)
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            ctx.strokeText(hiText, startX, hudY);
            ctx.strokeText(curText, startX + hiW + gap, hudY);

            // 2. High score with HI label
            ctx.fillStyle = hiColor;
            ctx.fillText(hiText, startX, hudY);

            // 3. Current score
            ctx.fillStyle = curScoreColor;
            ctx.fillText(curText, startX + hiW + gap, hudY);

            ctx.restore();
        }

        // 10. Countdown Display (3, 2, 1) & GO! Notification Badge
        if (countdownTimer > 0) {
            const sec = Math.ceil(countdownTimer);
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

        // 11. Authentic Game Over Screen with Centered Side-by-Side Action Buttons
        if (isGameOver) {
            // High-contrast overlay to focus attention
            ctx.fillStyle = 'rgba(15, 23, 42, 0.74)';
            ctx.fillRect(0, 0, currentLogicalWidth, CANVAS_HEIGHT);

            const cx = Math.round(currentLogicalWidth / 2);

            // A. GAME OVER text centered at Y = 11
            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 8px monospace, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('G A M E   O V E R', cx, 11);
            ctx.restore();

            // B. Replay [↻] and Exit [✕] Buttons side by side centered below text at Y = 22
            const bw = 20;
            const bh = 12;
            const by = 22;
            const rx = cx - 24; // Replay button X
            const ex = cx + 4;  // Exit button X

            // --- Replay Button [↻] ---
            ctx.save();
            ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
            ctx.fillRect(rx, by, bw, bh);
            ctx.strokeStyle = '#4ade80';
            ctx.lineWidth = 1;
            ctx.strokeRect(rx + 0.5, by + 0.5, bw - 1, bh - 1);

            // Circular restart arrow pixel icon
            const rcx = rx + Math.round(bw / 2);
            const rcy = by + Math.round(bh / 2);
            ctx.fillStyle = '#4ade80';
            ctx.fillRect(rcx - 3, rcy - 3, 6, 1);
            ctx.fillRect(rcx - 4, rcy - 2, 1, 4);
            ctx.fillRect(rcx - 3, rcy + 2, 6, 1);
            ctx.fillRect(rcx + 3, rcy - 1, 1, 3);
            ctx.fillRect(rcx + 1, rcy - 4, 1, 3);
            ctx.fillRect(rcx + 2, rcy - 3, 1, 1);
            ctx.restore();

            // --- Exit Button [✕] ---
            ctx.save();
            ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
            ctx.fillRect(ex, by, bw, bh);
            ctx.strokeStyle = '#f87171';
            ctx.lineWidth = 1;
            ctx.strokeRect(ex + 0.5, by + 0.5, bw - 1, bh - 1);

            // Pixel cross icon ✕
            const ecx = ex + Math.round(bw / 2);
            const ecy = by + Math.round(bh / 2);
            ctx.fillStyle = '#f87171';
            ctx.fillRect(ecx - 3, ecy - 3, 2, 2);
            ctx.fillRect(ecx + 2, ecy - 3, 2, 2);
            ctx.fillRect(ecx - 1, ecy - 1, 3, 3);
            ctx.fillRect(ecx - 3, ecy + 2, 2, 2);
            ctx.fillRect(ecx + 2, ecy + 2, 2, 2);
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

    function onKeyDown(e) {
        if (!isVisible) return;
        if (e.code === 'Space' || e.key === ' ' || e.code === 'ArrowUp' || e.key === 'ArrowUp') {
            e.preventDefault();
            initAudio();
            if (isGameOver) {
                restartGame();
            } else if (countdownTimer > 0) {
                triggerPrepJump();
            } else if (isDinoMode) {
                startJump();
            }
        } else if (e.code === 'Escape' || e.key === 'Escape') {
            e.preventDefault();
            exitMiniGame();
        }
    }

    function onKeyUp(e) {
        if (!isVisible) return;
        if (e.code === 'Space' || e.key === ' ' || e.code === 'ArrowUp' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (isDinoMode) {
                endJump();
            }
        }
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

        // Desktop keyboard shortcuts (Space/Up to jump/restart, Esc to exit)
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

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
            startJump();
            setTimeout(endJump, 120);
        },

        getHighScore: function () {
            return catRunnerHighScore;
        },

        destroy: function () {
            exitMiniGame();
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
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
