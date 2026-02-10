// Network Configuration
// Adjust these to match your server's IP if running on a local network (e.g., '192.168.1.X')

// Fallback to localhost if hostname is empty (e.g. file:// protocol or some environments)
const HOST = window.location.hostname || 'localhost'; 
const API_PORT = 4000;

export const CONFIG = {
  // The HTTP API URL for history and uploads
  API_URL: `https://${HOST}/api/`,
  
  // The WebSocket URL for real-time chat
  WS_URL: `wss://${HOST}/ws/`,
  
  // Constraints
  MAX_FILE_SIZE_BYTES: 100 * 1024 * 1024, // 100MB
  RECONNECT_INTERVAL_MS: 3000,
};