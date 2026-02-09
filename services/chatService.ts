import { Message, User, ArchiveStats } from '../types';
import { STORAGE_KEY_MESSAGES, STORAGE_KEY_ARCHIVE, ARCHIVE_AGE_DAYS } from '../constants';

// BroadcastChannel for cross-tab communication (simulating WebSockets)
const channel = new BroadcastChannel('finchat_global_room');

// Helper to generate UUID
const generateId = () => crypto.randomUUID();

export const chatService = {
  // --- Event Listeners ---
  subscribe: (callback: (msg: Message) => void) => {
    channel.onmessage = (event) => {
      if (event.data && event.data.type === 'NEW_MESSAGE') {
        callback(event.data.payload);
      }
    };
    return () => {
      channel.onmessage = null;
    };
  },

  // --- CRUD Operations ---
  getMessages: (): Message[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_MESSAGES);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Failed to load messages", e);
      return [];
    }
  },

  saveMessage: async (message: Omit<Message, 'id' | 'timestamp' | 'edited' | 'deleted'>): Promise<Message> => {
    const newMessage: Message = {
      ...message,
      id: generateId(),
      timestamp: new Date().toISOString(),
      edited: false,
      deleted: false,
    };

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));

    const messages = chatService.getMessages();
    messages.push(newMessage);
    
    try {
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
      // Broadcast to other tabs
      channel.postMessage({ type: 'NEW_MESSAGE', payload: newMessage });
      return newMessage;
    } catch (e) {
      console.error("Storage full?", e);
      throw new Error("Failed to send message. Local storage might be full.");
    }
  },

  editMessage: (id: string, newContent: string): Message[] => {
    const messages = chatService.getMessages();
    const index = messages.findIndex(m => m.id === id);
    if (index !== -1) {
      messages[index].content = newContent;
      messages[index].edited = true;
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
      // In a real app, we'd broadcast an update event too. 
      // For this demo, we'll force reload via the parent component or assume simple append-only for broadcast.
      // To keep it simple, we won't broadcast edits to other tabs in this V1 demo, 
      // but we will update local state.
    }
    return messages;
  },

  deleteMessage: (id: string): Message[] => {
    const messages = chatService.getMessages();
    const index = messages.findIndex(m => m.id === id);
    if (index !== -1) {
      messages[index].deleted = true;
      messages[index].content = "Message deleted";
      messages[index].type = 'text'; // Reset type to text for placeholder
      localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
    }
    return messages;
  },

  // --- Archival Logic ---
  runArchiveJob: (): ArchiveStats => {
    const messages = chatService.getMessages();
    const now = new Date();
    const cutoff = new Date(now.getTime() - (ARCHIVE_AGE_DAYS * 24 * 60 * 60 * 1000));

    const activeMessages = [];
    const archivedMessages = [];

    messages.forEach(msg => {
      if (new Date(msg.timestamp) < cutoff) {
        archivedMessages.push(msg);
      } else {
        activeMessages.push(msg);
      }
    });

    if (archivedMessages.length > 0) {
        // In a real app, we would compress and send to server. 
        // Here we just move them to a separate storage key to keep the main list fast.
        const existingArchive = localStorage.getItem(STORAGE_KEY_ARCHIVE);
        const archiveList = existingArchive ? JSON.parse(existingArchive) : [];
        const newArchiveList = [...archiveList, ...archivedMessages];
        
        try {
            localStorage.setItem(STORAGE_KEY_ARCHIVE, JSON.stringify(newArchiveList));
            localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(activeMessages));
        } catch (e) {
            console.error("Archive storage failed", e);
        }
    }

    return {
        archivedCount: archivedMessages.length,
        lastRun: now.toISOString()
    };
  }
};
