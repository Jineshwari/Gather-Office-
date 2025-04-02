import collisions from './collisions.js';

const socket = io();
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const playerNameInput = document.getElementById("playerNameInput");
const playerCountDisplay = document.getElementById("playerCount");

// Constants
const CANVAS_WIDTH = 1550;
const CANVAS_HEIGHT = 700;
const INTERACTION_RANGE = 50;
const BOUNDARY_SIZE = 32;
const FRAME_DELAY = 10; // Animation frame delay
const TUTORIAL_DURATION = 5000; // 5 seconds
const DIALOGUE_DURATION = 4000; // 4 seconds for automatic dialogue

// Set canvas size
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

class Sprite {
    constructor({ position, image, frames = { max: 1 }, sprites = {}, name = "", id = null }) {
        this.position = position;
        this.image = image;
        this.frames = frames;
        this.sprites = sprites;
        this.name = name;
        this.id = id;
        this.width = 30;
        this.height = 30;
        this.speed = 3;
        this.frameIndex = 0;
        this.frameCount = 0;
        this.moving = false;
        this.lastDirection = "down";
        this.showInteractionMenu = false;
        this.interactingWith = null;
        this.dialogue = null;
        this.dialogueTimer = 0;
    }

    draw() {
        const frameWidth = this.image.width / this.frames.max;
        ctx.drawImage(
            this.image,
            this.frameIndex * frameWidth, 0, frameWidth, this.image.height,
            this.position.x, this.position.y, this.width, this.height
        );

        // Animate frames only when moving
        if (this.moving && ++this.frameCount % FRAME_DELAY === 0) {
            this.frameIndex = (this.frameIndex + 1) % this.frames.max;
        } else if (!this.moving) {
            this.frameIndex = 0;
        }

        if (this.name) this.drawNameTag();
        if (this.dialogue) this.drawDialogue();
    }

    drawNameTag() {
        ctx.font = "12px Arial";
        ctx.textAlign = "center";

        const textWidth = ctx.measureText(this.name).width;
        const padding = 4;
        const bgX = this.position.x + this.width / 2 - textWidth / 2 - padding;
        const bgY = this.position.y - 20;
        const bgWidth = textWidth + padding * 2;
        const bgHeight = 18;

        // Background for the name tag
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(bgX, bgY, bgWidth, bgHeight);

        // Name text
        ctx.fillStyle = "white";
        ctx.fillText(this.name, this.position.x + this.width / 2, this.position.y - 8);
    }

    drawDialogue() {
        // Check if dialogue has expired
        if (this.dialogueTimer && Date.now() > this.dialogueTimer) {
            this.dialogue = null;
            this.dialogueTimer = 0;
            return;
        }

        const maxWidth = 150;
        const lineHeight = 15;
        const lines = this.wrapText(this.dialogue, maxWidth - 10);
        
        const bubbleHeight = lineHeight * lines.length + 15;
        const bubbleWidth = maxWidth;
        const bubbleX = this.position.x - bubbleWidth / 2 + this.width / 2;
        const bubbleY = this.position.y - bubbleHeight - 25;
        
        // Draw speech bubble background
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        this.drawRoundedRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 8);
        
        // Draw bubble border
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Draw pointer
        const pointerX = bubbleX + bubbleWidth / 2;
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.beginPath();
        ctx.moveTo(pointerX - 8, bubbleY + bubbleHeight);
        ctx.lineTo(pointerX + 8, bubbleY + bubbleHeight);
        ctx.lineTo(pointerX, bubbleY + bubbleHeight + 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Draw text
        ctx.fillStyle = "#333";
        ctx.font = "12px Arial";
        ctx.textAlign = "left";
        
        lines.forEach((line, i) => {
            ctx.fillText(line, bubbleX + 8, bubbleY + 15 + (i * lineHeight));
        });
    }
    
    wrapText(text, maxWidth) {
        if (!text) return [];
        
        const words = text.split(' ');
        const lines = [];
        let currentLine = words[0];
        
        ctx.font = "12px Arial";
        
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(currentLine + " " + word).width;
            
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        
        lines.push(currentLine);
        return lines;
    }
    
    drawRoundedRect(x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
    }
    
    showDialogue(text, duration = DIALOGUE_DURATION) {
        this.dialogue = text;
        this.dialogueTimer = Date.now() + duration;
    }

    setDirection(direction) {
        if (this.lastDirection !== direction) {
            this.image = this.sprites[direction] || this.image;
            this.lastDirection = direction;
        }
    }
}

class Boundary {
    constructor({ x, y }) {
        this.x = x;
        this.y = y;
        this.width = BOUNDARY_SIZE - 5;
        this.height = BOUNDARY_SIZE - 10;
    }
    
    draw() {
        ctx.fillStyle = "rgba(255, 0, 0, 0)";
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

// New class for interaction menu
class InteractionMenu {
    constructor() {
        this.visible = false;
        this.targetId = null;
        this.position = { x: 0, y: 0 };
        this.selectedOption = null;
    }
    
    show(targetId, position) {
        this.visible = true;
        this.targetId = targetId;
        this.position = position;
        this.selectedOption = null;
    }
    
    hide() {
        this.visible = false;
        this.targetId = null;
        this.selectedOption = null;
    }
    
    draw() {
        if (!this.visible) return;
        
        const menuWidth = 90;
        const menuHeight = 60;
        const menuX = this.position.x - menuWidth / 2;
        const menuY = this.position.y - menuHeight - 15;
        
        // Draw menu background
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.beginPath();
        ctx.roundRect(menuX, menuY, menuWidth, menuHeight, 8);
        ctx.fill();
        
        // Draw menu border
        ctx.strokeStyle = "#4286f4";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw menu options
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        
        // Chat option
        const chatY = menuY + 22;
        if (this.selectedOption === 'chat') {
            ctx.fillStyle = "#4286f4";
            ctx.fillRect(menuX + 5, chatY - 14, menuWidth - 10, 18);
            ctx.fillStyle = "#ffffff";
        } else {
            ctx.fillStyle = "#333333";
        }
        ctx.fillText("Chat", menuX + menuWidth / 2, chatY);
        
        // Voice Chat option
        const voiceChatY = menuY + 45;
        if (this.selectedOption === 'voiceChat') {
            ctx.fillStyle = "#4286f4";
            ctx.fillRect(menuX + 5, voiceChatY - 14, menuWidth - 10, 18);
            ctx.fillStyle = "#ffffff";
        } else {
            ctx.fillStyle = "#333333";
        }
        ctx.fillText("Voice Chat", menuX + menuWidth / 2, voiceChatY);
        
        // Draw pointer
        const pointerX = menuX + menuWidth / 2;
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.beginPath();
        ctx.moveTo(pointerX - 8, menuY + menuHeight);
        ctx.lineTo(pointerX + 8, menuY + menuHeight);
        ctx.lineTo(pointerX, menuY + menuHeight + 8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#4286f4";
        ctx.stroke();
    }
    
    handleMouseMove(x, y) {
        if (!this.visible) return;
        
        // Convert screen coordinates to world coordinates
        const worldX = x / camera.zoom + camera.x;
        const worldY = y / camera.zoom + camera.y;
        
        const menuWidth = 90;
        const menuHeight = 60;
        const menuX = this.position.x - menuWidth / 2;
        const menuY = this.position.y - menuHeight - 15;
        
        // Check if mouse is over chat option
        if (worldX >= menuX + 5 && worldX <= menuX + menuWidth - 5 &&
            worldY >= menuY + 8 && worldY <= menuY + 26) {
            this.selectedOption = 'chat';
            canvas.style.cursor = 'pointer';
            return true;
        }
        
        // Check if mouse is over voice chat option
        if (worldX >= menuX + 5 && worldX <= menuX + menuWidth - 5 &&
            worldY >= menuY + 31 && worldY <= menuY + 49) {
            this.selectedOption = 'voiceChat';
            canvas.style.cursor = 'pointer';
            return true;
        }
        
        this.selectedOption = null;
        canvas.style.cursor = 'default';
        return false;
    }
    
    handleClick() {
        if (!this.visible || !this.selectedOption) return false;
        
        if (this.selectedOption === 'chat') {
            console.log("Chat option selected with player: " + this.targetId);
            // You would implement actual chat functionality here
            if (otherPlayers[this.targetId]) {
                otherPlayers[this.targetId].showDialogue("Chat option selected");
            }
        } else if (this.selectedOption === 'voiceChat') {
            console.log("Voice Chat option selected with player: " + this.targetId);
            // You would implement actual voice chat functionality here
            if (otherPlayers[this.targetId]) {
                otherPlayers[this.targetId].showDialogue("Voice Chat option selected");
            }
        }
        
        this.hide();
        return true;
    }
}

// Load assets with a helper function
function loadImage(src) {
    const img = new Image();
    img.src = src;
    return img;
}

// Load all images
const mapImage = loadImage("images/map2.png");
const backgroundImage = loadImage("images/background.png");
const playerImages = {
    down: loadImage('images/playerDown.png'),
    up: loadImage('images/playerUp.png'),
    left: loadImage('images/playerLeft.png'),
    right: loadImage('images/playerRight.png')
};

// Game state
const otherPlayers = {};
let player;
let bgPattern;
const mapBounds = { width: 1024, height: 576 };
const camera = { x: 0, y: 0, zoom: 1.5 };
const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, e: false };
const playerProximityState = {}; // Track which players are nearby
const interactionMenu = new InteractionMenu(); // Create interaction menu instance

// Dialogue options
const greetings = [
    "Hi there!",
    "Hello!",
    "Hey, how's it going?",
    "Nice to meet you!",
    "Good to see you!"
];

const farewells = [
    "See you later!",
    "Goodbye!",
    "Take care!",
    "Until next time!",
    "Catch you later!"
];

// Movement directions lookup
const movementDirections = [
    { key: 'ArrowUp', dx: 0, dy: -1, dir: 'up' },
    { key: 'ArrowDown', dx: 0, dy: 1, dir: 'down' },
    { key: 'ArrowLeft', dx: -1, dy: 0, dir: 'left' },
    { key: 'ArrowRight', dx: 1, dy: 0, dir: 'right' }
];

// Create boundaries from collision data
const boundaries = [];
collisions.forEach((row, i) => {
    row.forEach((cell, j) => {
        if (cell === 1) {
            boundaries.push(new Boundary({
                x: j * BOUNDARY_SIZE,
                y: i * BOUNDARY_SIZE
            }));
        }
    });
});

// Event listeners
window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    if (e.key === 'e' || e.key === 'E') {
        checkPlayerInteraction();
    }
});

window.addEventListener("keyup", (e) => keys[e.key] = false);

canvas.addEventListener("mousemove", (e) => {
    // Get mouse position relative to canvas
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Check if mouse is over interaction menu
    const overMenu = interactionMenu.handleMouseMove(mouseX, mouseY);
    
    // Only reset cursor if not over menu
    if (!overMenu) {
        canvas.style.cursor = 'default';
    }
});

canvas.addEventListener("click", (e) => {
    // Handle interaction menu clicks
    interactionMenu.handleClick();
});

playerNameInput.addEventListener("change", () => {
    const newName = playerNameInput.value.trim() || `Player-${socket.id.substr(0, 4)}`;
    player.name = newName;
    socket.emit('updateName', newName);
});

// Setup the background pattern when loaded
backgroundImage.onload = () => {
    bgPattern = ctx.createPattern(backgroundImage, 'repeat');
};

// Utility Functions
function createPlayerSprite({ position, direction, name, id }) {
    return new Sprite({
        position,
        image: playerImages[direction] || playerImages.down,
        frames: { max: 4 },
        sprites: playerImages,
        name,
        id
    });
}

function checkCollision(x, y) {
    return boundaries.some(boundary =>
        x < boundary.x + boundary.width &&
        x + player.width > boundary.x &&
        y < boundary.y + boundary.height &&
        y + player.height > boundary.y
    );
}

function calculateDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function getRandomDialogue(options) {
    return options[Math.floor(Math.random() * options.length)];
}

function checkPlayerInteraction() {
    if (!player) return;

    // Hide menu if it's already visible
    if (interactionMenu.visible) {
        interactionMenu.hide();
        return;
    }

    const nearbyPlayer = Object.entries(otherPlayers).find(([id, otherPlayer]) => 
        calculateDistance(player.position, otherPlayer.position) <= INTERACTION_RANGE
    );

    if (nearbyPlayer) {
        const [id, otherPlayer] = nearbyPlayer;
        
        // Calculate the center position of the other player 
        const centerX = otherPlayer.position.x + otherPlayer.width / 2;
        const centerY = otherPlayer.position.y;
        
        // Show interaction menu above the other player
        interactionMenu.show(id, { x: centerX, y: centerY });
        
        // Show greeting dialogue
        player.showDialogue(getRandomDialogue(greetings), DIALOGUE_DURATION);
        
        // Have the other player respond after a short delay
        setTimeout(() => {
            if (otherPlayers[id]) {
                otherPlayers[id].showDialogue(getRandomDialogue(greetings), DIALOGUE_DURATION);
            }
        }, 1000);
        
        socket.emit('playerInteraction', { targetId: id });
    }
}

function checkNearbyPlayers() {
    if (!player) return;

    let hint = document.getElementById('interaction-hint');
    let hasAnyNearbyPlayer = false;
    
    // Check each player's proximity and update state
    Object.entries(otherPlayers).forEach(([id, otherPlayer]) => {
        const distance = calculateDistance(player.position, otherPlayer.position);
        const wasNearby = playerProximityState[id] || false;
        const isNearby = distance <= INTERACTION_RANGE;
        
        // Update the tracking state
        playerProximityState[id] = isNearby;
        
        // If player state changed from not nearby to nearby
        if (!wasNearby && isNearby) {
            // New player entered proximity - show greeting
            otherPlayer.showDialogue(getRandomDialogue(greetings));
        } 
        // If player state changed from nearby to not nearby
        else if (wasNearby && !isNearby) {
            // Player left proximity - show farewell
            otherPlayer.showDialogue(getRandomDialogue(farewells));
            
            // If interaction menu is open for this player, close it
            if (interactionMenu.visible && interactionMenu.targetId === id) {
                interactionMenu.hide();
            }
        }
        
        if (isNearby) hasAnyNearbyPlayer = true;
    });

    // Update the interaction hint
    if (hasAnyNearbyPlayer) {
        if (!hint) {
            hint = Object.assign(document.createElement('div'), {
                id: 'interaction-hint',
                textContent: 'Press E to interact',
                style: `
                    position: fixed;
                    bottom: 50px;
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: rgba(0,0,0,0.7);
                    color: white;
                    padding: 5px 10px;
                    border-radius: 3px;
                    font-size: 12px;
                    z-index: 999;
                `
            });
            document.body.appendChild(hint);
        }
    } else if (hint) {
        hint.remove();
    }
}

function updatePlayerCount() {
    const count = 1 + Object.keys(otherPlayers).length;
    playerCountDisplay.textContent = `Players: ${count}`;
}

function showNameInputDialog() {
    if (document.getElementById('name-input-modal')) return;

    const modal = Object.assign(document.createElement('div'), {
        id: 'name-input-modal',
        style: `
            position: fixed;
            inset: 0;
            background-color: rgba(0,0,0,0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `
    });

    const dialog = Object.assign(document.createElement('div'), {
        style: `
            background-color: white;
            padding: 30px;
            border-radius: 10px;
            width: 300px;
            text-align: center;
        `
    });

    const title = Object.assign(document.createElement('h2'), {
        textContent: 'Welcome to the Game!',
        style: 'margin-bottom: 20px; color: #333;'
    });

    const input = Object.assign(document.createElement('input'), {
        type: 'text',
        placeholder: `Player-${socket.id ? socket.id.substring(0, 4) : 'New'}`,
        style: `
            width: 90%;
            padding: 8px;
            margin-bottom: 20px;
            border-radius: 4px;
            border: 1px solid #ccc;
        `
    });

    const button = Object.assign(document.createElement('button'), {
        textContent: 'Start Playing!',
        style: `
            padding: 10px 20px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        `,
        onclick: () => {
            const playerName = input.value.trim() || input.placeholder;
            if (player) {
                player.name = playerName;
                playerNameInput.value = playerName;
                socket.emit('updateName', playerName);
            }
            modal.remove();
        }
    });

    input.addEventListener('keypress', (e) => e.key === 'Enter' && button.click());

    dialog.append(title, input, button);
    modal.appendChild(dialog);
    document.body.appendChild(modal);

    setTimeout(() => input.focus(), 100);
}

function showInteractionTutorial() {
    if (document.getElementById('interaction-tutorial')) return;

    const tutorial = Object.assign(document.createElement('div'), {
        id: 'interaction-tutorial',
        style: `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: rgba(0,0,0,0.7);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            text-align: center;
            z-index: 999;
        `,
        innerHTML: 'Press <strong>E</strong> to interact with nearby players'
    });

    document.body.appendChild(tutorial);
    setTimeout(() => tutorial.remove(), TUTORIAL_DURATION);
}

// Socket.io Event Handlers
socket.on('currentPlayers', (players) => {
    const playerInfo = players[socket.id];
    
    if (playerInfo) {
        player = createPlayerSprite(playerInfo);
        playerNameInput.value = playerInfo.name;
        
        // Add other existing players
        Object.keys(players).forEach((id) => {
            if (id !== socket.id) {
                otherPlayers[id] = createPlayerSprite(players[id]);
            }
        });
        
        updatePlayerCount();
        showNameInputDialog();
        setTimeout(showInteractionTutorial, 3000);
    }
});

socket.on('newPlayer', (playerInfo) => {
    const newPlayer = createPlayerSprite(playerInfo);
    otherPlayers[playerInfo.id] = newPlayer;
    
    // Show welcome dialogue for new player
    if (player) {
        // Wait a moment for the player to fully join
        setTimeout(() => {
            newPlayer.showDialogue(`Hello, I'm ${playerInfo.name}!`);
        }, 1500);
    }
    
    updatePlayerCount();
});

socket.on('playerMoved', (playerInfo) => {
    const otherPlayer = otherPlayers[playerInfo.id];
    if (otherPlayer) {
        otherPlayer.position = playerInfo.position;
        otherPlayer.setDirection(playerInfo.direction);
        otherPlayer.moving = playerInfo.moving;
    }
});

socket.on('playerUpdated', (playerInfo) => {
    const previousName = playerInfo.id === socket.id ? 
        player?.name : 
        otherPlayers[playerInfo.id]?.name;
    
    if (playerInfo.id === socket.id) {
        if (player) player.name = playerInfo.name;
    } else if (otherPlayers[playerInfo.id]) {
        // Handle name change for other players
        const otherPlayer = otherPlayers[playerInfo.id];
        
        // If the name actually changed, show a dialogue
        if (previousName && previousName !== playerInfo.name) {
            otherPlayer.showDialogue(`I changed my name from ${previousName} to ${playerInfo.name}!`);
        }
        
        otherPlayer.name = playerInfo.name;
    }
});

socket.on('playerDisconnected', (playerId) => {
    // Show goodbye message if the player was nearby
    if (playerProximityState[playerId] && player) {
        const disconnectedName = otherPlayers[playerId]?.name || "Someone";
        player.showDialogue(`${disconnectedName} has left the game.`);
    }
    
    // If interaction menu is open for this player, close it
    if (interactionMenu.visible && interactionMenu.targetId === playerId) {
        interactionMenu.hide();
    }
    
    delete otherPlayers[playerId];
    delete playerProximityState[playerId];
    updatePlayerCount();
});

socket.on('playerInteractionResponse', (data) => {
    // Handler for server-side interaction responses
    // This could be expanded for custom dialogues or chat messages
    if (data && data.message && otherPlayers[data.fromId]) {
        otherPlayers[data.fromId].showDialogue(data.message);
    }
});

// Game Loop
function animate() {
    requestAnimationFrame(animate);

    // Only proceed if player is initialized
    if (!player) return;

    // Save current transformation state
    ctx.save();
    
    // Apply camera transform
    ctx.setTransform(camera.zoom, 0, 0, camera.zoom, -camera.x * camera.zoom, -camera.y * camera.zoom);
    
    // Draw repeating background pattern first
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform temporarily
    
    // Fill the entire visible canvas with the background pattern
    if (bgPattern) {
        ctx.fillStyle = bgPattern;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        // Fallback if pattern isn't loaded
        ctx.fillStyle = '#a5d6a7'; // Light green background
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Restore the camera transform
    ctx.restore();
    
    // Draw the main map
    ctx.drawImage(mapImage, 0, 0, mapBounds.width, mapBounds.height);
    
    // Handle player movement
    player.moving = false;
    
    for (const { key, dx, dy, dir } of movementDirections) {
        if (keys[key]) {
            const newX = player.position.x + dx * player.speed;
            const newY = player.position.y + dy * player.speed;
            
            if (!checkCollision(newX, newY)) {
                player.position.x = newX;
                player.position.y = newY;
                player.setDirection(dir);
                player.moving = true;
                
                // Emit player position to server
                socket.emit('playerMovement', {
                    position: player.position,
                    direction: player.lastDirection,
                    moving: true
                });
                
                // Close interaction menu when moving
                if (interactionMenu.visible) {
                    interactionMenu.hide();
                }
                
                break; // Stop checking further if movement is detected
            }
        }
    }

    // Check for nearby players
    checkNearbyPlayers();

    // Update camera position to follow player
    camera.x = player.position.x - canvas.width / (2 * camera.zoom);
    camera.y = player.position.y - canvas.height / (2 * camera.zoom);

    // Draw all other players
    Object.values(otherPlayers).forEach(otherPlayer => {
        otherPlayer.draw();
    });
    
    // Draw the local player
    player.draw();
    
    // Draw interaction menu (on top of everything)
    interactionMenu.draw();

    // Restore the original transformation state
    ctx.restore();
}

// Start Game Loop when map is loaded
mapImage.onload = () => {
    if (socket.connected) {
        animate();
    } else {
        socket.on('connect', animate);
    }
};