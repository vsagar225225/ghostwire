const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static assets from public directory
app.use(express.static(path.join(__dirname, 'public')));

// In-memory state storage (ephemeral, zero-log anonymity)
const activeUsers = new Map(); // socket.id -> UserInfo
let matchingQueue = []; // array of socket.ids waiting for a private match

// Cyberpunk / Astral theme anonymous alias generator
const ADJECTIVES = [
  'Mystic', 'Cosmic', 'Neon', 'Quantum', 'Alpha', 'Stardust', 'Lunar', 
  'Vortex', 'Drift', 'Echo', 'Nebula', 'Solar', 'Aero', 'Prism', 
  'Cyber', 'Shadow', 'Frost', 'Chrono', 'Hyper', 'Ghost', 'Zenith', 'Spectra'
];
const NOUNS = [
  'Wolf', 'Pixie', 'Raven', 'Fox', 'Nova', 'Rider', 'Shadow', 
  'Phantom', 'Tracer', 'Pulse', 'Comet', 'Orbit', 'Matrix', 'Vector', 
  'Spectre', 'Seeker', 'Glitch', 'Spark', 'Beacon', 'Warden', 'Drifter', 'Ranger'
];

function generateAlias() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(100 + Math.random() * 900); // 3-digit tag
  return `${adj} ${noun} #${num}`;
}

// Basic text sanitization to protect against XSS injections
function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .trim()
    .slice(0, 1000); // Max 1000 chars per message
}

// Compile online user list for display
function getOnlineUsersList() {
  const list = [];
  for (const [id, user] of activeUsers.entries()) {
    list.push({
      alias: user.alias,
      age: user.age,
      gender: user.gender,
      location: user.location,
      isMatched: !!user.matchedWith
    });
  }
  return list;
}

// Notify all clients of presence changes
function broadcastPresence() {
  io.emit('presence-update', {
    onlineCount: activeUsers.size,
    users: getOnlineUsersList()
  });
}

// Attempt to pair users in the matching queue
function processMatchingQueue() {
  // Clear any disconnected or invalid sockets from the queue first
  matchingQueue = matchingQueue.filter(id => {
    const user = activeUsers.get(id);
    return user && user.isMatching;
  });

  while (matchingQueue.length >= 2) {
    const u1_id = matchingQueue.shift();
    const u2_id = matchingQueue.shift();

    const u1 = activeUsers.get(u1_id);
    const u2 = activeUsers.get(u2_id);

    if (u1 && u2 && u1.isMatching && u2.isMatching) {
      // Set match state
      u1.matchedWith = u2_id;
      u1.isMatching = false;
      u2.matchedWith = u1_id;
      u2.isMatching = false;

      // Unique private room identifier
      const roomId = `room_${u1_id}_${u2_id}`;
      
      const s1 = io.sockets.sockets.get(u1_id);
      const s2 = io.sockets.sockets.get(u2_id);

      if (s1 && s2) {
        s1.join(roomId);
        s2.join(roomId);

        // Notify both users
        s1.emit('match-found', {
          roomId: roomId,
          peer: {
            alias: u2.alias,
            age: u2.age,
            gender: u2.gender,
            location: u2.location
          }
        });

        s2.emit('match-found', {
          roomId: roomId,
          peer: {
            alias: u1.alias,
            age: u1.age,
            gender: u1.gender,
            location: u1.location
          }
        });

        // Broadcast presence update (states changed to matched)
        broadcastPresence();
      } else {
        // Fallback cleanup if socket fetch failed
        if (!s1 && u1) {
          u1.isMatching = false;
          u1.matchedWith = null;
        } else if (s1 && u1) {
          matchingQueue.unshift(u1_id); // Re-queue valid user
        }
        
        if (!s2 && u2) {
          u2.isMatching = false;
          u2.matchedWith = null;
        } else if (s2 && u2) {
          matchingQueue.unshift(u2_id); // Re-queue valid user
        }
      }
    }
  }
}

// Socket Connection Lifecycle
io.on('connection', (socket) => {
  // console.log(`[Socket Connected] ID: ${socket.id}`);

  // 1. Join Portal
  socket.on('join-portal', (data, callback) => {
    try {
      const age = parseInt(data.age, 10);
      const gender = sanitizeText(data.gender);
      const location = sanitizeText(data.location);

      // Validation check
      if (isNaN(age) || age < 10 || age > 120 || !gender || !location) {
        return callback({ success: false, error: 'Please enter valid age, gender, and location.' });
      }

      // Generate credentials
      const alias = generateAlias();
      const user = {
        id: socket.id,
        alias: alias,
        age: age,
        gender: gender,
        location: location,
        joinedAt: Date.now(),
        matchedWith: null,
        isMatching: false
      };

      activeUsers.set(socket.id, user);
      
      // Joins public lounge immediately
      socket.join('lounge');

      // Acknowledge connection with generated profile
      callback({
        success: true,
        profile: {
          alias: user.alias,
          age: user.age,
          gender: user.gender,
          location: user.location
        }
      });

      // Update public lounge metrics
      broadcastPresence();

      // Welcome system broadcast
      socket.to('lounge').emit('recv-global-msg', {
        system: true,
        text: `✨ A new soul, ${user.alias} (${user.age} • ${user.gender} • ${user.location}), joined the lounge.`
      });

    } catch (err) {
      console.error('Error on join-portal:', err);
      callback({ success: false, error: 'Internal Server Error' });
    }
  });

  // 2. Global Lounge Messaging
  socket.on('send-global-msg', (data) => {
    const user = activeUsers.get(socket.id);
    if (!user) return;

    const cleanedText = sanitizeText(data.text);
    if (!cleanedText) return;

    // Broadcast globally
    io.to('lounge').emit('recv-global-msg', {
      from: user.alias,
      age: user.age,
      gender: user.gender,
      location: user.location,
      text: cleanedText,
      timestamp: Date.now()
    });
  });

  // 3. Whisper Matchmaking Queue
  socket.on('start-match', () => {
    const user = activeUsers.get(socket.id);
    if (!user || user.matchedWith || user.isMatching) return;

    // Leave the global lounge socket stream visually, but keep in background
    user.isMatching = true;
    matchingQueue.push(socket.id);

    socket.emit('match-searching');
    
    // Process queue
    processMatchingQueue();
  });

  // 4. Cancel/Stop Matchmaking Queue
  socket.on('cancel-match', () => {
    const user = activeUsers.get(socket.id);
    if (!user || !user.isMatching) return;

    user.isMatching = false;
    matchingQueue = matchingQueue.filter(id => id !== socket.id);
    socket.emit('match-idle');
  });

  // 5. Private Whisper Messaging
  socket.on('send-private-msg', (data) => {
    const user = activeUsers.get(socket.id);
    if (!user || !user.matchedWith) return;

    const cleanedText = sanitizeText(data.text);
    if (!cleanedText) return;

    const peerId = user.matchedWith;
    const roomId = `room_${socket.id}_${peerId}`;
    const roomAlternative = `room_${peerId}_${socket.id}`;

    // Verify socket belongs to the active private room
    const targetRoom = socket.rooms.has(roomId) ? roomId : (socket.rooms.has(roomAlternative) ? roomAlternative : null);

    if (targetRoom) {
      io.to(targetRoom).emit('recv-private-msg', {
        from: user.alias,
        text: cleanedText,
        senderId: socket.id,
        timestamp: Date.now()
      });
    }
  });

  // 6. Leave Match Session
  socket.on('leave-match', () => {
    const user = activeUsers.get(socket.id);
    if (!user || !user.matchedWith) return;

    const peerId = user.matchedWith;
    const peer = activeUsers.get(peerId);

    const roomId = `room_${socket.id}_${peerId}`;
    const roomAlternative = `room_${peerId}_${socket.id}`;
    const targetRoom = socket.rooms.has(roomId) ? roomId : (socket.rooms.has(roomAlternative) ? roomAlternative : null);

    if (targetRoom) {
      io.to(targetRoom).emit('match-ended', { reason: 'partner_left' });
    }

    // Clean up sender
    user.matchedWith = null;
    user.isMatching = false;
    socket.leave(roomId);
    socket.leave(roomAlternative);

    // Clean up peer
    if (peer) {
      peer.matchedWith = null;
      peer.isMatching = false;
      const peerSocket = io.sockets.sockets.get(peerId);
      if (peerSocket) {
        peerSocket.leave(roomId);
        peerSocket.leave(roomAlternative);
      }
    }

    // Broadcast presence state change
    broadcastPresence();
  });

  // 7. Typing Indicator Broadcast
  socket.on('typing-state', (data) => {
    const user = activeUsers.get(socket.id);
    if (!user) return;

    if (data.mode === 'global') {
      socket.to('lounge').emit('typing-update', {
        mode: 'global',
        alias: user.alias,
        isTyping: !!data.isTyping
      });
    } else if (data.mode === 'private' && user.matchedWith) {
      io.to(user.matchedWith).emit('typing-update', {
        mode: 'private',
        alias: user.alias,
        isTyping: !!data.isTyping
      });
    }
  });

  // 8. Connection Termination
  socket.on('disconnect', () => {
    const user = activeUsers.get(socket.id);
    if (user) {
      // System broadcast to lounge
      socket.to('lounge').emit('recv-global-msg', {
        system: true,
        text: `💨 ${user.alias} departed.`
      });

      // Cleanup matchmaking matches
      if (user.matchedWith) {
        const peerId = user.matchedWith;
        const peer = activeUsers.get(peerId);
        if (peer) {
          peer.matchedWith = null;
          peer.isMatching = false;
          
          const peerSocket = io.sockets.sockets.get(peerId);
          if (peerSocket) {
            const roomId = `room_${socket.id}_${peerId}`;
            const roomAlternative = `room_${peerId}_${socket.id}`;
            peerSocket.leave(roomId);
            peerSocket.leave(roomAlternative);
            peerSocket.emit('match-ended', { reason: 'partner_disconnected' });
          }
        }
      }

      // Remove from queues and lists
      if (user.isMatching) {
        matchingQueue = matchingQueue.filter(id => id !== socket.id);
      }

      activeUsers.delete(socket.id);
      broadcastPresence();
    }
    // console.log(`[Socket Disconnected] ID: ${socket.id}`);
  });
});

// Run server
server.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`  AnonSphere Server listening dynamically on Port: ${PORT}`);
  console.log(`  Local URL: http://localhost:${PORT}`);
  console.log(`==================================================`);
});
