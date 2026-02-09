/**
 * FinChat Backend Server
 * 
 * Dependencies:
 * npm install express ws cors multer
 * 
 * Usage:
 * node server/index.js
 */

import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- ESM FIX FOR __dirname ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURATION ---
const PORT = 4000;
const DATA_DIR = path.join(__dirname, '../data');
const MEDIA_DIR = path.join(DATA_DIR, 'media');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, '[]');

// --- EXPRESS APP SETUP ---
const app = express();
app.use(cors());
app.use(express.json());

// Serve uploaded media files statically
app.use('/uploads', express.static(MEDIA_DIR));

// Configure Multer for disk storage with 100MB limit
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, MEDIA_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// --- DATA ACCESS HELPERS (Synchronous to prevent race conditions) ---

const getMessages = () => {
  try {
    if (!fs.existsSync(MESSAGES_FILE)) return [];
    const data = fs.readFileSync(MESSAGES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading messages file:", err);
    return [];
  }
};

const saveAllMessages = (messages) => {
  try {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
  } catch (err) {
    console.error("Error writing messages file:", err);
  }
};

// --- HTTP ENDPOINTS ---

// Paginated Messages
app.get('/messages', (req, res) => {
  const allMessages = getMessages();
  const limit = parseInt(req.query.limit) || 200;
  const before = req.query.before;

  let result = allMessages;

  if (before) {
    // Simple logic: filter where timestamp < before.
    result = allMessages.filter(m => m.timestamp < before);
  }

  // Take the LAST 'limit' items from the result
  const slice = result.slice(-limit);
  
  res.json(slice);
});

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ url: fileUrl, filename: req.file.filename });
});

// Link Preview Endpoint
app.get('/preview', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'Missing url' });

  try {
    // Use Discordbot User-Agent to encourage sites (X, IG) to return OpenGraph tags
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'
      },
      signal: AbortSignal.timeout(5000) // 5s timeout
    });
    
    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
    const html = await response.text();

    // Robust Regex Parsing for OG and Twitter Tags
    const getMetaContent = (prop) => {
      // Matches <meta property="og:title" content="..."> OR <meta name="twitter:title" content="...">
      const regex = new RegExp(`<meta\\s+(?:property|name)=["'](?:og:|twitter:)?${prop}["']\\s+content=["'](.*?)["']`, 'i');
      const match = html.match(regex);
      return match ? match[1] : null;
    };

    // Fallback regex for title tag
    const title = getMetaContent('title') || html.match(/<title>(.*?)<\/title>/i)?.[1];
    const description = getMetaContent('description');
    const image = getMetaContent('image') || getMetaContent('image:src');
    const siteName = getMetaContent('site_name');

    res.json({ url: targetUrl, title, description, image, siteName });
  } catch (e) {
    console.error("Preview fetch error for", targetUrl, e.message);
    // Return success with empty data to prevent client errors, just shows no preview
    res.json({ url: targetUrl });
  }
});

// --- WEBSOCKET SERVER ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Map to track connected users: WebSocket -> User Object
const clients = new Map();

const broadcastUserList = () => {
  const users = Array.from(clients.values()).filter(u => u !== null);
  // Deduplicate by ID to show unique users (in case of multiple tabs)
  const uniqueUsersMap = new Map();
  users.forEach(u => uniqueUsersMap.set(u.id, u));
  const uniqueUsers = Array.from(uniqueUsersMap.values());

  const msg = JSON.stringify({ type: 'USER_LIST', payload: uniqueUsers });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(msg);
    }
  });
};

wss.on('connection', (ws) => {
  console.log('Client connected');
  clients.set(ws, null); // Initialize as unknown

  ws.on('message', (messageStr) => {
    try {
      const message = JSON.parse(messageStr);
      let broadcastMsg = null;
      
      const currentMessages = getMessages();

      if (message.action === 'JOIN') {
        clients.set(ws, message.payload);
        broadcastUserList();
        return; 
      }

      if (message.action === 'UPDATE_USER') {
        clients.set(ws, message.payload);
        broadcastUserList();
        return;
      }

      if (message.action === 'EDIT') {
        const payload = message.payload;
        const index = currentMessages.findIndex(m => m.id === payload.id);
        if (index !== -1) {
          // Preserve reactions and pinned status if any
          const oldMsg = currentMessages[index];
          // Merge old message with new payload (content, edited, hiddenPreviews)
          currentMessages[index] = { 
            ...oldMsg, 
            ...payload, 
            reactions: oldMsg.reactions,
            pinned: oldMsg.pinned
          };
          saveAllMessages(currentMessages);
          broadcastMsg = { type: 'UPDATE_MESSAGE', payload: currentMessages[index] };
        }
      } 
      else if (message.action === 'DELETE') {
        const payload = message.payload;
        const index = currentMessages.findIndex(m => m.id === payload.id);
        if (index !== -1) {
          currentMessages[index] = { 
            ...currentMessages[index], 
            deleted: true, 
            content: 'Message deleted', 
            type: 'text',
            pinned: false // Unpin if deleted
          };
          saveAllMessages(currentMessages);
          broadcastMsg = { type: 'UPDATE_MESSAGE', payload: currentMessages[index] };
        }
      }
      else if (message.action === 'PIN') {
        const { messageId } = message.payload;
        const index = currentMessages.findIndex(m => m.id === messageId);
        
        if (index !== -1) {
          // Toggle pinned status
          currentMessages[index].pinned = !currentMessages[index].pinned;
          saveAllMessages(currentMessages);
          broadcastMsg = { type: 'UPDATE_MESSAGE', payload: currentMessages[index] };
        }
      }
      else if (message.action === 'REACTION') {
        const { messageId, emoji, userId } = message.payload;
        const index = currentMessages.findIndex(m => m.id === messageId);
        
        if (index !== -1) {
          const msg = currentMessages[index];
          if (!msg.reactions) msg.reactions = {};
          
          if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
          
          const users = msg.reactions[emoji];
          const userIdx = users.indexOf(userId);
          
          if (userIdx === -1) {
            // Add reaction
            users.push(userId);
          } else {
            // Remove reaction (toggle)
            users.splice(userIdx, 1);
            if (users.length === 0) delete msg.reactions[emoji];
          }
          
          saveAllMessages(currentMessages);
          broadcastMsg = { type: 'UPDATE_MESSAGE', payload: msg };
        }
      }
      else {
        // New Message (Standard)
        if (!message.timestamp) message.timestamp = new Date().toISOString();
        if (!message.reactions) message.reactions = {};
        if (!message.hiddenPreviews) message.hiddenPreviews = [];
        if (!message.pinned) message.pinned = false;
        
        currentMessages.push(message);
        saveAllMessages(currentMessages);
        broadcastMsg = { type: 'NEW_MESSAGE', payload: message };
      }

      // Broadcast to ALL connected clients
      if (broadcastMsg) {
        const msgStr = JSON.stringify(broadcastMsg);
        wss.clients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(msgStr);
          }
        });
      }

    } catch (e) {
      console.error("Error processing message:", e);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
    broadcastUserList();
  });
});

// --- START SERVER ---
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🚀 FinChat Server Running!
  --------------------------
  API:    http://localhost:${PORT}
  WS:     ws://localhost:${PORT}
  Storage: ${DATA_DIR}
  `);
});