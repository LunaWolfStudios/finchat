import React, { useState, useRef } from 'react';
import { Send, Image as ImageIcon, Video, Mic, X, Paperclip } from 'lucide-react';
import { MAX_FILE_SIZE_BYTES } from '../constants';
import { Message, MessageType } from '../types';

interface ChatInputProps {
  onSendMessage: (content: string, type: MessageType, file?: File) => void;
  replyTo: Message | null;
  onCancelReply: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, replyTo, onCancelReply }) => {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<MessageType>('text');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (fileInputRef.current) fileInputRef.current.value = '';
    onCancelReply();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 relative z-20">
      
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

        <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center border border-transparent focus-within:border-neon-purple transition-all">
          <textarea 
            value={text}
            onChange={(e) => setText(e.target.value)}
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