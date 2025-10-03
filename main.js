// --- CORE CONFIGURATION ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const TILE_SIZE = 12;
const MAP_WIDTH = 100;
const MAP_HEIGHT = 100;
const MOVEMENT_SPEED = 0.15;
const VISION_RANGE = 8;
const CAMERA_LAG_FACTOR = 0.12;

// Tile types
const TILE_FLOOR = 0;
const TILE_WALL = 1;

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
    health: 100, 
    maxHealth: 100,
    damage: 10,
    potions: 0,
    gold: 0,
    attackCooldown: 0,
    color: '#3b82f6',
    size: TILE_SIZE * 0.4,
};
let exitLadder;
let camera = { x: 0, y: 0, targetX: 0, targetY: 0 };
let keys = {};
// Game entities
let chests = [];
let mobs = [];
let lootItems = [];
let particles = [];
let game;
let gameTime = 0;
let messages = [];
const spawn = {};
const MESSAGE_TIMEOUT_MS = 5000;
const input = document.getElementById('chatInput'); 
// --- UTILITY FUNCTIONS ---

// Function to check if a tile is a wall
function isWall(tileX, tileY) {
    // Check bounds first to prevent errors
    if (tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT) {
        return true; // Treat out-of-bounds as a wall
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
    document.getElementById('health').textContent = Math.max(0, Math.floor(player.health));
    document.getElementById('healthBar').style.width = (player.health / player.maxHealth * 100) + '%';
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
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;
    
    while (true) {
        // Mark as visible
        if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) {
            visibilityMap[y][x] = true;
            exploredMap[y][x] = true;
            
            // Stop at walls (but still mark the wall as visible)
            if (map[y][x] === TILE_WALL) {
                return;
            }
        }
        
        if (x === x1 && y === y1) break;
        
        const e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            x += sx;
        }
        if (e2 < dx) {
            err += dx;
            y += sy;
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
    
    const px = Math.floor(player.x);
    const py = Math.floor(player.y);
    
    // Cast rays in a circle
    const numRays = 72;
    for (let i = 0; i < numRays; i++) {
        const angle = (i / numRays) * Math.PI * 2;
        const endX = Math.floor(px + Math.cos(angle) * VISION_RANGE);
        const endY = Math.floor(py + Math.sin(angle) * VISION_RANGE);
        castRay(px, py, endX, endY);
    }
}

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
    for (let i = 1; i < rooms.length; i++) {
        if (Math.random() < 0.4) { // 40% chance per room
            const room = rooms[i];
            chests.push({
                x: room.x + Math.floor(Math.random() * 3) - 1,
                y: room.y + Math.floor(Math.random() * 3) - 1,
                opened: false,
                loot: Math.random() < 0.5 ? 'potion' : 'gold'
            });
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
    if (keys[' '] && player.attackCooldown <= 0) {
        player.attackCooldown = 30;
        
        // Check for nearby mobs
        const px = Math.floor(player.x);
        const py = Math.floor(player.y);
        
        for (let mob of mobs) {
            const mx = Math.floor(mob.x);
            const my = Math.floor(mob.y);
            
            if (dist(px, py, mx, my) < 2) {
                mob.health -= player.damage;
                mob.stunned = 15; // Knockback stun
                
                // Knockback
                const angle = Math.atan2(my - py, mx - px);
                mob.x += Math.cos(angle) * 0.5;
                mob.y += Math.sin(angle) * 0.5;
                
                createParticle(mob.x, mob.y, '#dc2626', '-' + player.damage);
                
                if (mob.health <= 0) {
                    // Drop loot
                    if (Math.random() < 0.3) {
                        lootItems.push({
                            x: mob.x,
                            y: mob.y,
                            type: Math.random() < 0.7 ? 'gold' : 'potion'
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
            } else {
                const goldAmount = Math.floor(Math.random() * 20) + 10;
                player.gold += goldAmount;
                addMessage('🪙 Found ' + goldAmount + ' gold!', '#fbbf24');
            }
            
            createParticle(chest.x, chest.y, '#fbbf24', '✨');
            updateUI();
        }
    }
    
    // Pick up loot
    lootItems = lootItems.filter(item => {
        if (dist(px, py, item.x, item.y) < 1.5) {
            if (item.type === 'potion') {
                player.potions++;
                addMessage('🧪 Picked up a health potion!', '#10b981');
            } else {
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
        const healAmount = Math.min(50, player.maxHealth - player.health);
        player.health += healAmount;
        addMessage('💊 Healed ' + healAmount + ' HP!', '#10b981');
        createParticle(player.x, player.y, '#10b981', '+' + healAmount);
        updateUI();
    }
}

function update() {
    gameTime++;
    // Player movement with center-based bounding box collision
    const nextX = player.x + player.dx * MOVEMENT_SPEED;
    const nextY = player.y + player.dy * MOVEMENT_SPEED;
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
                color = tile === TILE_WALL ? '#6b7280' : '#374151';
            } else if (exploredMap[y][x]) {
                // Previously explored
                color = tile === TILE_WALL ? '#111827' : '#1f2937';
            } else {
                continue;
            }
            ctx.fillStyle = color;
            ctx.fillRect(x * TILE_SIZE + offsetX, y * TILE_SIZE + offsetY, TILE_SIZE, TILE_SIZE);
        }
    }





    
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
    if (player.attackCooldown > 25) {
        ctx.strokeStyle = 'rgba(252, 163, 17, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
            player.x * TILE_SIZE + offsetX ,
            player.y * TILE_SIZE + offsetY ,
            TILE_SIZE * 2,
            0, Math.PI * 2
        );
        ctx.stroke();
    }
    
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

function gameLoop() {
    game=requestAnimationFrame(gameLoop);
    update();
    draw();
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
    
    addMessage('Welcome to the Whispering Depths!', '#fbbf24');
    addMessage('Press Q to use potions', '#10b981');

    updateUI();
    
    gameLoop();
}

window.onload = init;
