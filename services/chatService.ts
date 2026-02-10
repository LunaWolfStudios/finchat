import { Message, User, ArchiveStats, LinkPreview, Channel, SearchFilters } from '../types';
import { CONFIG } from '../config';

export const generateUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface TypingEvent {
    userId: string;
    username: string;
    isTyping: boolean;
}

class ChatService {
  private socket: WebSocket | null = null;
  private messageCallback: ((msg: Message) => void) | null = null;
  private updateCallback: ((msg: Message) => void) | null = null;
  private statusCallback: ((status: ConnectionStatus) => void) | null = null;
  private userListCallback: ((users: User[]) => void) | null = null;
  private typingCallback: ((event: TypingEvent) => void) | null = null;
  
  private connectionState: ConnectionStatus = 'disconnected'; 
  private currentUser: User | null = null;

  constructor() {
    this.connect();
  }

  private connect() {
    this.updateState('connecting');
    this.socket = new WebSocket(CONFIG.WS_URL);

    this.socket.onopen = () => {
      this.updateState('connected');
      if (this.currentUser) this.sendJoin(this.currentUser);
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
        } else if (data.type === 'TYPING' && this.typingCallback) {
            this.typingCallback(data.payload);
        }
      } catch (e) { console.error("WS parse error", e); }
    };

    this.socket.onclose = () => {
      this.updateState('disconnected');
      setTimeout(() => this.connect(), CONFIG.RECONNECT_INTERVAL_MS);
    };

    this.socket.onerror = () => {
      if (this.socket?.readyState !== WebSocket.OPEN) this.updateState('disconnected');
    };
  }

  private updateState(status: ConnectionStatus) {
    this.connectionState = status;
    if (this.statusCallback) this.statusCallback(status);
  }

  subscribe(
    onNewMessage: (msg: Message) => void, 
    onStatusChange?: (status: ConnectionStatus) => void,
    onMessageUpdate?: (msg: Message) => void,
    onUserListUpdate?: (users: User[]) => void,
    onTyping?: (event: TypingEvent) => void
  ) {
    this.messageCallback = onNewMessage;
    this.statusCallback = onStatusChange || null;
    this.updateCallback = onMessageUpdate || null;
    this.userListCallback = onUserListUpdate || null;
    this.typingCallback = onTyping || null;
    
    if (onStatusChange) onStatusChange(this.connectionState);
    
    return () => {
      this.messageCallback = null;
      this.statusCallback = null;
      this.updateCallback = null;
      this.userListCallback = null;
      this.typingCallback = null;
    };
  }

  // --- API ---

  async getUser(id: string): Promise<User | null> {
    try {
      const res = await fetch(`${CONFIG.API_URL}/users/${id}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }

  async syncUser(user: User): Promise<User> {
    const res = await fetch(`${CONFIG.API_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    if (!res.ok) throw new Error("Failed to sync user");
    return await res.json();
  }

  async getChannels(): Promise<Channel[]> {
    try {
      const res = await fetch(`${CONFIG.API_URL}/channels`);
      return await res.json();
    } catch (e) {
      return [];
    }
  }

  async createChannel(name: string, description?: string): Promise<Channel> {
    const res = await fetch(`${CONFIG.API_URL}/channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description })
    });
    if (!res.ok) throw new Error("Failed to create channel");
    return await res.json();
  }

  async updateChannel(channel: Channel): Promise<Channel> {
    const res = await fetch(`${CONFIG.API_URL}/channels/${channel.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: channel.name, order: channel.order })
    });
    if (!res.ok) throw new Error("Failed to update channel");
    return await res.json();
  }

  async getMessages(channelId: string, limit = 100, before?: string, after?: string, around?: string): Promise<Message[]> {
    try {
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('channelId', channelId);
      if (before) params.append('before', before);
      if (after) params.append('after', after);
      if (around) params.append('around', around);

      const res = await fetch(`${CONFIG.API_URL}/messages?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      return await res.json();
    } catch (e) {
      return [];
    }
  }

  async searchMessages(filters: SearchFilters, limit = 100, before?: string): Promise<Message[]> {
     try {
       const params = new URLSearchParams();
       if (filters.query) params.append('q', filters.query);
       if (filters.channelId) params.append('channelId', filters.channelId);
       if (before) params.append('before', before);
       
       const res = await fetch(`${CONFIG.API_URL}/messages?${params.toString()}&limit=${limit}`);
       if (!res.ok) throw new Error('Search failed');
       return await res.json();
     } catch(e) {
       return [];
     }
  }

  async getLinkPreview(url: string): Promise<LinkPreview | null> {
    try {
      const res = await fetch(`${CONFIG.API_URL}/preview?url=${encodeURIComponent(url)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }

  async uploadFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${CONFIG.API_URL}/upload`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('File upload failed');
    const data = await res.json();
    return data.url;
  }

  async saveMessage(message: Omit<Message, 'id' | 'timestamp' | 'edited' | 'deleted' | 'reactions' | 'hiddenPreviews' | 'pinned'> & { file?: File }): Promise<void> {
    let content = message.content;
    if (message.file && message.type !== 'text') {
      try {
        content = await this.uploadFile(message.file);
      } catch (e) { throw new Error("Failed to upload media"); }
    }

    const newMessage: Message = {
      id: generateUUID(),
      channelId: message.channelId || 'general',
      userId: message.userId,
      username: message.username,
      timestamp: new Date().toISOString(),
      type: message.type,
      content: content,
      fileName: message.fileName,
      replyTo: message.replyTo,
      edited: false,
      deleted: false,
      pinned: false,
      reactions: {},
      hiddenPreviews: []
    };

    this.sendToSocket(newMessage);
  }

  editMessage(originalMessage: Message, newContent: string) {
    this.sendToSocket({ action: 'EDIT', payload: { ...originalMessage, content: newContent, edited: true } });
  }

  removePreview(originalMessage: Message, urlToRemove: string) {
    const currentHidden = originalMessage.hiddenPreviews || [];
    if (!currentHidden.includes(urlToRemove)) {
      this.sendToSocket({ action: 'EDIT', payload: { ...originalMessage, hiddenPreviews: [...currentHidden, urlToRemove] } });
    }
  }

  deleteMessage(originalMessage: Message) {
    this.sendToSocket({ action: 'DELETE', payload: { ...originalMessage, deleted: true, content: 'Message deleted', type: 'text' } });
  }

  togglePin(messageId: string) {
    this.sendToSocket({ action: 'PIN', payload: { messageId } });
  }

  sendJoin(user: User) {
    this.currentUser = { ...user, isMobile: isMobileDevice() };
    this.sendToSocket({ action: 'JOIN', payload: this.currentUser });
  }

  sendTyping(isTyping: boolean) {
    if (!this.currentUser) return;
    this.sendToSocket({
        action: 'TYPING',
        payload: {
            userId: this.currentUser.id,
            username: this.currentUser.username,
            isTyping
        }
    });
  }

  updateUser(user: User) {
    this.currentUser = { ...user, isMobile: isMobileDevice() };
    this.sendToSocket({ action: 'UPDATE_USER', payload: this.currentUser });
  }

  toggleReaction(messageId: string, emoji: string, userId: string) {
    this.sendToSocket({ action: 'REACTION', payload: { messageId, emoji, userId } });
  }

  private sendToSocket(data: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  runArchiveJob(): ArchiveStats {
    return { archivedCount: 0, lastRun: new Date().toISOString() };
  }
}

export const chatService = new ChatService();