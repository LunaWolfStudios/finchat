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

// Configure Multer for disk storage
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
const upload = multer({ storage: storage });

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

app.get('/messages', (req, res) => {
  const messages = getMessages();
  res.json(messages);
});

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ url: fileUrl, filename: req.file.filename });
});

// --- WEBSOCKET SERVER ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (messageStr) => {
    try {
      const message = JSON.parse(messageStr);
      let broadcastMsg = null;
      
      const currentMessages = getMessages();

      if (message.action === 'EDIT') {
        const payload = message.payload;
        const index = currentMessages.findIndex(m => m.id === payload.id);
        if (index !== -1) {
          currentMessages[index] = payload;
          saveAllMessages(currentMessages);
          broadcastMsg = { type: 'UPDATE_MESSAGE', payload: payload };
        }
      } 
      else if (message.action === 'DELETE') {
        const payload = message.payload;
        const index = currentMessages.findIndex(m => m.id === payload.id);
        if (index !== -1) {
          currentMessages[index] = payload; // Payload should have deleted: true
          saveAllMessages(currentMessages);
          broadcastMsg = { type: 'UPDATE_MESSAGE', payload: payload };
        }
      } 
      else {
        // New Message (Standard)
        // Ensure server-side timestamp for consistency
        if (!message.timestamp) message.timestamp = new Date().toISOString();
        
        currentMessages.push(message);
        saveAllMessages(currentMessages);
        broadcastMsg = { type: 'NEW_MESSAGE', payload: message };
      }

      // Broadcast to ALL connected clients (including sender to confirm sync)
      if (broadcastMsg) {
        const msgStr = JSON.stringify(broadcastMsg);
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
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