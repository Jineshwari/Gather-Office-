const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

// Create the Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Store connected players
const players = {};

// Handle Socket.io connections
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    
    // Initialize new player
    players[socket.id] = {
        id: socket.id,
        position: {
            x: 100 + Math.floor(Math.random() * 200),
            y: 100 + Math.floor(Math.random() * 200)
        },
        direction: 'down',
        name: `Player-${socket.id.substr(0, 4)}`,
        moving: false
    };
    
    // Send the current players to the new player
    socket.emit('currentPlayers', players);
    
    // Broadcast new player to all other players
    socket.broadcast.emit('newPlayer', players[socket.id]);
    
    // Handle player movement
    socket.on('playerMovement', (movementData) => {
        // Update player data
        players[socket.id].position = movementData.position;
        players[socket.id].direction = movementData.direction;
        players[socket.id].moving = movementData.moving;
        
        // Broadcast updated player position to all other players
        socket.broadcast.emit('playerMoved', players[socket.id]);
    });
    
    // Handle player name update
    socket.on('updateName', (name) => {
        players[socket.id].name = name;
        io.emit('playerUpdated', players[socket.id]);
    });
    
    // Handle player disconnection
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});