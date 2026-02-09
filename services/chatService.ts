import { Message, User, ArchiveStats, LinkPreview } from '../types';
import { CONFIG } from '../config';

// Helper to generate UUID with fallback for insecure contexts (HTTP LAN)
export const generateUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback implementation (RFC4122 version 4)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

class ChatService {
  private socket: WebSocket | null = null;
  private messageCallback: ((msg: Message) => void) | null = null;
  private updateCallback: ((msg: Message) => void) | null = null;
  private statusCallback: ((status: ConnectionStatus) => void) | null = null;
  private userListCallback: ((users: User[]) => void) | null = null;
  
  // Track state internally so late subscribers get the current status immediately
  private connectionState: ConnectionStatus = 'disconnected'; 
  private currentUser: User | null = null;

  constructor() {
    this.connect();
  }

  private connect() {
    this.updateState('connecting');
    
    this.socket = new WebSocket(CONFIG.WS_URL);

    this.socket.onopen = () => {
      console.log('Connected to FinChat Server');
      this.updateState('connected');
      // Re-send join if we reconnect and have a user
      if (this.currentUser) {
        this.sendJoin(this.currentUser);
      }
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'NEW_MESSAGE' && this.messageCallback) {
          this.messageCallback(data.payload);
        } else if (data.type === 'UPDATE_MESSAGE' && this.updateCallback) {
          this.updateCallback(data.payload);
        } else if (data.type === 'USER_LIST' && this.userListCallback) {
          this.userListCallback(data.payload);
        }
      } catch (e) {
        console.error("Failed to parse WS message", e);
      }
    };

    this.socket.onclose = () => {
      this.updateState('disconnected');
      console.log('Disconnected. Reconnecting in 3s...');
      setTimeout(() => this.connect(), CONFIG.RECONNECT_INTERVAL_MS);
    };

    this.socket.onerror = (err) => {
      console.error('WebSocket Error:', err);
      // Only mark disconnected if not already open
      if (this.socket?.readyState !== WebSocket.OPEN) {
        this.updateState('disconnected');
      }
    };
  }

  private updateState(status: ConnectionStatus) {
    this.connectionState = status;
    if (this.statusCallback) {
      this.statusCallback(status);
    }
  }

  // --- Subscriptions ---
  subscribe(
    onNewMessage: (msg: Message) => void, 
    onStatusChange?: (status: ConnectionStatus) => void,
    onMessageUpdate?: (msg: Message) => void,
    onUserListUpdate?: (users: User[]) => void
  ) {
    this.messageCallback = onNewMessage;
    this.statusCallback = onStatusChange || null;
    this.updateCallback = onMessageUpdate || null;
    this.userListCallback = onUserListUpdate || null;
    
    // IMPORTANT: Immediately notify the new subscriber of the CURRENT state.
    if (onStatusChange) {
      onStatusChange(this.connectionState);
    }
    
    // Return unsubscribe function
    return () => {
      this.messageCallback = null;
      this.statusCallback = null;
      this.updateCallback = null;
      this.userListCallback = null;
    };
  }

  // --- API Operations ---

  async getMessages(limit = 200, before?: string): Promise<Message[]> {
    try {
      let url = `${CONFIG.API_URL}/messages?limit=${limit}`;
      if (before) {
        url += `&before=${encodeURIComponent(before)}`;
      }
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch messages');
      return await res.json();
    } catch (e) {
      console.error("Could not load history:", e);
      return [];
    }
  }

  async getLinkPreview(url: string): Promise<LinkPreview | null> {
    try {
      const res = await fetch(`${CONFIG.API_URL}/preview?url=${encodeURIComponent(url)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error("Preview failed", e);
      return null;
    }
  }

  async uploadFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${CONFIG.API_URL}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) throw new Error('File upload failed');
    const data = await res.json();
    return data.url;
  }

  async saveMessage(message: Omit<Message, 'id' | 'timestamp' | 'edited' | 'deleted' | 'reactions'> & { file?: File }): Promise<void> {
    let content = message.content;

    // Handle File Upload if present
    if (message.file && message.type !== 'text') {
      try {
        content = await this.uploadFile(message.file);
      } catch (e) {
        console.error("Upload failed", e);
        throw new Error("Failed to upload media");
      }
    }

    const newMessage: Message = {
      id: generateUUID(),
      userId: message.userId,
      username: message.username,
      timestamp: new Date().toISOString(),
      type: message.type,
      content: content,
      fileName: message.fileName,
      replyTo: message.replyTo,
      edited: false,
      deleted: false,
      reactions: {}
    };

    this.sendToSocket(newMessage);
  }

  editMessage(originalMessage: Message, newContent: string) {
    const updatedMessage = { ...originalMessage, content: newContent, edited: true };
    this.sendToSocket({ action: 'EDIT', payload: updatedMessage });
  }

  deleteMessage(originalMessage: Message) {
    const updatedMessage = { 
        ...originalMessage, 
        deleted: true, 
        content: 'Message deleted',
        type: 'text' as const 
    };
    this.sendToSocket({ action: 'DELETE', payload: updatedMessage });
  }

  sendJoin(user: User) {
    this.currentUser = user;
    this.sendToSocket({ action: 'JOIN', payload: user });
  }

  updateUser(user: User) {
    this.currentUser = user;
    this.sendToSocket({ action: 'UPDATE_USER', payload: user });
  }

  toggleReaction(messageId: string, emoji: string, userId: string) {
    this.sendToSocket({ 
      action: 'REACTION', 
      payload: { messageId, emoji, userId } 
    });
  }

  private sendToSocket(data: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    } else {
      console.warn("Socket not connected, cannot send message");
    }
  }

  // Stub for archive job
  runArchiveJob(): ArchiveStats {
    return { archivedCount: 0, lastRun: new Date().toISOString() };
  }
}

export const chatService = new ChatService();