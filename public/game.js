// Connect to the server using Socket.io
const socket = io();

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const playerNameInput = document.getElementById("playerNameInput");
const playerCountDisplay = document.getElementById("playerCount");

canvas.width = 1550;
canvas.height = 700;

// Add Sprite class definition
class Sprite {
    constructor({ position, image, frames = { max: 1 }, sprites = {}, name = "", id = null }) {
        this.position = position;
        this.image = image;
        this.frames = frames;
        this.sprites = sprites;
        this.width = 30; // Default player width
        this.height = 30; // Default player height
        this.speed = 3; // Player movement speed
        this.frameIndex = 0;
        this.frameCount = 0;
        this.moving = false;
        this.lastDirection = 'down'; // Default direction
        this.name = name; // Player name
        this.id = id; // Socket ID for multiplayer
    }

    draw() {
        const frameWidth = this.image.width / this.frames.max;
        ctx.drawImage(
            this.image,
            this.frameIndex * frameWidth,
            0,
            frameWidth,
            this.image.height,
            this.position.x,
            this.position.y,
            this.width,
            this.height
        );

        // Animate frames only when moving
        if (this.moving) {
            if (this.frameCount % 10 === 0) { // Control animation speed
                this.frameIndex = (this.frameIndex + 1) % this.frames.max;
            }
            this.frameCount++;
        } else {
            this.frameIndex = 0; // Reset to first frame when not moving
        }
        
        // Draw name tag if name exists
        if (this.name) {
            ctx.font = "12px Arial";
            ctx.fillStyle = "white";
            ctx.textAlign = "center";
            
            // Draw background for the name tag
            const textMeasure = ctx.measureText(this.name);
            const textWidth = textMeasure.width;
            const padding = 4;
            
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            ctx.fillRect(
                this.position.x + this.width/2 - textWidth/2 - padding,
                this.position.y - 20,
                textWidth + padding * 2,
                18
            );
            
            // Draw name text
            ctx.fillStyle = "white";
            ctx.fillText(
                this.name,
                this.position.x + this.width/2,
                this.position.y - 8
            );
        }
    }

    setDirection(direction) {
        if (this.lastDirection !== direction) {
            switch (direction) {
                case 'up':
                    this.image = this.sprites.up;
                    break;
                case 'down':
                    this.image = this.sprites.down;
                    break;
                case 'left':
                    this.image = this.sprites.left;
                    break;
                case 'right':
                    this.image = this.sprites.right;
                    break;
            }
            this.lastDirection = direction;
        }
    }
}

// Load assets
const mapImage = new Image();
mapImage.src = "images/map2.png";

// Add background image for edges
const backgroundImage = new Image();
backgroundImage.src = "images/background.png";

const playerDownImage = new Image();
playerDownImage.src = 'images/playerDown.png';

const playerUpImage = new Image();
playerUpImage.src = 'images/playerUp.png';

const playerLeftImage = new Image();
playerLeftImage.src = 'images/playerLeft.png';

const playerRightImage = new Image();
playerRightImage.src = 'images/playerRight.png';

// Store all player sprites (including other players)
const otherPlayers = {};

// Create player with proper properties
let player;

// Define offset for background positioning
const offset = {
    x: 0,
    y: 0
};

// Create background with proper variables
const background = new Sprite({
    position: {
        x: offset.x,
        y: offset.y
    },
    image: mapImage
});

// Define map bounds - set these to match your map's exact dimensions
const mapBounds = {
    width: 1024,
    height: 576
};

const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
};

window.addEventListener("keydown", (e) => keys[e.key] = true);
window.addEventListener("keyup", (e) => keys[e.key] = false);

// Update player name when input changes
playerNameInput.addEventListener("change", () => {
    const newName = playerNameInput.value.trim() || `Player-${socket.id.substr(0, 4)}`;
    player.name = newName;
    socket.emit('updateName', newName);
});

// *Boundary Class*
class Boundary {
    static size = 32; 
    constructor({ x, y }) {
        this.x = x;
        this.y = y;
        this.width = Boundary.size - 5;
        this.height = Boundary.size -10;
    }
    draw() {
        ctx.fillStyle = "rgba(255, 0, 0, 0)";
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

// *Collision Map*
const collisions = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
    [1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
    [1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

const boundaries = [];
const offsetX = 0, offsetY = 0;

collisions.forEach((row, i) => {
    row.forEach((cell, j) => {
        if (cell === 1) {
            boundaries.push(new Boundary({
                x: j * Boundary.size + offsetX,
                y: i * Boundary.size + offsetY
            }));
        }
    });
});

// *Collision Detection*
function checkCollision(x, y) {
    return boundaries.some(boundary =>
        x < boundary.x + boundary.width &&
        x + player.width > boundary.x &&
        y < boundary.y + boundary.height &&
        y + player.height > boundary.y
    );
}

// *Camera Variables*
let camera = {
    x: 0,
    y: 0,
    zoom: 1.5 // Adjust zoom level
};

// Function to create a pattern from the background image
let bgPattern;
backgroundImage.onload = () => {
    bgPattern = ctx.createPattern(backgroundImage, 'repeat');
};

// Utility function to create a new player sprite
function createPlayerSprite(playerInfo) {
    return new Sprite({
        position: playerInfo.position,
        image: playerInfo.direction === 'up' ? playerUpImage :
               playerInfo.direction === 'left' ? playerLeftImage :
               playerInfo.direction === 'right' ? playerRightImage :
               playerDownImage,
        frames: { max: 4 },
        sprites: {
            up: playerUpImage,
            down: playerDownImage,
            left: playerLeftImage,
            right: playerRightImage
        },
        name: playerInfo.name,
        id: playerInfo.id
    });
}

// *Socket.io Event Handlers*
socket.on('currentPlayers', (players) => {
    // Create the local player
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
        
        // Update player count
        updatePlayerCount();
    }
});

socket.on('newPlayer', (playerInfo) => {
    otherPlayers[playerInfo.id] = createPlayerSprite(playerInfo);
    updatePlayerCount();
});

socket.on('playerMoved', (playerInfo) => {
    if (otherPlayers[playerInfo.id]) {
        otherPlayers[playerInfo.id].position = playerInfo.position;
        otherPlayers[playerInfo.id].setDirection(playerInfo.direction);
        otherPlayers[playerInfo.id].moving = playerInfo.moving;
    }
});

socket.on('playerUpdated', (playerInfo) => {
    if (playerInfo.id === socket.id) {
        player.name = playerInfo.name;
    } else if (otherPlayers[playerInfo.id]) {
        otherPlayers[playerInfo.id].name = playerInfo.name;
    }
});

socket.on('playerDisconnected', (playerId) => {
    delete otherPlayers[playerId];
    updatePlayerCount();
});

// Update player count display
function updatePlayerCount() {
    const count = 1 + Object.keys(otherPlayers).length;
    playerCountDisplay.textContent = `Players: ${count}`;
}

// *Game Loop*
function animate() {
    requestAnimationFrame(animate);

    // Only proceed if player is initialized
    if (!player) return;

    // Save the current transformation state
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
    
    // Now draw the main map
    ctx.drawImage(mapImage, 0, 0, mapBounds.width, mapBounds.height);
    
    // Draw Collision Boundaries for debugging if needed
    // boundaries.forEach(boundary => boundary.draw());

    // *Player Movement*
    let newX = player.position.x, newY = player.position.y;
    player.moving = false; // Reset movement state
    
    if (keys.ArrowUp && !checkCollision(player.position.x, player.position.y - player.speed)) {
        newY -= player.speed;
        player.setDirection('up');
        player.moving = true;
    }
    if (keys.ArrowDown && !checkCollision(player.position.x, player.position.y + player.speed)) {
        newY += player.speed;
        player.setDirection('down');
        player.moving = true;
    }
    if (keys.ArrowLeft && !checkCollision(player.position.x - player.speed, player.position.y)) {
        newX -= player.speed;
        player.setDirection('left');
        player.moving = true;
    }
    if (keys.ArrowRight && !checkCollision(player.position.x + player.speed, player.position.y)) {
        newX += player.speed;
        player.setDirection('right');
        player.moving = true;
    }

    if (player.position.x !== newX || player.position.y !== newY) {
        player.position.x = newX;
        player.position.y = newY;
        
        // Emit player position to server
        socket.emit('playerMovement', {
            position: player.position,
            direction: player.lastDirection,
            moving: player.moving
        });
    }

    // *Update Camera Position to Follow Player*
    camera.x = player.position.x - canvas.width / (2 * camera.zoom);
    camera.y = player.position.y - canvas.height / (2 * camera.zoom);

    // Draw all other players
    Object.values(otherPlayers).forEach(otherPlayer => {
        otherPlayer.draw();
    });
    
    // Draw the local player
    player.draw();

    // Restore the original transformation state
    ctx.restore();
}

// *Start Game Loop*
mapImage.onload = () => {
    // Wait for assets to load and socket to connect before starting game loop
    if (socket.connected) {
        animate();
    } else {
        socket.on('connect', () => {
            animate();
        });
    }
};