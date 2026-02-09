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
const CHANNELS_FILE = path.join(DATA_DIR, 'channels.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

// Initialize Files
if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, '[]');
if (!fs.existsSync(CHANNELS_FILE)) {
  const defaultChannels = [
    { id: 'general', name: 'general', description: 'The lobby', createdAt: new Date().toISOString() }
  ];
  fs.writeFileSync(CHANNELS_FILE, JSON.stringify(defaultChannels, null, 2));
}

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

// --- DATA ACCESS HELPERS ---

const getMessages = () => {
  try {
    if (!fs.existsSync(MESSAGES_FILE)) return [];
    const data = fs.readFileSync(MESSAGES_FILE, 'utf8');
    const msgs = JSON.parse(data);
    // Backward compatibility: If no channelId, assign to 'general'
    return msgs.map(m => (!m.channelId ? { ...m, channelId: 'general' } : m));
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

const getChannels = () => {
  try {
    if (!fs.existsSync(CHANNELS_FILE)) return [];
    return JSON.parse(fs.readFileSync(CHANNELS_FILE, 'utf8'));
  } catch (err) {
    return [];
  }
};

const saveChannels = (channels) => {
  try {
    fs.writeFileSync(CHANNELS_FILE, JSON.stringify(channels, null, 2));
  } catch (err) {
    console.error("Error writing channels file:", err);
  }
};

// --- HTTP ENDPOINTS ---

// Get Channels
app.get('/channels', (req, res) => {
  res.json(getChannels());
});

// Create Channel
app.post('/channels', (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).send("Name required");
  
  const channels = getChannels();
  // Simple dup check
  if (channels.find(c => c.name.toLowerCase() === name.toLowerCase())) {
    return res.status(400).send("Channel exists");
  }

  const newChannel = {
    id: Date.now().toString(36),
    name,
    description: description || '',
    createdAt: new Date().toISOString()
  };
  
  channels.push(newChannel);
  saveChannels(channels);
  res.json(newChannel);
});

// Get Messages (Filtered by Channel & Search)
app.get('/messages', (req, res) => {
  let allMessages = getMessages();
  const limit = parseInt(req.query.limit) || 200;
  const before = req.query.before;
  const channelId = req.query.channelId;
  const query = req.query.q ? req.query.q.toLowerCase() : null;

  // 1. Filter by Channel (if specified)
  if (channelId && channelId !== 'all') {
    allMessages = allMessages.filter(m => m.channelId === channelId);
  }

  // 2. Filter by Search Query (if specified)
  if (query) {
    allMessages = allMessages.filter(m => 
      m.content.toLowerCase().includes(query) || 
      m.username.toLowerCase().includes(query)
    );
  }

  // 3. Filter by Pagination (Timestamp)
  if (before) {
    allMessages = allMessages.filter(m => m.timestamp < before);
  }

  // 4. Sort & Limit
  const slice = allMessages.slice(-limit);
  
  res.json(slice);
});

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ url: fileUrl, filename: req.file.filename });
});

app.get('/preview', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'Missing url' });

  try {
    const response = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)' },
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
    const html = await response.text();

    const getMetaContent = (prop) => {
      const regex = new RegExp(`<meta\\s+(?:property|name)=["'](?:og:|twitter:)?${prop}["']\\s+content=["'](.*?)["']`, 'i');
      const match = html.match(regex);
      return match ? match[1] : null;
    };

    const title = getMetaContent('title') || html.match(/<title>(.*?)<\/title>/i)?.[1];
    const description = getMetaContent('description');
    const image = getMetaContent('image') || getMetaContent('image:src');
    const siteName = getMetaContent('site_name');

    res.json({ url: targetUrl, title, description, image, siteName });
  } catch (e) {
    res.json({ url: targetUrl });
  }
});

// --- WEBSOCKET SERVER ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Map(); // ws -> user

const broadcastUserList = () => {
  const users = Array.from(clients.values()).filter(u => u !== null);
  const uniqueUsersMap = new Map();
  users.forEach(u => uniqueUsersMap.set(u.id, u));
  const uniqueUsers = Array.from(uniqueUsersMap.values());
  const msg = JSON.stringify({ type: 'USER_LIST', payload: uniqueUsers });
  
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(msg);
  });
};

wss.on('connection', (ws) => {
  clients.set(ws, null);

  ws.on('message', (messageStr) => {
    try {
      const message = JSON.parse(messageStr);
      let broadcastMsg = null;
      const currentMessages = getMessages();

      if (message.action === 'JOIN' || message.action === 'UPDATE_USER') {
        clients.set(ws, message.payload);
        broadcastUserList();
        return; 
      }

      if (message.action === 'EDIT') {
        const payload = message.payload;
        const index = currentMessages.findIndex(m => m.id === payload.id);
        if (index !== -1) {
          const oldMsg = currentMessages[index];
          currentMessages[index] = { 
            ...oldMsg, 
            ...payload, 
            reactions: oldMsg.reactions,
            pinned: oldMsg.pinned,
            pinnedAt: oldMsg.pinnedAt, // Preserve pinned timestamp
            channelId: oldMsg.channelId || 'general'
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
            pinned: false,
            pinnedAt: undefined // Remove pin timestamp
          };
          saveAllMessages(currentMessages);
          broadcastMsg = { type: 'UPDATE_MESSAGE', payload: currentMessages[index] };
        }
      }
      else if (message.action === 'PIN') {
        const { messageId } = message.payload;
        const index = currentMessages.findIndex(m => m.id === messageId);
        if (index !== -1) {
          const newPinnedState = !currentMessages[index].pinned;
          currentMessages[index].pinned = newPinnedState;
          
          if (newPinnedState) {
            // Add Timestamp if pinning
            currentMessages[index].pinnedAt = new Date().toISOString();
          } else {
            // Remove Timestamp if unpinning
            delete currentMessages[index].pinnedAt;
          }

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
          
          if (userIdx === -1) users.push(userId);
          else {
            users.splice(userIdx, 1);
            if (users.length === 0) delete msg.reactions[emoji];
          }
          saveAllMessages(currentMessages);
          broadcastMsg = { type: 'UPDATE_MESSAGE', payload: msg };
        }
      }
      else {
        // New Message
        if (!message.timestamp) message.timestamp = new Date().toISOString();
        if (!message.reactions) message.reactions = {};
        if (!message.hiddenPreviews) message.hiddenPreviews = [];
        if (!message.pinned) message.pinned = false;
        if (!message.channelId) message.channelId = 'general'; // Default to general
        
        currentMessages.push(message);
        saveAllMessages(currentMessages);
        broadcastMsg = { type: 'NEW_MESSAGE', payload: message };
      }

      if (broadcastMsg) {
        const msgStr = JSON.stringify(broadcastMsg);
        wss.clients.forEach((client) => {
          if (client.readyState === 1) client.send(msgStr);
        });
      }

    } catch (e) {
      console.error("Error processing message:", e);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    broadcastUserList();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});