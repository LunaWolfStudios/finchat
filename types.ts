export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file';

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
  pinned?: boolean; // New property
  reactions?: { [emoji: string]: string[] }; // Emoji char -> Array of User IDs
  hiddenPreviews?: string[]; // List of URLs whose previews should be hidden
}

export interface SearchFilters {
  query: string;
  username?: string;
  date?: string;
  type?: MessageType | 'link';
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