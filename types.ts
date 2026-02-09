export type MessageType = 'text' | 'image' | 'video' | 'audio';

export interface User {
  id: string;
  username: string;
  color?: string;
}

export interface Message {
  id: string;
  userId: string;
  username: string;
  timestamp: string; // ISO8601
  type: MessageType;
  content: string; // Text content or Base64/URL for media
  fileName?: string; // Original filename for media
  replyTo?: string; // ID of the message being replied to
  edited: boolean;
  deleted: boolean;
}

export interface SearchFilters {
  query: string;
  username?: string;
  date?: string;
  type?: MessageType;
}

export interface ArchiveStats {
  archivedCount: number;
  lastRun: string;
}