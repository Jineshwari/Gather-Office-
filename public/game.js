// Import the collisions data from the separate file
import collisions from './collisions.js';

const socket = io();

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const playerNameInput = document.getElementById("playerNameInput");
const playerCountDisplay = document.getElementById("playerCount");

canvas.width = 1550;
canvas.height = 700;

class Sprite {
    constructor({ position, image, frames = { max: 1 }, sprites = {}, name = "", id = null }) {
        this.position = position;
        this.image = image;
        this.frames = frames;
        this.sprites = sprites;
        this.width = 30; 
        this.height = 30; 
        this.speed = 3; 
        this.frameIndex = 0;
        this.frameCount = 0;
        this.moving = false;
        this.lastDirection = 'down';
        this.name = name;
        this.id = id; 
        this.showInteractionMenu = false; 
        this.interactingWith = null; 
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

        // Draw interaction menu if active
        if (this.showInteractionMenu) {
            this.drawInteractionMenu();
        }
    }

    drawInteractionMenu() {
        // Position the menu above the player
        const menuX = this.position.x - 30;
        const menuY = this.position.y - 70;
        const menuWidth = 90;
        const menuHeight = 45;
        
        // Draw the dialogue box background
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(menuX, menuY, menuWidth, menuHeight);
        
        // Draw the border
        ctx.strokeStyle = "#4286f4";
        ctx.lineWidth = 2;
        ctx.strokeRect(menuX, menuY, menuWidth, menuHeight);
        
        // Add menu options
        ctx.font = "11px Arial";
        ctx.textAlign = "center";
        
        // Chat option
        ctx.fillStyle = "#ffffff";
        ctx.fillText("Chat", menuX + menuWidth/2, menuY + 15);
        
        // Voice chat option
        ctx.fillText("Voice Chat", menuX + menuWidth/2, menuY + 32);
        
        // Draw a little pointer at the bottom of the dialogue box
        ctx.beginPath();
        ctx.moveTo(menuX + menuWidth/2 - 8, menuY + menuHeight);
        ctx.lineTo(menuX + menuWidth/2 + 8, menuY + menuHeight);
        ctx.lineTo(menuX + menuWidth/2, menuY + menuHeight + 8);
        ctx.closePath();
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fill();
        ctx.strokeStyle = "#4286f4";
        ctx.stroke();
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
    ArrowRight: false,
    e: false 
};

window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
    
    // Check for 'E' key press to initiate player interaction
    if (e.key === 'e' || e.key === 'E') {
        checkPlayerInteraction();
    }
});

window.addEventListener("keyup", (e) => keys[e.key] = false);

// Update player name when input changes
playerNameInput.addEventListener("change", () => {
    const newName = playerNameInput.value.trim() || `Player-${socket.id.substr(0, 4)}`;
    player.name = newName;
    socket.emit('updateName', newName);
});

// Function to check for nearby players for interaction
function checkPlayerInteraction() {
    if (!player) return;
    
    // Close any existing interaction menu first
    if (player.showInteractionMenu) {
        player.showInteractionMenu = false;
        player.interactingWith = null;
        return;
    }
    
    // Check if any other player is near
    const interactionRange = 50; // Distance for interaction
    
    for (const id in otherPlayers) {
        const otherPlayer = otherPlayers[id];
        
        // Calculate distance between players
        const dx = player.position.x - otherPlayer.position.x;
        const dy = player.position.y - otherPlayer.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= interactionRange) {
            // Show interaction menu if player is within range
            player.showInteractionMenu = true;
            player.interactingWith = id;
            
            // Emit an event to the server that this player wants to interact
            socket.emit('playerInteraction', {
                targetId: id
            });
            
            return; // Exit after finding the first nearby player
        }
    }
}

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

const boundaries = [];
const offsetX = 0, offsetY = 0;

// Generate boundaries from collision data
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

// Create and show name input dialog
function showNameInputDialog() {
    // Create a modal dialog div
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.left = '0';
    modal.style.top = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.7)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '1000';
    
    // Create dialog content
    const dialog = document.createElement('div');
    dialog.style.backgroundColor = 'white';
    dialog.style.padding = '30px';
    dialog.style.borderRadius = '10px';
    dialog.style.width = '300px';
    dialog.style.textAlign = 'center';
    
    // Add title
    const title = document.createElement('h2');
    title.textContent = 'Welcome to the Game!';
    title.style.marginBottom = '20px';
    title.style.color = '#333';
    
    // Add name input field
    const label = document.createElement('label');
    label.textContent = 'Enter your player name:';
    label.style.display = 'block';
    label.style.marginBottom = '10px';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = `Player-${socket.id ? socket.id.substr(0, 4) : 'New'}`;
    input.style.width = '90%';
    input.style.padding = '8px';
    input.style.marginBottom = '20px';
    input.style.borderRadius = '4px';
    input.style.border = '1px solid #ccc';
    
    // Add submit button
    const button = document.createElement('button');
    button.textContent = 'Start Playing!';
    button.style.padding = '10px 20px';
    button.style.backgroundColor = '#4CAF50';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '4px';
    button.style.cursor = 'pointer';
    
    // Event handler for button click
    button.addEventListener('click', () => {
        const playerName = input.value.trim() || input.placeholder;
        
        // Update player name and input field
        if (player) {
            player.name = playerName;
            playerNameInput.value = playerName;
            socket.emit('updateName', playerName);
        }
        
        // Remove the modal
        document.body.removeChild(modal);
    });
    
    // Handle Enter key press
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            button.click();
        }
    });
    
    // Assemble the dialog
    dialog.appendChild(title);
    dialog.appendChild(label);
    dialog.appendChild(input);
    dialog.appendChild(button);
    modal.appendChild(dialog);
    
    // Add to document
    document.body.appendChild(modal);
    
    // Focus the input field
    setTimeout(() => input.focus(), 100);
}

// Add a tutorial message for interaction
function showInteractionTutorial() {
    const tutorial = document.createElement('div');
    tutorial.style.position = 'fixed';
    tutorial.style.bottom = '20px';
    tutorial.style.left = '50%';
    tutorial.style.transform = 'translateX(-50%)';
    tutorial.style.backgroundColor = 'rgba(0,0,0,0.7)';
    tutorial.style.color = 'white';
    tutorial.style.padding = '10px 20px';
    tutorial.style.borderRadius = '5px';
    tutorial.style.textAlign = 'center';
    tutorial.style.zIndex = '999';
    tutorial.id = 'interaction-tutorial';
    tutorial.innerHTML = 'Press <strong>E</strong> to interact with nearby players';
    
    document.body.appendChild(tutorial);
    
    // Remove the tutorial after 5 seconds
    setTimeout(() => {
        const tutorialElement = document.getElementById('interaction-tutorial');
        if (tutorialElement) {
            tutorialElement.remove();
        }
    }, 5000);
}

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

// Function to check for players in close proximity
function checkNearbyPlayers() {
    if (!player) return;
    
    const interactionRange = 50; // Distance for automatic interaction detection
    let foundNearbyPlayer = false;
    
    for (const id in otherPlayers) {
        const otherPlayer = otherPlayers[id];
        
        // Calculate distance between players
        const dx = player.position.x - otherPlayer.position.x;
        const dy = player.position.y - otherPlayer.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= interactionRange) {
            // Display a hint to press E for interaction
            const hintElement = document.getElementById('interaction-hint');
            if (!hintElement) {
                const hint = document.createElement('div');
                hint.id = 'interaction-hint';
                hint.style.position = 'fixed';
                hint.style.bottom = '50px';
                hint.style.left = '50%';
                hint.style.transform = 'translateX(-50%)';
                hint.style.backgroundColor = 'rgba(0,0,0,0.7)';
                hint.style.color = 'white';
                hint.style.padding = '5px 10px';
                hint.style.borderRadius = '3px';
                hint.style.fontSize = '12px';
                hint.style.zIndex = '999';
                hint.textContent = 'Press E to interact';
                document.body.appendChild(hint);
            }
            
            foundNearbyPlayer = true;
            break;
        }
    }
    
    // Remove the hint if no player is nearby
    if (!foundNearbyPlayer) {
        const hint = document.getElementById('interaction-hint');
        if (hint) {
            hint.remove();
        }
    }
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
        
        // Show the name input dialog for the new player
        showNameInputDialog();
        
        // Show interaction tutorial
        setTimeout(showInteractionTutorial, 3000);
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

// Handle player interaction responses
socket.on('playerInteractionResponse', (data) => {
    // This would handle the response when another player accepts your interaction
    // For now, we're just showing the dialogue box
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
        
        // Close interaction menu when moving
        if (player.showInteractionMenu) {
            player.showInteractionMenu = false;
            player.interactingWith = null;
        }
    }

    // Check for nearby players every frame
    checkNearbyPlayers();

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