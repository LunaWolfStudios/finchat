import { Box, Image, FileAudio, FileVideo } from 'lucide-react';

export const APP_NAME = 'FinChat';
export const APP_VERSION = 'V1';
export const STORAGE_KEY_MESSAGES = 'finchat_messages';
export const STORAGE_KEY_USER = 'finchat_user';
export const STORAGE_KEY_THEME = 'finchat_theme';
export const STORAGE_KEY_ARCHIVE = 'finchat_archive';

// Mock constraints
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB limit for localstorage demo
export const ARCHIVE_AGE_DAYS = 180;

export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
};

export const NEON_COLORS = [
  '#00ffff', // Cyan
  '#9b5cff', // Purple
  '#ff3cac', // Pink
  '#39ff14', // Neon Green
  '#fff01f', // Neon Yellow
];
