/**
 * Gold Sky Game - Main Game Logic
 * A basket collecting game where players collect falling gold pieces
 * Built with vanilla JavaScript, HTML5 Canvas, and Web Audio API
 */

// Game Configuration Constants
const CONFIG = {
    // Game dimensions and timing
    GAME_WIDTH: 800,
    GAME_HEIGHT: 600,
    INITIAL_TIMER: 60, // seconds
    FPS_TARGET: 60,
    
    // Basket properties
    BASKET_WIDTH: 80,
    BASKET_HEIGHT: 40,
    BASKET_SPEED: 300, // pixels per second
    BASKET_MARGIN: 10, // distance from edges
    
    // Gold piece properties
    GOLD_MIN_SIZE: 15,
    GOLD_MAX_SIZE: 35,
    GOLD_MIN_SPEED: 100, // pixels per second
    GOLD_MAX_SPEED: 250,
    SPAWN_RATE: 2.0, // gold pieces per second
    SPAWN_RATE_INCREASE: 0.1, // increase per 10 seconds
    
    // Physics and collision
    GRAVITY: 200, // pixels per second squared
    COLLISION_PADDING: 5, // pixels of overlap allowed
    
    // Scoring system
    SCORE_MULTIPLIER: 10, // base points per gold size
    SIZE_BONUS_MULTIPLIER: 1.5, // bonus for larger gold
    
    // Visual effects
    PICKUP_FLASH_DURATION: 200, // milliseconds
    PARTICLE_COUNT: 6,
    PARTICLE_LIFETIME: 500, // milliseconds
    
    // Debug mode
    DEBUG_ENABLED: false
};

/**
 * Utility Functions
 */
const Utils = {
    /**
     * Generate random number between min and max
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random number
     */
    random(min, max) {
        return Math.random() * (max - min) + min;
    },
    
    /**
     * Generate random integer between min and max (inclusive)
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random integer
     */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    
    /**
     * Clamp value between min and max
     * @param {number} value - Value to clamp
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Clamped value
     */
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },
    
    /**
     * Check circle-rectangle collision
     * @param {Object} circle - Circle object with x, y, radius
     * @param {Object} rect - Rectangle object with x, y, width, height
     * @returns {boolean} True if collision detected
     */
    circleRectCollision(circle, rect) {
        const distX = Math.abs(circle.x - rect.x - rect.width / 2);
        const distY = Math.abs(circle.y - rect.y - rect.height / 2);
        
        if (distX > (rect.width / 2 + circle.radius)) return false;
        if (distY > (rect.height / 2 + circle.radius)) return false;
        
        if (distX <= (rect.width / 2)) return true;
        if (distY <= (rect.height / 2)) return true;
        
        const dx = distX - rect.width / 2;
        const dy = distY - rect.height / 2;
        return (dx * dx + dy * dy <= (circle.radius * circle.radius));
    },
    
    /**
     * Format time in MM:SS format
     * @param {number} seconds - Time in seconds
     * @returns {string} Formatted time string
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
};

/**
 * Audio Manager Class
 * Handles all game audio with fallback for unsupported browsers
 */
class AudioManager {
    constructor() {
        this.sounds = {};
        this.muted = false;
        this.volume = 0.7;
        this.supported = true;
        
        try {
            // Test Web Audio API support
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported, using fallback');
            this.supported = false;
        }
        
        this.loadSounds();
    }
    
    /**
     * Load all game sounds
     */
    loadSounds() {
        const soundElements = {
            pickup: document.getElementById('pickupSound'),
            miss: document.getElementById('missSound'),
            start: document.getElementById('startSound')
        };
        
        Object.entries(soundElements).forEach(([name, element]) => {
            if (element) {
                element.volume = this.volume;
                this.sounds[name] = element;
            }
        });
    }
    
    /**
     * Play a sound effect
     * @param {string} name - Sound name
     */
    play(name) {
        if (this.muted || !this.supported || !this.sounds[name]) return;
        
        try {
            this.sounds[name].currentTime = 0;
            this.sounds[name].play().catch(e => {
                console.warn(`Could not play sound ${name}:`, e);
            });
        } catch (e) {
            console.warn(`Error playing sound ${name}:`, e);
        }
    }
    
    /**
     * Toggle mute state
     */
    toggleMute() {
        this.muted = !this.muted;
        Object.values(this.sounds).forEach(sound => {
            sound.muted = this.muted;
        });
        return this.muted;
    }
    
    /**
     * Set volume level
     * @param {number} volume - Volume level (0-1)
     */
    setVolume(volume) {
        this.volume = Utils.clamp(volume, 0, 1);
        Object.values(this.sounds).forEach(sound => {
            sound.volume = this.volume;
        });
    }
}

/**
 * Particle Class
 * Visual effect particles for gold collection
 */
class Particle {
    constructor(x, y, color = '#FFD700') {
        this.x = x;
        this.y = y;
        this.vx = Utils.random(-100, 100);
        this.vy = Utils.random(-150, -50);
        this.life = CONFIG.PARTICLE_LIFETIME;
        this.maxLife = CONFIG.PARTICLE_LIFETIME;
        this.size = Utils.random(3, 8);
        this.color = color;
    }
    
    /**
     * Update particle physics
     * @param {number} deltaTime - Frame time in seconds
     */
    update(deltaTime) {
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        this.vy += CONFIG.GRAVITY * deltaTime;
        this.life -= deltaTime * 1000;
    }
    
    /**
     * Draw particle to canvas
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    draw(ctx) {
        const alpha = this.life / this.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    
    /**
     * Check if particle is still alive
     * @returns {boolean} True if particle should continue existing
     */
    isAlive() {
        return this.life > 0;
    }
}

/**
 * Gold Piece Class
 * Represents falling gold pieces that can be collected
 */
class Gold {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = Utils.random(CONFIG.GOLD_MIN_SIZE, CONFIG.GOLD_MAX_SIZE);
        this.speed = Utils.random(CONFIG.GOLD_MIN_SPEED, CONFIG.GOLD_MAX_SPEED);
        this.rotation = 0;
        this.rotationSpeed = Utils.random(-5, 5);
        this.shimmer = 0;
        this.collected = false;
        
        // Larger gold falls slower (more realistic)
        const sizeFactor = this.radius / CONFIG.GOLD_MAX_SIZE;
        this.speed = CONFIG.GOLD_MIN_SPEED + (CONFIG.GOLD_MAX_SPEED - CONFIG.GOLD_MIN_SPEED) * (1 - sizeFactor * 0.5);
    }
    
    /**
     * Update gold piece physics
     * @param {number} deltaTime - Frame time in seconds
     */
    update(deltaTime) {
        this.y += this.speed * deltaTime;
        this.rotation += this.rotationSpeed * deltaTime;
        this.shimmer += deltaTime * 4;
    }
    
    /**
     * Draw gold piece to canvas
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {boolean} debug - Whether to draw debug info
     */
    draw(ctx, debug = false) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Gold gradient with shimmer effect
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
        const shimmerAmount = (Math.sin(this.shimmer) + 1) * 0.1;
        gradient.addColorStop(0, `hsl(51, 100%, ${85 + shimmerAmount * 10}%)`);
        gradient.addColorStop(0.7, `hsl(45, 100%, ${70 + shimmerAmount * 5}%)`);
        gradient.addColorStop(1, `hsl(38, 80%, ${50 + shimmerAmount * 3}%)`);
        
        // Shadow
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#B8860B';
        ctx.beginPath();
        ctx.arc(2, 2, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Main gold piece
        ctx.globalAlpha = 1;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(-this.radius * 0.3, -this.radius * 0.3, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
        
        // Debug collision circle
        if (debug) {
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    
    /**
     * Check if gold piece is off screen
     * @returns {boolean} True if off screen
     */
    isOffScreen() {
        return this.y - this.radius > CONFIG.GAME_HEIGHT;
    }
    
    /**
     * Get collision bounds
     * @returns {Object} Collision circle data
     */
    getCollisionBounds() {
        return {
            x: this.x,
            y: this.y,
            radius: this.radius - CONFIG.COLLISION_PADDING
        };
    }
    
    /**
     * Calculate points value for this gold piece
     * @returns {number} Points value
     */
    getPointValue() {
        const sizeRatio = this.radius / CONFIG.GOLD_MAX_SIZE;
        return Math.floor(CONFIG.SCORE_MULTIPLIER * sizeRatio * CONFIG.SIZE_BONUS_MULTIPLIER);
    }
}

/**
 * Basket Class
 * Player-controlled basket that collects gold
 */
class Basket {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = CONFIG.BASKET_WIDTH;
        this.height = CONFIG.BASKET_HEIGHT;
        this.vx = 0;
        this.vy = 0;
        this.flashTimer = 0;
    }
    
    /**
     * Update basket position and effects
     * @param {number} deltaTime - Frame time in seconds
     */
    update(deltaTime) {
        // Apply velocity
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        
        // Constrain to game area
        const margin = CONFIG.BASKET_MARGIN;
        this.x = Utils.clamp(this.x, margin, CONFIG.GAME_WIDTH - this.width - margin);
        this.y = Utils.clamp(this.y, margin, CONFIG.GAME_HEIGHT - this.height - margin);
        
        // Update flash effect
        if (this.flashTimer > 0) {
            this.flashTimer -= deltaTime * 1000;
        }
    }
    
    /**
     * Draw basket to canvas
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {boolean} debug - Whether to draw debug info
     */
    draw(ctx, debug = false) {
        ctx.save();
        
        // Flash effect when collecting
        if (this.flashTimer > 0) {
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 20;
        }
        
        // Basket body (brown woven pattern)
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Basket weave pattern
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 2;
        for (let i = 0; i < this.width; i += 8) {
            ctx.beginPath();
            ctx.moveTo(this.x + i, this.y);
            ctx.lineTo(this.x + i, this.y + this.height);
            ctx.stroke();
        }
        for (let j = 0; j < this.height; j += 6) {
            ctx.beginPath();
            ctx.moveTo(this.x, this.y + j);
            ctx.lineTo(this.x + this.width, this.y + j);
            ctx.stroke();
        }
        
        // Basket rim
        ctx.fillStyle = '#A0522D';
        ctx.fillRect(this.x - 2, this.y - 3, this.width + 4, 6);
        
        // Handle
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y - 5, this.width / 3, Math.PI, 0);
        ctx.stroke();
        
        ctx.restore();
        
        // Debug collision rectangle
        if (debug) {
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x, this.y, this.width, this.height);
        }
    }
    
    /**
     * Set basket velocity
     * @param {number} vx - X velocity
     * @param {number} vy - Y velocity
     */
    setVelocity(vx, vy) {
        this.vx = vx;
        this.vy = vy;
    }
    
    /**
     * Trigger collection flash effect
     */
    flash() {
        this.flashTimer = CONFIG.PICKUP_FLASH_DURATION;
    }
    
    /**
     * Get collision bounds
     * @returns {Object} Collision rectangle data
     */
    getCollisionBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
}

/**
 * Object Pool Class
 * Manages reusable gold pieces for performance
 */
class ObjectPool {
    constructor(createFn, resetFn) {
        this.pool = [];
        this.active = [];
        this.createFn = createFn;
        this.resetFn = resetFn;
    }
    
    /**
     * Get object from pool or create new one
     * @param {...any} args - Arguments to pass to create function
     * @returns {Object} Pooled object
     */
    get(...args) {
        let obj;
        if (this.pool.length > 0) {
            obj = this.pool.pop();
            this.resetFn(obj, ...args);
        } else {
            obj = this.createFn(...args);
        }
        this.active.push(obj);
        return obj;
    }
    
    /**
     * Return object to pool
     * @param {Object} obj - Object to return
     */
    release(obj) {
        const index = this.active.indexOf(obj);
        if (index > -1) {
            this.active.splice(index, 1);
            this.pool.push(obj);
        }
    }
    
    /**
     * Get all active objects
     * @returns {Array} Active objects
     */
    getActive() {
        return this.active;
    }
    
    /**
     * Clear all objects
     */
    clear() {
        this.active.length = 0;
        this.pool.length = 0;
    }
}

/**
 * Game State Manager
 */
const GameState = {
    LOADING: 'loading',
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'game_over'
};

/**
 * Main Game Class
 * Core game logic and state management
 */
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.state = GameState.LOADING;
        
        // Game state
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('goldSkyHighScore') || '0');
        this.timeLeft = CONFIG.INITIAL_TIMER;
        this.gameStartTime = 0;
        this.lastSpawnTime = 0;
        this.currentSpawnRate = CONFIG.SPAWN_RATE;
        
        // Input state
        this.keys = {};
        this.touches = {};
        
        // Game objects
        this.basket = null;
        this.particles = [];
        
        // Object pools for performance
        this.goldPool = new ObjectPool(
            (x, y) => new Gold(x, y),
            (gold, x, y) => {
                gold.x = x;
                gold.y = y;
                gold.collected = false;
                gold.rotation = 0;
                gold.shimmer = 0;
                gold.radius = Utils.random(CONFIG.GOLD_MIN_SIZE, CONFIG.GOLD_MAX_SIZE);
                const sizeFactor = gold.radius / CONFIG.GOLD_MAX_SIZE;
                gold.speed = CONFIG.GOLD_MIN_SPEED + (CONFIG.GOLD_MAX_SPEED - CONFIG.GOLD_MIN_SPEED) * (1 - sizeFactor * 0.5);
                gold.rotationSpeed = Utils.random(-5, 5);
            }
        );
        
        // Performance tracking
        this.lastFrameTime = 0;
        this.fps = 0;
        this.frameCount = 0;
        this.fpsTimer = 0;
        
        // Debug mode
        this.debugMode = false;
        
        // Audio manager
        this.audio = new AudioManager();
        
        // Initialize
        this.setupCanvas();
        this.setupEventListeners();
        this.setupUI();
        this.loadAssets();
    }
    
    /**
     * Setup canvas properties
     */
    setupCanvas() {
        // Set internal resolution
        this.canvas.width = CONFIG.GAME_WIDTH;
        this.canvas.height = CONFIG.GAME_HEIGHT;
        
        // Enable high-DPI rendering
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        // Set rendering properties
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
    }
    
    /**
     * Setup input event listeners
     */
    setupEventListeners() {
        // Keyboard input
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Focus management
        document.getElementById('gameArea').addEventListener('click', () => {
            document.getElementById('gameArea').focus();
        });
        
        // Touch controls for mobile
        const touchButtons = {
            leftBtn: () => this.touches.left = true,
            rightBtn: () => this.touches.right = true,
            upBtn: () => this.touches.up = true,
            downBtn: () => this.touches.down = true
        };
        
        Object.entries(touchButtons).forEach(([id, action]) => {
            const btn = document.getElementById(id);
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                action();
            });
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.touches = {};
            });
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                action();
            });
            btn.addEventListener('mouseup', (e) => {
                e.preventDefault();
                this.touches = {};
            });
        });
        
        // Window resize handler
        window.addEventListener('resize', () => this.handleResize());
        
        // Visibility change handler (pause when tab not visible)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === GameState.PLAYING) {
                this.pauseGame();
            }
        });
    }
    
    /**
     * Setup UI event listeners
     */
    setupUI() {
        // Game control buttons
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('resumeBtn').addEventListener('click', () => this.resumeGame());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
        document.getElementById('playAgainBtn').addEventListener('click', () => this.startGame());
        
        // Audio controls
        document.getElementById('muteBtn').addEventListener('click', () => this.toggleMute());
        
        // Accessibility and debug controls
        document.getElementById('contrastBtn').addEventListener('click', () => this.toggleHighContrast());
        document.getElementById('debugBtn').addEventListener('click', () => this.toggleDebug());
        
        // Share button
        document.getElementById('shareBtn').addEventListener('click', () => this.shareScore());
        
        // Update high score display
        document.getElementById('highScore').textContent = this.highScore;
        
        // Check for debug mode in URL
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('debug') === 'true') {
            this.debugMode = true;
            CONFIG.DEBUG_ENABLED = true;
        }
    }
    
    /**
     * Load game assets with progress tracking
     */
    async loadAssets() {
        const loadingScreen = document.getElementById('loadingScreen');
        const progressBar = document.getElementById('loadingProgress');
        
        try {
            // Simulate asset loading for demo
            const steps = ['Audio', 'Graphics', 'Game Data', 'UI'];
            
            for (let i = 0; i < steps.length; i++) {
                await new Promise(resolve => setTimeout(resolve, 300));
                const progress = ((i + 1) / steps.length) * 100;
                progressBar.style.width = `${progress}%`;
            }
            
            // Hide loading screen and show menu
            loadingScreen.classList.remove('active');
            document.getElementById('startScreen').classList.add('active');
            this.state = GameState.MENU;
            
        } catch (error) {
            console.error('Asset loading failed:', error);
            // Continue anyway for demo
            loadingScreen.classList.remove('active');
            document.getElementById('startScreen').classList.add('active');
            this.state = GameState.MENU;
        }
    }
    
    /**
     * Handle keyboard input
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleKeyDown(e) {
        // Prevent default for game keys
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Escape'].includes(e.key)) {
            e.preventDefault();
        }
        
        this.keys[e.key] = true;
        
        // Global shortcuts
        if (e.key === 'Escape' && this.state === GameState.PLAYING) {
            this.pauseGame();
        }
        if (e.key === ' ' && this.state === GameState.MENU) {
            this.startGame();
        }
    }
    
    /**
     * Handle keyboard release
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleKeyUp(e) {
        this.keys[e.key] = false;
    }
    
    /**
     * Handle window resize
     */
    handleResize() {
        this.setupCanvas();
    }
    
    /**
     * Start new game
     */
    startGame() {
        // Reset game state
        this.score = 0;
        this.timeLeft = CONFIG.INITIAL_TIMER;
        this.gameStartTime = Date.now();
        this.lastSpawnTime = 0;
        this.currentSpawnRate = CONFIG.SPAWN_RATE;
        
        // Clear objects
        this.goldPool.clear();
        this.particles = [];
        
        // Create basket at bottom center
        this.basket = new Basket(
            (CONFIG.GAME_WIDTH - CONFIG.BASKET_WIDTH) / 2,
            CONFIG.GAME_HEIGHT - CONFIG.BASKET_HEIGHT - 50
        );
        
        // Update UI
        this.updateScoreDisplay();
        
        // Hide menu screens, start game
        document.querySelectorAll('.game-screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        this.state = GameState.PLAYING;
        this.audio.play('start');
        
        // Focus game area for keyboard input
        document.getElementById('gameArea').focus();
    }
    
    /**
     * Pause game
     */
    pauseGame() {
        if (this.state === GameState.PLAYING) {
            this.state = GameState.PAUSED;
            document.getElementById('pauseScreen').classList.add('active');
        }
    }
    
    /**
     * Resume game
     */
    resumeGame() {
        if (this.state === GameState.PAUSED) {
            this.state = GameState.PLAYING;
            document.getElementById('pauseScreen').classList.remove('active');
            document.getElementById('gameArea').focus();
        }
    }
    
    /**
     * Toggle pause state
     */
    togglePause() {
        if (this.state === GameState.PLAYING) {
            this.pauseGame();
        } else if (this.state === GameState.PAUSED) {
            this.resumeGame();
        }
    }
    
    /**
     * Restart current game
     */
    restartGame() {
        this.startGame();
    }
    
    /**
     * End game and show results
     */
    endGame() {
        this.state = GameState.GAME_OVER;
        
        // Check for new high score
        let isNewHighScore = false;
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('goldSkyHighScore', this.highScore.toString());
            isNewHighScore = true;
        }
        
        // Update UI
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('newHighScore').style.display = isNewHighScore ? 'block' : 'none';
        document.getElementById('highScore').textContent = this.highScore;
        document.getElementById('gameOverScreen').classList.add('active');
    }
    
    /**
     * Update game logic
     * @param {number} deltaTime - Frame time in seconds
     */
    update(deltaTime) {
        if (this.state !== GameState.PLAYING) return;
        
        // Update timer
        this.timeLeft -= deltaTime;
        if (this.timeLeft <= 0) {
            this.timeLeft = 0;
            this.endGame();
            return;
        }
        
        // Update spawn rate based on time
        const timeElapsed = (Date.now() - this.gameStartTime) / 1000;
        this.currentSpawnRate = CONFIG.SPAWN_RATE + Math.floor(timeElapsed / 10) * CONFIG.SPAWN_RATE_INCREASE;
        
        // Handle input and update basket
        this.updateBasket(deltaTime);
        
        // Spawn gold pieces
        this.spawnGold(deltaTime);
        
        // Update gold pieces
        this.updateGold(deltaTime);
        
        // Update particles
        this.updateParticles(deltaTime);
        
        // Update UI
        this.updateUI();
    }
    
    /**
     * Update basket based on input
     * @param {number} deltaTime - Frame time in seconds
     */
    updateBasket(deltaTime) {
        if (!this.basket) return;
        
        let vx = 0, vy = 0;
        
        // Keyboard input
        if (this.keys['ArrowLeft']) vx -= CONFIG.BASKET_SPEED;
        if (this.keys['ArrowRight']) vx += CONFIG.BASKET_SPEED;
        if (this.keys['ArrowUp']) vy -= CONFIG.BASKET_SPEED;
        if (this.keys['ArrowDown']) vy += CONFIG.BASKET_SPEED;
        
        // Touch input
        if (this.touches.left) vx -= CONFIG.BASKET_SPEED;
        if (this.touches.right) vx += CONFIG.BASKET_SPEED;
        if (this.touches.up) vy -= CONFIG.BASKET_SPEED;
        if (this.touches.down) vy += CONFIG.BASKET_SPEED;
        
        this.basket.setVelocity(vx, vy);
        this.basket.update(deltaTime);
    }
    
    /**
     * Spawn new gold pieces
     * @param {number} deltaTime - Frame time in seconds
     */
    spawnGold(deltaTime) {
        const now = Date.now();
        const timeBetweenSpawns = 1000 / this.currentSpawnRate;
        
        if (now - this.lastSpawnTime > timeBetweenSpawns) {
            const x = Utils.random(CONFIG.GOLD_MAX_SIZE, CONFIG.GAME_WIDTH - CONFIG.GOLD_MAX_SIZE);
            const y = -CONFIG.GOLD_MAX_SIZE;
            this.goldPool.get(x, y);
            this.lastSpawnTime = now;
        }
    }
    
    /**
     * Update all gold pieces
     * @param {number} deltaTime - Frame time in seconds
     */
    updateGold(deltaTime) {
        const activeGold = this.goldPool.getActive();
        
        for (let i = activeGold.length - 1; i >= 0; i--) {
            const gold = activeGold[i];
            gold.update(deltaTime);
            
            // Check collision with basket
            if (this.basket && Utils.circleRectCollision(
                gold.getCollisionBounds(),
                this.basket.getCollisionBounds()
            )) {
                // Collect gold
                const points = gold.getPointValue();
                this.score += points;
                this.basket.flash();
                this.audio.play('pickup');
                
                // Create particles
                this.createPickupParticles(gold.x, gold.y);
                
                // Remove gold
                this.goldPool.release(gold);
                continue;
            }
            
            // Remove if off screen
            if (gold.isOffScreen()) {
                this.audio.play('miss');
                this.goldPool.release(gold);
            }
        }
    }
    
    /**
     * Update particle effects
     * @param {number} deltaTime - Frame time in seconds
     */
    updateParticles(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.update(deltaTime);
            
            if (!particle.isAlive()) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    /**
     * Create pickup particle effect
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    createPickupParticles(x, y) {
        for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
            this.particles.push(new Particle(x, y, '#FFD700'));
        }
    }
    
    /**
     * Update UI elements
     */
    updateUI() {
        document.getElementById('currentScore').textContent = this.score;
        document.getElementById('timeLeft').textContent = Utils.formatTime(this.timeLeft);
    }
    
    /**
     * Update score display
     */
    updateScoreDisplay() {
        document.getElementById('currentScore').textContent = this.score;
        document.getElementById('highScore').textContent = this.highScore;
    }
    
    /**
     * Render game graphics
     */
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);
        
        if (this.state === GameState.PLAYING || this.state === GameState.PAUSED) {
            // Draw background
            this.drawBackground();
            
            // Draw game objects
            this.drawGold();
            this.drawBasket();
            this.drawParticles();
            
            // Draw debug info
            if (this.debugMode) {
                this.drawDebugInfo();
            }
            
            // Draw pause overlay
            if (this.state === GameState.PAUSED) {
                this.drawPauseOverlay();
            }
        }
    }
    
    /**
     * Draw game background
     */
    drawBackground() {
        // Sky gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, CONFIG.GAME_HEIGHT);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(0.7, '#E0F6FF');
        gradient.addColorStop(1, '#F0F8FF');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);
        
        // Simple cloud shapes
        this.drawClouds();
    }
    
    /**
     * Draw decorative clouds
     */
    drawClouds() {
        const clouds = [
            { x: 100, y: 80, size: 40 },
            { x: 300, y: 120, size: 30 },
            { x: 600, y: 60, size: 35 },
            { x: 750, y: 140, size: 25 }
        ];
        
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        clouds.forEach(cloud => {
            this.ctx.beginPath();
            this.ctx.arc(cloud.x, cloud.y, cloud.size, 0, Math.PI * 2);
            this.ctx.arc(cloud.x + cloud.size * 0.6, cloud.y, cloud.size * 0.8, 0, Math.PI * 2);
            this.ctx.arc(cloud.x + cloud.size * 1.2, cloud.y, cloud.size * 0.6, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
    
    /**
     * Draw all gold pieces
     */
    drawGold() {
        this.goldPool.getActive().forEach(gold => {
            gold.draw(this.ctx, this.debugMode);
        });
    }
    
    /**
     * Draw basket
     */
    drawBasket() {
        if (this.basket) {
            this.basket.draw(this.ctx, this.debugMode);
        }
    }
    
    /**
     * Draw particle effects
     */
    drawParticles() {
        this.particles.forEach(particle => {
            particle.draw(this.ctx);
        });
    }
    
    /**
     * Draw debug information overlay
     */
    drawDebugInfo() {
        const debugInfo = document.querySelector('.debug-info') || this.createDebugInfoElement();
        
        const activeGold = this.goldPool.getActive().length;
        const pooledGold = this.goldPool.pool.length;
        
        debugInfo.innerHTML = `
            FPS: ${this.fps}<br>
            Active Gold: ${activeGold}<br>
            Pooled Gold: ${pooledGold}<br>
            Particles: ${this.particles.length}<br>
            Spawn Rate: ${this.currentSpawnRate.toFixed(1)}/sec<br>
            Score: ${this.score}<br>
            Time: ${this.timeLeft.toFixed(1)}s
        `;
    }
    
    /**
     * Create debug info element
     * @returns {HTMLElement} Debug info element
     */
    createDebugInfoElement() {
        const debugInfo = document.createElement('div');
        debugInfo.className = 'debug-info';
        document.getElementById('gameArea').appendChild(debugInfo);
        return debugInfo;
    }
    
    /**
     * Draw pause overlay
     */
    drawPauseOverlay() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, CONFIG.GAME_WIDTH, CONFIG.GAME_HEIGHT);
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.fillText('PAUSED', CONFIG.GAME_WIDTH / 2, CONFIG.GAME_HEIGHT / 2);
    }
    
    /**
     * Main game loop
     * @param {number} timestamp - High resolution timestamp
     */
    gameLoop(timestamp) {
        // Calculate delta time
        if (!this.lastFrameTime) this.lastFrameTime = timestamp;
        const deltaTime = (timestamp - this.lastFrameTime) / 1000;
        this.lastFrameTime = timestamp;
        
        // FPS calculation
        this.frameCount++;
        this.fpsTimer += deltaTime;
        if (this.fpsTimer >= 1) {
            this.fps = Math.round(this.frameCount / this.fpsTimer);
            this.frameCount = 0;
            this.fpsTimer = 0;
        }
        
        // Update and render
        this.update(deltaTime);
        this.render();
        
        // Continue loop
        requestAnimationFrame(timestamp => this.gameLoop(timestamp));
    }
    
    /**
     * Toggle audio mute
     */
    toggleMute() {
        const isMuted = this.audio.toggleMute();
        const muteBtn = document.getElementById('muteBtn');
        muteBtn.textContent = isMuted ? '🔇' : '🔊';
        muteBtn.setAttribute('aria-label', isMuted ? 'Unmute sound' : 'Mute sound');
    }
    
    /**
     * Toggle high contrast mode
     */
    toggleHighContrast() {
        document.body.classList.toggle('high-contrast');
        const contrastBtn = document.getElementById('contrastBtn');
        const isHighContrast = document.body.classList.contains('high-contrast');
        contrastBtn.setAttribute('aria-label', isHighContrast ? 'Disable high contrast' : 'Enable high contrast');
    }
    
    /**
     * Toggle debug mode
     */
    toggleDebug() {
        this.debugMode = !this.debugMode;
        const debugBtn = document.getElementById('debugBtn');
        debugBtn.style.opacity = this.debugMode ? '1' : '0.5';
        
        // Remove debug info if disabling
        if (!this.debugMode) {
            const debugInfo = document.querySelector('.debug-info');
            if (debugInfo) {
                debugInfo.remove();
            }
        }
    }
    
    /**
     * Share score functionality
     */
    shareScore() {
        const shareText = `I just scored ${this.score} points in Gold Sky! Can you beat my score? 🌟`;
        const shareUrl = window.location.href;
        
        // Try native sharing API first (mobile)
        if (navigator.share) {
            navigator.share({
                title: 'Gold Sky - My Score',
                text: shareText,
                url: shareUrl
            }).catch(err => console.log('Error sharing:', err));
        } else {
            // Fallback: copy to clipboard
            if (navigator.clipboard) {
                navigator.clipboard.writeText(shareText + ' ' + shareUrl)
                    .then(() => {
                        alert('Score copied to clipboard!');
                    })
                    .catch(() => {
                        // Final fallback: show alert with text to copy
                        prompt('Copy this text to share your score:', shareText + ' ' + shareUrl);
                    });
            } else {
                prompt('Copy this text to share your score:', shareText + ' ' + shareUrl);
            }
        }
    }
    
    /**
     * Start the game engine
     */
    start() {
        // Begin game loop
        requestAnimationFrame(timestamp => this.gameLoop(timestamp));
    }
}

/**
 * Simple Test Suite
 * Basic unit tests for core game functions
 */
const Tests = {
    /**
     * Test collision detection
     */
    testCollisions() {
        console.log('Testing collision detection...');
        
        // Circle-rectangle collision tests
        const circle = { x: 50, y: 50, radius: 20 };
        const rect = { x: 40, y: 40, width: 20, height: 20 };
        
        // Should collide
        console.assert(Utils.circleRectCollision(circle, rect), 'Circle should collide with overlapping rectangle');
        
        // Should not collide
        circle.x = 100;
        console.assert(!Utils.circleRectCollision(circle, rect), 'Circle should not collide with distant rectangle');
        
        console.log('Collision tests passed!');
    },
    
    /**
     * Test utility functions
     */
    testUtils() {
        console.log('Testing utility functions...');
        
        // Random range test
        for (let i = 0; i < 100; i++) {
            const val = Utils.random(0, 10);
            console.assert(val >= 0 && val <= 10, 'Random value should be in range');
        }
        
        // Clamp test
        console.assert(Utils.clamp(5, 0, 10) === 5, 'Clamp should not change value in range');
        console.assert(Utils.clamp(-5, 0, 10) === 0, 'Clamp should constrain to minimum');
        console.assert(Utils.clamp(15, 0, 10) === 10, 'Clamp should constrain to maximum');
        
        // Time format test
        console.assert(Utils.formatTime(65) === '1:05', 'Time format should work correctly');
        console.assert(Utils.formatTime(5) === '0:05', 'Time format should pad seconds');
        
        console.log('Utility tests passed!');
    },
    
    /**
     * Test scoring system
     */
    testScoring() {
        console.log('Testing scoring system...');
        
        // Create test gold pieces with different sizes
        const smallGold = new Gold(0, 0);
        smallGold.radius = CONFIG.GOLD_MIN_SIZE;
        
        const largeGold = new Gold(0, 0);
        largeGold.radius = CONFIG.GOLD_MAX_SIZE;
        
        // Large gold should be worth more points
        console.assert(largeGold.getPointValue() > smallGold.getPointValue(), 
            'Larger gold should be worth more points');
        
        console.log('Scoring tests passed!');
    },
    
    /**
     * Run all tests
     */
    runAll() {
        try {
            this.testCollisions();
            this.testUtils();
            this.testScoring();
            console.log('✅ All tests passed!');
        } catch (error) {
            console.error('❌ Test failed:', error);
        }
    }
};

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Run tests in debug mode
    if (CONFIG.DEBUG_ENABLED) {
        Tests.runAll();
    }
    
    // Create and start game
    window.goldSkyGame = new Game();
    window.goldSkyGame.start();
});

// Expose game for console debugging
window.Game = Game;
window.CONFIG = CONFIG;
window.Utils = Utils;
