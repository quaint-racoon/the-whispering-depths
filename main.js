// --- CORE CONFIGURATION ---
let CANVAS_WIDTH = 800;
let CANVAS_HEIGHT = 600;
const TILE_SIZE = 12;
const MAP_WIDTH = 100;
const MAP_HEIGHT = 100;
const VISION_RANGE = 8;
const CAMERA_LAG_FACTOR = 0.12;
const STACK_MAX = 16;
// Tile types
const TILE_FLOOR = 0;
const TILE_WALL = 1;
const TILE_DOOR = 2;

// --- GAME STATE ---
let canvas, ctx;
let map = [];
let visibilityMap = [];
let exploredMap = [];
let player = { 
    x: 0, 
    y: 0, 
    dx: 0, 
    dy: 0,
    speed:0.15,
    health: 100, 
    maxHealth: 100,
    regeneration:0,
    damage: 10,
    potions: 0,
    gold: 0,
    mana:50,
    maxMana:50,
    attackCooldown: 0,
    attacking:false,
    color: '#3b82f6',
    size: TILE_SIZE * 0.4,
    inventory:{},
    points:0,
    upgrades:{
        price:5,
        health:0,
        luck:0,
        speed:0,
        damage:0,
        regeneration:0,
        mana:0,
        maxLevel:4,
    },
    metadata: {
        'health': { color: 'red', icon: 'heart' },
        'mana': { color: 'blue', icon: 'droplet' },
        'speed': { color: 'green', icon: 'feather' },
        'regeneration': { color: 'pink', icon: 'repeat' },
        'luck': { color: 'yellow', icon: 'sparkles' },
        'damage': { color: 'orange', icon: 'sword' }
    }
};

var lootTable = {
    mobDrop:{
        gold:85,
        potion:15,
    },
    chest:{
        air:25,
        gold:54,
        potion:15,
        bomb:6
    }
}



let exitLadder;
let camera = { x: 0, y: 0, targetX: 0, targetY: 0 };
let keys = {
    mouse: { left: false, right: false }
};
// Game entities
let chests = [];
let shops = [];
let mobs = [];
let lootItems = [];
let particles = [];
let game;
let gameTime = 0;
let messages = [];
let frames=0;
let fps;
const spawn = {};
const MESSAGE_TIMEOUT_MS = 5000;
const input = document.getElementById('chatInput'); 
const shopUi = document.getElementById('shop-ui')
const attackBtn = document.getElementById('attack-btn')
const interactBtn = document.getElementById('interact-btn') 

class SpriteSheet {
    constructor(image, columns, rows, animations) {
        this.image = image;
        this.columns = columns;
        this.rows = rows;
        this.frameWidth = image.width / columns;
        this.frameHeight = image.height / rows;
        this.animations = animations;
    }

    _draw(sourceX, sourceY, x, y, rotation, scale) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);

        const scaledWidth = this.frameWidth * scale;
        const scaledHeight = this.frameHeight * scale;

        ctx.drawImage(
            this.image,
            sourceX,
            sourceY,
            this.frameWidth,
            this.frameHeight,
            -scaledWidth / 2,
            -scaledHeight / 2,
            scaledWidth,
            scaledHeight
        );
        ctx.restore();
    }

    drawFrame(frameIndex, x, y, rotation = 0, scale = 1) {
        const col = frameIndex % this.columns;
        const row = Math.floor(frameIndex / this.columns);

        const sourceX = col * this.frameWidth;
        const sourceY = row * this.frameHeight;

        this._draw(sourceX, sourceY, x, y, rotation, scale);
    }

    drawAnimation(animationName, frameIndexInAnimation, x, y, rotation = 0, scale = 1) {
        const anim = this.animations[animationName];

        if (!anim) {
            return;
        }

        const frameIndexOffset = frameIndexInAnimation % anim.frames;

        const absoluteFrameIndex = anim.startFrame + frameIndexOffset;

        const col = absoluteFrameIndex % this.columns;
        const row = Math.floor(absoluteFrameIndex / this.columns);

        const sourceX = col * this.frameWidth;
        const sourceY = row * this.frameHeight;

        this._draw(sourceX, sourceY, x, y, rotation, scale);
    }
}

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Failed to load image at ${url}`));
        image.src = url;
    });
}

let slashSheet;

loadImage('slash.png').then((slashImage) => {


    const animations = {
        "slash": {
            startFrame: 3,
            frames: 18
        },
    };

    slashSheet = new SpriteSheet(slashImage, 5, 5, animations);
}).catch(error => {
    console.error(error);
});

// --- UTILITY FUNCTIONS ---

function getLoot(lootTable) {
    if (!lootTable || Object.keys(lootTable).length === 0) {
        return "No Loot";
    }

    const totalWeight = Object.values(lootTable).reduce((sum, weight) => sum + weight, 0);

    const randomNumber = Math.random() * totalWeight;

    let cumulativeWeight = 0;
    for (const item in lootTable) {
        if (lootTable.hasOwnProperty(item)) {
            cumulativeWeight += lootTable[item];
            if (randomNumber < cumulativeWeight) {
                return item;
            }
        }
    }

    return "Error: Could not determine loot";
}


function isMobileUserAgent() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  
    // Check for common mobile OS/device keywords (case-insensitive)
    if (
      /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        userAgent
      )
    ) {
      return true;
    }
    return false;
  }
  


function calculateFps(){
    frames++
    ctx.fillStyle = 'white';
    ctx.fillText(fps, canvas.width-25, 15);
    if(frames===60){
    const deltaTime = new Date() - lastTime;
    lastTime = new Date();
    fps = Math.round(frames*1000/deltaTime)
    frames=0
    }
    
}
// Function to check if a tile is a wall
function isWall(tileX, tileY) {
    // Check bounds first to prevent errors
    if (tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT) {
        return true; 
    }
    return map[tileY][tileX] !== TILE_FLOOR;
}

function addMessage(text, color = '#e5e7eb') {
    messages.unshift({ text, color, time: Date.now() });
}


function drawMessageLog(ctx, canvasHeight) {
    const now = Date.now();
    
    messages = messages.filter(m => (now - m.time) < MESSAGE_TIMEOUT_MS);

    
    const logX = 10;
    const lineHeight = 18;
    const font = '14px sans-serif'; 
    
    let logY = canvasHeight - 10; 

    ctx.font = font;
    ctx.textAlign = 'left';
    for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        
        ctx.fillStyle = message.color;
        ctx.fillText(message.text, logX, logY);
        logY -= lineHeight; 
    }
}

function displayText(text) {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.font = '35px "Algerian"';
    ctx.fillStyle = '#0e7e1fff';
    ctx.textAlign = 'center';
    ctx.fillText(text, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
}

function updateUI() {
    document.getElementById('health').textContent = Math.max(0, Math.floor(player.health))+"/"+player.maxHealth;
    document.getElementById('healthBar').style.width = (player.health / player.maxHealth * 100) + '%';
    document.getElementById('mana').textContent = Math.max(0, Math.floor(player.mana)) + "/" + player.maxMana;
    document.getElementById('manaBar').style.width = (player.mana / player.maxMana * 100) + '%';
    document.getElementById('potions').textContent = '🧪' + (player.potions > 0 ? player.potions : '');
    document.getElementById('gold').textContent = '💰' + (player.gold > 0 ? player.gold : '');
}

function dist(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function createParticle(x, y, color, text = '') {
    particles.push({
        x, y, color, text,
        vx: (Math.random() - 0.5) * 0.2,
        vy: -Math.random() * 0.3 - 0.1,
        life: 30
    });
}

// --- VISIBILITY SYSTEM (FIXED) ---

function castRay(x0, y0, x1, y1) {
    // Calculate direction
    const dx = x1 - x0;
    const dy = y1 - y0;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Normalize direction
    const stepX = dx / distance;
    const stepY = dy / distance;
    
    // Step along the ray
    const steps = Math.ceil(distance);
    for (let i = 0; i <= steps; i++) {
        const x = Math.floor(x0 + stepX * i);
        const y = Math.floor(y0 + stepY * i);
        
        // Check bounds
        if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) {
            return;
        }
        
        // Mark as visible
        visibilityMap[y][x] = true;
        exploredMap[y][x] = true;
        
        // Stop at walls
        if (map[y][x] === TILE_WALL) {
            return;
        }
    }
}

function updateVisibility() {
    // Clear visibility map
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            visibilityMap[y][x] = false;
        }
    }
    
    // Use actual player position (with decimals)
    const px = player.x;
    const py = player.y;
    
    // Cast rays in a circle
    const numRays = 720;
    for (let i = 0; i < numRays; i++) {
        const angle = (i / numRays) * Math.PI * 2;
        const endX = px + Math.cos(angle) * VISION_RANGE;
        const endY = py + Math.sin(angle) * VISION_RANGE;
        castRay(px, py, endX, endY);
    }
}
// --- CANVAS RECORDING SCRIPT (NO UI) ---

// The duration of the recording (5 seconds)
const RECORD_DURATION_MS = 5000; 
let mediaRecorder;
let recordedChunks = [];
let isRecording = false;

// Note: This script assumes 'canvas' is a globally defined reference to the HTML canvas element.

/**
 * Starts recording the canvas stream for a fixed duration.
 */
function startRecording() {
    // Check if the canvas element is available
    if (typeof canvas === 'undefined' || !canvas.captureStream) {
        addMessage("[Recorder Error] Canvas element or captureStream API not found. Recording aborted.");
        return;
    }

    // Prevent starting a new recording if one is already in progress
    if (isRecording) {
        addMessage("[Recorder] Recording is already in progress. Waiting for timeout.");
        return;
    }

    // 1. Get the stream from the canvas element
    const stream = canvas.captureStream(60); // Captures at 60 frames per second
    
    // 2. Create the MediaRecorder instance
    // Note: 'video/webm; codecs=vp8' offers high compatibility
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp8' });
    recordedChunks = [];
    isRecording = true;
    addMessage(`[Recorder] Starting recording. Duration: ${RECORD_DURATION_MS / 1000} seconds.`);

    // 3. Event listener: Collect data when available
    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    // 4. Event listener: Process and download the video when recording stops
    mediaRecorder.onstop = () => {
        isRecording = false;
        addMessage("[Recorder] Recording stopped. Processing video...");

        // Create a Blob from the collected chunks
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        
        // Trigger automatic download
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style.display = 'none';
        a.href = url;
        a.download = `gameplay_recording_${new Date().toISOString()}.webm`;
        a.click();
        
        // Cleanup and log completion
        window.URL.revokeObjectURL(url);
        addMessage(`[Recorder] Recording complete! File saved as ${a.download}`);
    };

    // 5. Start recording
    mediaRecorder.start();
    
    // 6. Set timeout to stop recording after 5 seconds
    setTimeout(() => {
        if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
    }, RECORD_DURATION_MS);
}

// --- EVENT LISTENERS (Keypress only, no button/UI) ---

// Keypress 'o' listener
document.addEventListener('keydown', (e) => {
    if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        startRecording();
    }
});
// --- DUNGEON GENERATION ---

function initializeMap() {
    for (let y = 0; y < MAP_HEIGHT; y++) {
        map[y] = [];
        visibilityMap[y] = [];
        exploredMap[y] = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
            map[y][x] = TILE_WALL;
            visibilityMap[y][x] = false;
            exploredMap[y][x] = false;
        }
    }
}

function carveRoom(x, y, w, h) {
    for (let j = y; j < y + h; j++) {
        for (let i = x; i < x + w; i++) {
            if (i > 0 && i < MAP_WIDTH - 1 && j > 0 && j < MAP_HEIGHT - 1) {
                map[j][i] = TILE_FLOOR;
            }
        }
    }
    return { x: x + Math.floor(w/2), y: y + Math.floor(h/2), w, h };
}


function carveCorridor(x1, y1, x2, y2) {
    // Carve the horizontal corridor segment (2 blocks wide)
    const startX = Math.min(x1, x2);
    const endX = Math.max(x1, x2);
    for (let x = startX; x <= endX; x++) {
        // Carve two blocks vertically, at y1 and y1+1
        if (x > 0 && x < MAP_WIDTH - 1 && y1 > 0 && y1 < MAP_HEIGHT - 1) {
            map[y1][x] = TILE_FLOOR;
        }
        if (x > 0 && x < MAP_WIDTH - 1 && y1 + 1 > 0 && y1 + 1 < MAP_HEIGHT - 1) {
            map[y1 + 1][x] = TILE_FLOOR;
        }
    }


    // Carve the vertical corridor segment (2 blocks wide)
    const startY = Math.min(y1, y2);
    const endY = Math.max(y1, y2);
    for (let y = startY; y <= endY; y++) {
        // Carve two blocks horizontally, at x2 and x2+1
        if (x2 > 0 && x2 < MAP_WIDTH - 1 && y > 0 && y < MAP_HEIGHT - 1) {
            map[y][x2] = TILE_FLOOR;
        }
        if (x2 + 1 > 0 && x2 + 1 < MAP_WIDTH - 1 && y > 0 && y < MAP_HEIGHT - 1) {
            map[y][x2 + 1] = TILE_FLOOR;
        }
    }
    // Place a door at the start and end of the corridor
    // map[y1][x1] = TILE_DOOR;
    // map[y1][x2] = TILE_DOOR;
    // map[y2][x2] = TILE_DOOR;
    // map[y2][x1] = TILE_DOOR;
}

function generateDungeon() {
    initializeMap();
    
    const rooms = [];
    const numRooms = 15 + Math.floor(Math.random() * 10);
    
    // Generate rooms - ensure first room is near center for better start
    for (let i = 0; i < numRooms; i++) {
        const w = Math.floor(Math.random() * 8) + 6;
        const h = Math.floor(Math.random() * 8) + 6;
        
        let x, y;
        if (i === 0) {
            // First room in center of map
            x = Math.floor(MAP_WIDTH / 2 - w / 2);
            y = Math.floor(MAP_HEIGHT / 2 - h / 2);
        } else {
            x = Math.floor(Math.random() * (MAP_WIDTH - w - 2)) + 1;
            y = Math.floor(Math.random() * (MAP_HEIGHT - h - 2)) + 1;
        }
        
        const room = carveRoom(x, y, w, h);
        
        // Connect to previous room
        if (rooms.length > 0) {
            const prevRoom = rooms[rooms.length - 1];
            carveCorridor(room.x, room.y, prevRoom.x, prevRoom.y);
        }
        
        rooms.push(room);
    }
    const spawnRoom = rooms[0];
    spawn.x = spawnRoom.x;
    spawn.y = spawnRoom.y;
    const lastRoom = rooms[rooms.length - 1];
    exitLadder = { x: lastRoom.x, y: lastRoom.y };
    // Place player in center of first room
    player.x = rooms[0].x;
    player.y = rooms[0].y;
    
    // Ensure spawn point is definitely floor
    map[Math.floor(player.y)][Math.floor(player.x)] = TILE_FLOOR;
    
    // Place chests in some rooms
    chests = [];
    shops = [];
    for (let i = 1; i < rooms.length; i++) {
        if (Math.random() < 0.4) { // 40% chance per room
            const room = rooms[i];
            chests.push({
                x: room.x + Math.floor(Math.random() * 3) - 1,
                y: room.y + Math.floor(Math.random() * 3) - 1,
                opened: false,
                loot: getLoot(lootTable.chest)
            });
        }else if(Math.random()<0.05) {
            const room = rooms[i]
            shops.push({
                x:room.x + Math.floor(Math.random() * 3) - 1,
                y:room.y + Math.floor(Math.random() * 3) - 1,
            })
        }
    }
    
    // Place mobs in rooms
    mobs = [];
    for (let i = 1; i < rooms.length; i++) {
        if (Math.random() < 0.6) { // 60% chance per room
            const room = rooms[i];
            const mobCount = Math.floor(Math.random() * 3) + 1;
            for (let j = 0; j < mobCount; j++) {
                mobs.push({
                    x: room.x + Math.floor(Math.random() * room.w) - Math.floor(room.w/2),
                    y: room.y + Math.floor(Math.random() * room.h) - Math.floor(room.h/2),
                    health: 30,
                    maxHealth: 30,
                    damage: 5,
                    speed: 0.02,
                    attackCooldown: 0,
                    stunned: 0,
                });
            }
        }
    }
    
}

// --- GAME LOGIC ---

async function handleCombat() {
    // Player attack
    if ((keys.mouse.left||player.attacking) && player.attackCooldown <= 0) {
        player.attackCooldown = 30;
        
        // Check for nearby mobs
        
        if(!isMobileUserAgent()) player.attackAngle = Math.atan2(keys.mouse.y + camera.y-player.y*TILE_SIZE , keys.mouse.x + camera.x-player.x*TILE_SIZE);
        for (let mob of mobs) {
            if (mob.health <= 0) continue;
            if(dist(player.x, player.y, mob.x, mob.y) > 2.5 ) continue 
            const mobAngle = Math.atan2(mob.y-player.y, mob.x - player.x);
            const angleDiff = Math.abs(player.attackAngle - mobAngle);
            const normalizedAngleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
            if ( Math.abs(normalizedAngleDiff) <= Math.PI / 4) {
                
                mob.health -= player.damage;
                mob.stunned = 15; // Knockback stun
                
                // Knockback
                const angle = Math.atan2(mob.y - player.y, mob.x - player.x);
                mob.x += Math.cos(angle) * 0.5;
                mob.y += Math.sin(angle) * 0.5;
                
                createParticle(mob.x, mob.y, '#dc2626', '-' + player.damage);
                
                if (mob.health <= 0) {
                    // Drop loot
                    if (Math.random() < 0.3) {
                        lootItems.push({
                            x: mob.x,
                            y: mob.y,
                            type: getLoot(lootTable.mobDrop)
                        });
                    }
                    addMessage('Monster defeated!', '#10b981');
                }
            }
        }
    }
    
    if (player.attackCooldown > 0) player.attackCooldown--;
    
    // Mob attacks
    for (let mob of mobs) {
        if (mob.health <= 0) continue;
        if (mob.attackCooldown > 0) {
            mob.attackCooldown--;
            continue;
        }
        
        const mx = Math.floor(mob.x);
        const my = Math.floor(mob.y);
        const px = Math.floor(player.x);
        const py = Math.floor(player.y);
        
        if (dist(mx, my, px, py) < 1.5) {
            player.health -= mob.damage;
            mob.attackCooldown = 60;
            createParticle(player.x, player.y, '#dc2626', '-' + mob.damage);
            addMessage('Ouch! -' + mob.damage + ' HP', '#dc2626');
            updateUI();
            
            if (player.health <= 0) {
                cancelAnimationFrame(game);
                setTimeout(() => {
                    displayText('Respawning...');
                    addMessage('You have been defeated!', '#dc2626');
                }, 100); 
                // Reset game
                setTimeout(() => {
                    player.health = player.maxHealth;
                    player.mana = player.maxMana
                    player.x= spawn.x;
                    player.y= spawn.y;
                    updateUI();
                    addMessage('You wake up back at the entrance...', '#fbbf24');
                    gameLoop();
                }, 2000);
            }
        }
    }
}

function updateMobs() {
    const px = Math.floor(player.x);
    const py = Math.floor(player.y);
    
    for (let mob of mobs) {
        if (mob.health <= 0) continue;
        
        const mx = Math.floor(mob.x);
        const my = Math.floor(mob.y);
        
        // Only move if player is visible and nearby
        if (visibilityMap[my] && visibilityMap[my][mx] && dist(mx, my, px, py) < 15) {
            if (mob.stunned > 0) {
                mob.stunned--;
                continue;
            }
            
            // Simple pathfinding towards player - fix the typo here
            const angle = Math.atan2(py - my, px - mx);
            const dx = Math.cos(angle) * mob.speed;
            const dy = Math.sin(angle) * mob.speed;
            
            const nextX = mob.x + dx;
            const nextY = mob.y + dy;
            
            // Check collision
            if (map[Math.floor(nextY)][Math.floor(nextX)] === TILE_FLOOR) {
                // Check collision with other mobs
                let canMove = true;
                for (let other of mobs) {
                    if (other !== mob && other.health > 0) {
                        if (dist(nextX, nextY, other.x, other.y) < 0.8) {
                            canMove = false;
                            break;
                        }
                    }
                }
                
                if (canMove) {
                    mob.x = nextX;
                    mob.y = nextY;
                }
            }
        }
    }
    
    // Remove dead mobs
    mobs = mobs.filter(m => m.health > 0);
}

async function handleInteraction() {
    if (!keys['e'] && !keys['E']) return;
    
    const px = Math.floor(player.x);
    const py = Math.floor(player.y);
    
    // Check for chests
    for (let chest of chests) {
        if (!chest.opened && dist(px, py, chest.x, chest.y) < 1.5) {
            chest.opened = true;
            
            if (chest.loot === 'potion') {
                player.potions++;
                addMessage('🧪 Found a health potion!', '#10b981');
            }
            else if(chest.loot==='gold') {
                const goldAmount = Math.floor(Math.random() * 20) + 10;
                player.gold += goldAmount;
                addMessage('🪙 Found ' + goldAmount + ' gold!', '#fbbf24');
            }
            else if(chest.loot==='air') {
                addMessage('The chest is empty :(')
            }
            else if(chest.loot==='bomb') {
                let explosionAlpha = 1;
                let explosionActive = true;
                const explosionDamage = Math.floor(Math.random() * 25) + 10;
                player.health -= explosionDamage;
                addMessage(`💥 Explosion! -${explosionDamage} HP`, '#dc2626');
                updateUI();
                player.speed = 0.08
                // Slow down all particles (simulate flying debris)
                particles.forEach(p => {
                    p.vx *= 0.3;
                    p.vy *= 0.3;
                });
                
                // Explosion effect: fade white overlay
                (function fadeExplosion() {
                    if (!explosionActive) return;
                    ctx.save();
                    ctx.globalAlpha = explosionAlpha;
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                    ctx.restore();
                    explosionAlpha -= 0.03;
                    if (explosionAlpha > 0) {
                        requestAnimationFrame(fadeExplosion);
                    } else {
                        explosionActive = false;
                        updateStats('speed')
                    }
                })();
                addMessage('The chest was trapped! they are after your soul','#5f0000ff')
            }
            
            createParticle(chest.x, chest.y, '#fbbf24', '✨');
            updateUI();
            break
        }
    }
    for( let shop of shops){
        if(dist(player.x,player.y,shop.x,shop.y)<2){
            shopUi.classList.remove("hidden")
            renderShop()
        }
    }
    
    // Pick up loot
    lootItems = lootItems.filter(item => {
        if (dist(px, py, item.x, item.y) < 1.5) {
            if (item.type === 'potion') {
                player.potions++;
                addMessage('🧪 Picked up a health potion!', '#10b981');
            } 
            else if(item.type==='gold') {
                const goldAmount = Math.floor(Math.random() * 10) + 5;
                player.gold += goldAmount;
                addMessage('🪙 Picked up ' + goldAmount + ' gold!', '#fbbf24');
            }
            createParticle(item.x, item.y, '#fbbf24', '✨');
            updateUI();
            return false;
        }
        return true;
    });

    if(dist(px, py, exitLadder.x, exitLadder.y) < 1.5) {
        addMessage('You found the exit! Generating new dungeon...', '#34d399');
        await cancelAnimationFrame(game);
        setTimeout(() => {
            displayText('Generating new dungeon...');
            generateDungeon();
            updateUI();
            addMessage('A new dungeon awaits!', '#fbbf24');
            gameLoop();
        }, 0);    
    }
}

function usePotion() {
    if (player.potions > 0 && player.health < player.maxHealth) {
        player.potions--;
        const healAmount = Math.min(25+(Math.random()*8)-4, player.maxHealth - player.health);
        player.health += healAmount;
        addMessage('💊 Healed ' + Math.floor(healAmount) + ' HP!', '#10b981');
        createParticle(player.x, player.y, '#10b981', '+' + Math.floor(healAmount));
        updateUI();
    }
}

function update() {
    gameTime++;
    // Player movement with center-based bounding box collision
    const nextX = player.x + player.dx * player.speed;
    const nextY = player.y + player.dy * player.speed;
    const playerRadius = player.size / TILE_SIZE;
    let canMove = true;
    // Check four corners of the player's bounding box
    const corners = [
        { x: nextX - playerRadius, y: nextY - playerRadius },
        { x: nextX + playerRadius, y: nextY - playerRadius },
        { x: nextX - playerRadius, y: nextY + playerRadius },
        { x: nextX + playerRadius, y: nextY + playerRadius }
    ];
    for (const corner of corners) {
        const tileX = Math.floor(corner.x);
        const tileY = Math.floor(corner.y);
        if (isWall(tileX, tileY)) {
            canMove = false;
            break;
        }
    }

    if (canMove) {
        player.x = nextX;
        player.y = nextY;
    }

    // Camera lag
    camera.targetX = player.x * TILE_SIZE - CANVAS_WIDTH / 2;
    camera.targetY = player.y * TILE_SIZE - CANVAS_HEIGHT / 2;
    camera.x += (camera.targetX - camera.x) * CAMERA_LAG_FACTOR;
    camera.y += (camera.targetY - camera.y) * CAMERA_LAG_FACTOR;

    // Update visibility
    updateVisibility();
    
    if(player.health<player.maxHealth&&Math.random()<0.001){
        player.health+=player.regeneration
        updateUI();
    }


    // Update game systems
    updateMobs();
    handleCombat();
    handleInteraction();
    
    // Update particles
    particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.01;
        p.life--;
        return p.life > 0;
    });
}

function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const offsetX = -camera.x;
    const offsetY = -camera.y;

    // Draw map tiles
    const startCol = Math.floor(camera.x / TILE_SIZE);
    const endCol = Math.floor((camera.x + CANVAS_WIDTH) / TILE_SIZE) + 1;
    const startRow = Math.floor(camera.y / TILE_SIZE);
    const endRow = Math.floor((camera.y + CANVAS_HEIGHT) / TILE_SIZE) + 1;
    for (let y = startRow; y <= endRow; y++) {
        if (y < 0 || y >= MAP_HEIGHT) continue;
        for (let x = startCol; x <= endCol; x++) {
            if (x < 0 || x >= MAP_WIDTH) continue;

            const tile = map[y][x];

            // Always draw if explored or visible
            if (!exploredMap[y][x] && !visibilityMap[y][x]) continue;

            let color;
            if (visibilityMap[y][x]) {
            // Currently visible
            switch (tile) {
                case TILE_WALL:
                color = '#6b7280';
                break;
                case TILE_FLOOR:
                color = '#374151';
                break;
                case TILE_DOOR:
                color = '#dc2626'; // Red for doors
                break;
                default:
                color = '#374151';
            }
            } else if (exploredMap[y][x]) {
            // Previously explored
            switch (tile) {
                case TILE_WALL:
                color = '#111827';
                break;
                case TILE_FLOOR:
                color = '#1f2937';
                break;
                case TILE_DOOR:
                color = '#7f1d1d'; // Dark red for explored doors
                break;
                default:
                color = '#1f2937';
            }
            } else {
            continue;
            }
            ctx.fillStyle = color;
            ctx.fillRect(x * TILE_SIZE + offsetX, y * TILE_SIZE + offsetY, TILE_SIZE, TILE_SIZE);
        }
    }



    // let rays=7200
    // ctx.strokeStyle = 'rgba(255, 0, 0, 0.1)';
    // const px = player.x
    // const py = player.y
    // for(let i=0; i < rays; i++){
    //     const angle = (i / rays) * Math.PI * 2;
    //     const endX = Math.floor(px + Math.cos(angle) * VISION_RANGE);
    //     const endY = Math.floor(py + Math.sin(angle) * VISION_RANGE);
    //     ctx.beginPath();
    //     ctx.moveTo(px * TILE_SIZE + offsetX, py * TILE_SIZE + offsetY);
    //     ctx.lineTo(endX * TILE_SIZE + offsetX, endY * TILE_SIZE + offsetY);
    //     ctx.stroke();
    // }

    
    // Draw chests
    for (let chest of chests) {
        const floatY = Math.sin(gameTime * 0.1) * TILE_SIZE/4;
        if (!visibilityMap[Math.floor(chest.y)][Math.floor(chest.x)]) continue;
        
        ctx.fillStyle = chest.opened ? '#6b7280' : '#d97706';
        ctx.fillRect(
            chest.x * TILE_SIZE + offsetX + 2,
            chest.y * TILE_SIZE + offsetY + 2,
            TILE_SIZE - 4,
            TILE_SIZE - 4
        );
        if(chest.opened) continue;
        
        // Draw chest icon
        ctx.fillStyle = '#000';
        ctx.font = '10px Arial';
        ctx.fillText('📦', chest.x * TILE_SIZE + offsetX , chest.y * TILE_SIZE + offsetY - floatY+TILE_SIZE/2);
    }
    // Draw shops
    for (let shop of shops) {
        if (!visibilityMap[Math.floor(shop.y)][Math.floor(shop.x)]) continue;

        ctx.fillStyle = '#2563eb';
        ctx.fillRect(
            shop.x * TILE_SIZE + offsetX + 2,
            shop.y * TILE_SIZE + offsetY + 2,
            TILE_SIZE - 4,
            TILE_SIZE - 4
        );

        ctx.drawImage(shopimg,(shop.x-1)*TILE_SIZE + offsetX,(shop.y-1)*TILE_SIZE + offsetY,TILE_SIZE*2,TILE_SIZE*2)
    }

    // Draw loot
    for (let item of lootItems) {
        if (!visibilityMap[Math.floor(item.y)][Math.floor(item.x)]) continue;
        
        // Floating animation
        const floatY = Math.sin(gameTime * 0.1) * 2;
        
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(
            item.x * TILE_SIZE + offsetX + TILE_SIZE/2,
            item.y * TILE_SIZE + offsetY + TILE_SIZE/2 + floatY,
            4, 0, Math.PI * 2
        );
        ctx.fill();
    }
    // Draw exit ladder
    if (visibilityMap[Math.floor(exitLadder.y)][Math.floor(exitLadder.x)]) {
        ctx.fillStyle = '#34d399';
        ctx.fillRect(
            exitLadder.x * TILE_SIZE + offsetX + 2,
            exitLadder.y * TILE_SIZE + offsetY + 2,
            TILE_SIZE - 4,
            TILE_SIZE - 4
        );
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            '🪜',
            exitLadder.x * TILE_SIZE + offsetX + TILE_SIZE / 2,
            exitLadder.y * TILE_SIZE + offsetY + TILE_SIZE / 2
        );
    }
    
    // Draw mobs
    for (let mob of mobs) {
        if (!visibilityMap[Math.floor(mob.y)][Math.floor(mob.x)]) continue;

        // Draw troll emoji for mob
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            '🧌',
            mob.x * TILE_SIZE + offsetX ,
            mob.y * TILE_SIZE + offsetY 
        );

        // Health bar
        if (mob.health < mob.maxHealth) {
            ctx.fillStyle = '#000';
            ctx.fillRect(
                mob.x * TILE_SIZE + offsetX-TILE_SIZE/2,
                mob.y * TILE_SIZE + offsetY+TILE_SIZE/2 ,
                TILE_SIZE, 2
            );
            ctx.fillStyle = '#dc2626';
            ctx.fillRect(
                mob.x * TILE_SIZE + offsetX-TILE_SIZE/2,
                mob.y * TILE_SIZE + offsetY+TILE_SIZE/2 ,
                TILE_SIZE * (mob.health / mob.maxHealth), 2
            );
        }
    }

    // Draw player
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(
        player.x * TILE_SIZE + offsetX ,
        player.y * TILE_SIZE + offsetY ,
        player.size,
        0, Math.PI * 2
    );
    ctx.fill();
    // Draw attack indicator
    if (player.attackCooldown > 12) {
        let x = Math.cos(player.attackAngle)*TILE_SIZE*1.5
        let y = Math.sin(player.attackAngle)*TILE_SIZE*1.5
        slashSheet.drawAnimation(
            'slash',
            30-player.attackCooldown, 
            player.x * TILE_SIZE - camera.x + x,
            player.y * TILE_SIZE - camera.y + y,
            player.attackAngle + Math.PI / 2,
            0.5
        );   }
    
    // Draw particles
    for (let p of particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 30;
        
        if (p.text) {
            ctx.font = 'bold 12px Arial';
            ctx.fillText(
                p.text,
                p.x * TILE_SIZE + offsetX,
                p.y * TILE_SIZE + offsetY
            );
        } else {
            ctx.fillRect(
                p.x * TILE_SIZE + offsetX,
                p.y * TILE_SIZE + offsetY,
                2, 2
            );
        }
    }
    ctx.globalAlpha = 1;
    drawMessageLog(ctx, CANVAS_HEIGHT);
}
let lastTime = new Date();

function gameLoop() {
    game=requestAnimationFrame(gameLoop);
    update();
    draw();
    calculateFps()
}

// --- INPUT HANDLING ---

function handleKeyDown(e) {
    if(document.activeElement === input) return;
    keys[e.key] = true;

    if (e.key === 'q' || e.key === 'Q') {
        usePotion();
    }
    
    updatePlayerMovement();
}

function handleKeyUp(e) {
    if(document.activeElement === input) return;
    keys[e.key] = false;
    updatePlayerMovement();
}
function handleMouseDown(e) {
    if(e.target !== canvas) return;
    keys.mouse.x = e.offsetX;
    keys.mouse.y = e.offsetY;
    switch (e.button) {
        case 0: // Left click
            keys.mouse.left = true;
            break;
        case 2: // Right click
            keys.mouse.right = true;
            break;
    }
}

function handleMouseMove(e){
    keys.mouse.x = e.offsetX
    keys.mouse.y = e.offsetY
}

function handleMouseUp(e) {
    if(e.target !== canvas) return;
    keys.mouse.x = e.offsetX;
    keys.mouse.y = e.offsetY;
    switch (e.button) {
        case 0: // Left click
            keys.mouse.left = false;
            break;  
        case 2: // Right click
            keys.mouse.right = false;
            break;
    }
}
function updatePlayerMovement() {
    let dx = 0;
    let dy = 0;

    if (keys['ArrowUp'] || keys['w'] || keys['W']) dy = -1;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) dy = 1;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) dx = -1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) dx = 1;

    if (dx !== 0 && dy !== 0) {
        player.dx = dx * 0.707;
        player.dy = dy * 0.707;
    } else {
        player.dx = dx;
        player.dy = dy;
    }
}
// --- CHAT ---
addEventListener('keydown', function(event) {
    if (event.key === '/') {
        input.style.display = 'block';
        input.focus();
    }
})
// Assuming 'input' is the text input field

input.addEventListener('keydown', function(event) {
    // Only proceed if the 'Enter' key was pressed
    if (event.key === 'Enter') {
        event.preventDefault(); // Prevents the default action, like a page refresh
        input.style.display="none";
        const message = input.value.trim();
        if (message) {
            if(message.startsWith('/')) {
                const parts = message.split(' ');
                const command = parts[0];
                const args = parts.slice(1);
                
                if(command === '/tp') {
                    const x = parseInt(args[0]);
                    const y = parseInt(args[1]);
                    if(args[0]=="exitLadder"){
                        player.x = exitLadder.x ;
                        player.y = exitLadder.y ;
                        addMessage(`Teleported to exit ladder at ${exitLadder.x},${exitLadder.y}!`, '#34d399');
                        return;
                    }

                    if(isNaN(x) || isNaN(y) || x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT || map[y][x] !== TILE_FLOOR) {
                        addMessage('Invalid coordinates.', '#f87171');
                    } else {
                        player.x = x ;
                        player.y = y ;
                        addMessage(`Teleported to ${x},${y}!`, '#34d399');
                    }
                } else {
                    addMessage('Command not recognized.', '#f87171');
                }
            } else {
                addMessage('You: ' + message, '#3b82f6');
            }
            input.value = '';
        }
        input.style.display = 'none';
        canvas.focus();
    }
});


// --- INITIALIZATION ---

function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    generateDungeon();

    camera.x = player.x * TILE_SIZE - CANVAS_WIDTH / 2;
    camera.y = player.y * TILE_SIZE - CANVAS_HEIGHT / 2;
    camera.targetX = camera.x;
    camera.targetY = camera.y;

    addEventListener('keydown', handleKeyDown);
    addEventListener('keyup', handleKeyUp);
    addEventListener('mousedown', handleMouseDown);
    addEventListener('mousemove', handleMouseMove);
    addEventListener('mouseup', handleMouseUp);
    attackBtn.addEventListener('touchstart',()=>{player.attacking = true})
    attackBtn.addEventListener('touchend',()=>{player.attacking=false})
    interactBtn.addEventListener('touchstart',()=>{keys['e']=true})
    interactBtn.addEventListener('touchend',()=>{keys['e']=false})

    addMessage('Welcome to the Whispering Depths!', '#fbbf24');
    addMessage('Press Q to use potions', '#10b981');

    updateUI();
    
    gameLoop();
}
let shopimg;

window.onload = async ()=>{
    init();
    renderShop();
    shopimg = await loadImage('shop.png')

    if(isMobileUserAgent()){
        document.getElementById("gametitle").classList.add("hidden")
        document.getElementById("joystick-container").style.display="flex"
        document.body.classList.add("flex-row","justify-around")
        document.getElementById("interact-buttons").classList.remove("hidden")
        let newsizenow;
        if(window.innerWidth>window.innerHeight){
            newsizenow = window.innerHeight-8
        }else{
            newsizenow = window.innerWidth-8
        }
        canvas.height = newsizenow
        canvas.width = newsizenow
        CANVAS_HEIGHT = newsizenow
        CANVAS_WIDTH = newsizenow
    }
    
    containerRect = container.getBoundingClientRect();
    centerX = containerRect.left + containerRect.width / 2;
    centerY = containerRect.top + containerRect.height / 2;
    maxRadius = (containerRect.width / 2) - (handle.clientWidth / 2);
    document.body.style.minHeight = (window.innerHeight + 1) + 'px';
    window.scrollTo(0, 1);

};

window.addEventListener('resize', () => {
    window.scrollTo(0, 1);
});