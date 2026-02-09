export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file';

export interface User {
  id: string;
  username: string;
  color?: string;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  channelId: string; // New property
  userId: string;
  username: string;
  timestamp: string; // ISO8601
  type: MessageType;
  content: string; // Text content or Base64/URL for media
  fileName?: string; // Original filename for media
  replyTo?: string; // ID of the message being replied to
  edited: boolean;
  deleted: boolean;
  pinned?: boolean; 
  reactions?: { [emoji: string]: string[] }; // Emoji char -> Array of User IDs
  hiddenPreviews?: string[]; // List of URLs whose previews should be hidden
}

export interface SearchFilters {
  query: string;
  username?: string;
  date?: string;
  type?: MessageType | 'link';
  channelId?: string; // 'all' or specific UUID
}

export interface ArchiveStats {
  archivedCount: number;
  lastRun: string;
}

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}