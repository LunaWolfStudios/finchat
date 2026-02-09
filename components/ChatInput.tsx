import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Video, Mic, X, Paperclip } from 'lucide-react';
import { MAX_FILE_SIZE_BYTES } from '../constants';
import { Message, MessageType, User } from '../types';

interface ChatInputProps {
  onSendMessage: (content: string, type: MessageType, file?: File) => void;
  replyTo: Message | null;
  onCancelReply: () => void;
  allUsers: User[]; // Changed from onlineUsers
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, replyTo, onCancelReply, allUsers = [] }) => {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<MessageType>('text');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionCursorPos, setMentionCursorPos] = useState<number>(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert(`File too large. Max size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`);
      return;
    }

    let type: MessageType = 'text';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('video/')) type = 'video';
    else if (file.type.startsWith('audio/')) type = 'audio';
    else {
      alert("Unsupported file type");
      return;
    }

    setFileType(type);
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSend = () => {
    if ((!text.trim() && !selectedFile) || (fileType !== 'text' && !preview)) return;

    if (selectedFile && preview) {
      onSendMessage(preview, fileType, selectedFile);
    } else {
      onSendMessage(text, 'text');
    }

    // Reset
    setText('');
    setPreview(null);
    setFileType('text');
    setSelectedFile(null);
    setMentionQuery(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onCancelReply();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // If mention popup is open, maybe select first? 
      // For simplicity in this version, Enter just sends unless we specifically bound arrow keys to list
      handleSend();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setText(newVal);
    
    // Logic for @mentions
    const cursor = e.target.selectionStart;
    const textBeforeCursor = newVal.slice(0, cursor);
    const lastWordMatch = textBeforeCursor.match(/@(\w*)$/);

    if (lastWordMatch) {
      setMentionQuery(lastWordMatch[1]);
      setMentionCursorPos(cursor);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (username: string) => {
    const textBefore = text.slice(0, mentionCursorPos - (mentionQuery?.length || 0) - 1);
    const textAfter = text.slice(mentionCursorPos);
    const newText = `${textBefore}@${username} ${textAfter}`;
    setText(newText);
    setMentionQuery(null);
    textInputRef.current?.focus();
  };

  const filteredUsers = mentionQuery !== null 
    ? allUsers.filter(u => u.username.toLowerCase().startsWith(mentionQuery.toLowerCase()))
    : [];

  return (
    <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 relative z-20">
      
      {/* Mention Popup */}
      {mentionQuery !== null && filteredUsers.length > 0 && (
        <div className="absolute bottom-full mb-2 left-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden min-w-[150px] max-h-48 overflow-y-auto">
          {filteredUsers.map((u, idx) => (
            <button
              key={`${u.id}-${idx}`}
              onClick={() => insertMention(u.username)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-neon-cyan/10 hover:text-neon-cyan flex items-center space-x-2 text-gray-700 dark:text-gray-300 transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-gray-500"></div>
              <span>{u.username}</span>
            </button>
          ))}
        </div>
      )}

      {/* Reply Preview */}
      {replyTo && (
        <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-2 rounded-t-lg border-l-4 border-neon-purple mb-2 animate-slide-up">
          <div className="flex flex-col text-sm">
            <span className="text-neon-purple font-bold">Replying to {replyTo.username}</span>
            <span className="text-gray-500 truncate max-w-xs">{replyTo.type === 'text' ? replyTo.content : `[${replyTo.type}]`}</span>
          </div>
          <button onClick={onCancelReply} className="text-gray-500 hover:text-red-500">
            <X size={16} />
          </button>
        </div>
      )}

      {/* File Preview */}
      {preview && (
        <div className="relative inline-block mb-2">
          {fileType === 'image' && <img src={preview} alt="preview" className="h-20 w-auto rounded border border-neon-cyan" />}
          {fileType === 'video' && <video src={preview} className="h-20 w-auto rounded border border-neon-cyan" />}
          {fileType === 'audio' && <div className="h-10 w-40 bg-gray-800 flex items-center justify-center rounded border border-neon-cyan text-neon-cyan"><Mic size={20} /> Audio</div>}
          <button 
            onClick={() => { setPreview(null); setSelectedFile(null); setFileType('text'); }}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Input Bar */}
      <div className="flex items-end space-x-2">
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="p-3 text-gray-500 hover:text-neon-cyan dark:bg-gray-800 bg-gray-100 rounded-full transition-colors"
          title="Upload Media"
        >
          <Paperclip size={20} />
        </button>
        
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*,video/*,audio/*"
          onChange={handleFileSelect}
        />

        <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center border border-transparent transition-all">
          <textarea 
            ref={textInputRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={selectedFile ? "Add a caption..." : "Type a message..."}
            className="w-full bg-transparent border-none focus:ring-0 p-3 max-h-32 resize-none text-gray-900 dark:text-gray-100 placeholder-gray-500"
            rows={1}
            style={{ minHeight: '44px' }}
          />
        </div>

        <button 
          onClick={handleSend}
          disabled={!text.trim() && !selectedFile}
          className="p-3 bg-neon-cyan/20 text-neon-cyan rounded-full hover:bg-neon-cyan hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(0,255,255,0.2)]"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};