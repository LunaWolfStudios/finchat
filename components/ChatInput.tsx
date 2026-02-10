import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Video, Mic, X, Paperclip, FileText, File as FileGeneric, UploadCloud, Smartphone } from 'lucide-react';
import { MAX_FILE_SIZE_BYTES } from '../constants';
import { Message, MessageType, User } from '../types';

interface ChatInputProps {
  onSendMessage: (content: string, type: MessageType, file?: File) => void;
  replyTo: Message | null;
  onCancelReply: () => void;
  allUsers: User[];
  onlineUsers: User[]; // Need this for correct status in mentions
}

interface PreviewItem {
  id: string;
  file: File;
  url: string;
  type: MessageType;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, replyTo, onCancelReply, allUsers = [], onlineUsers = [] }) => {
  const [text, setText] = useState('');
  const [previews, setPreviews] = useState<PreviewItem[]>([]);
  
  // Drag State
  const [isDragging, setIsDragging] = useState(false);
  
  // Mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionCursorPos, setMentionCursorPos] = useState<number>(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus input when replying
  useEffect(() => {
    if (replyTo && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [replyTo]);

  // --- File Processing Logic ---
  const processFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    
    if (previews.length + files.length > 100) {
      alert("You can only upload up to 100 files at a time.");
      return;
    }

    const newPreviews: PreviewItem[] = [];
    const promises = files.map(file => new Promise<void>(resolve => {
        if (file.size > MAX_FILE_SIZE_BYTES) {
            console.warn(`File ${file.name} too large.`);
            resolve();
            return;
        }

        let type: MessageType = 'file';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';
        else if (file.type.startsWith('audio/')) type = 'audio';
        
        const isText = file.type.startsWith('text/') || 
                       file.type === 'application/json' ||
                       file.name.match(/\.(txt|md|csv|json|js|ts|tsx|jsx|html|css|py|java|c|cpp|h|xml|log)$/i);

        const reader = new FileReader();

        const onRead = (result: string) => {
             newPreviews.push({
                 id: Math.random().toString(36).substring(7) + Date.now(),
                 file,
                 url: result,
                 type
             });
             resolve();
        };

        if (isText) {
           reader.onload = (e) => {
             const res = e.target?.result as string;
             // Truncate text preview to prevent massive memory usage in state
             onRead(res.slice(0, 2000) + (res.length > 2000 ? '...\n(Preview Truncated)' : ''));
           };
           reader.readAsText(file);
        } else {
           reader.onload = (e) => onRead(e.target?.result as string);
           reader.readAsDataURL(file);
        }
    }));

    await Promise.all(promises);
    setPreviews(prev => [...prev, ...newPreviews]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
    }
    // Reset so the same file can be selected again if needed
    e.target.value = '';
  };

  const removePreview = (id: string) => {
      setPreviews(prev => prev.filter(p => p.id !== id));
  };

  // --- Drag & Drop Handlers ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  };

  // --- Send Logic ---
  const handleSend = () => {
    if (!text.trim() && previews.length === 0) return;

    // 1. Send text message if it exists
    if (text.trim()) {
       // If there are files, the text acts as a separate message (caption logic style)
       onSendMessage(text, 'text');
    }

    // 2. Send all files as separate messages
    previews.forEach(item => {
        onSendMessage(item.url, item.type, item.file);
    });

    // Reset
    setText('');
    setPreviews([]);
    setMentionQuery(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onCancelReply();
  };

  const filteredUsers = mentionQuery !== null 
    ? allUsers.filter(u => u.username.toLowerCase().startsWith(mentionQuery.toLowerCase()))
    : [];

  const insertMention = (username: string) => {
    const textBefore = text.slice(0, mentionCursorPos - (mentionQuery?.length || 0) - 1);
    const textAfter = text.slice(mentionCursorPos);
    const newText = `${textBefore}@${username} ${textAfter}`;
    setText(newText);
    setMentionQuery(null);
    textInputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    
    // TAB Autocomplete
    if (e.key === 'Tab' && mentionQuery !== null && filteredUsers.length > 0) {
        e.preventDefault();
        insertMention(filteredUsers[0].username);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setText(newVal);
    
    // Logic for @mentions
    const cursor = e.target.selectionStart;
    const textBeforeCursor = newVal.slice(0, cursor);
    const lastWordMatch = textBeforeCursor.match(/@([\w.-]*)$/);

    if (lastWordMatch) {
      setMentionQuery(lastWordMatch[1]);
      setMentionCursorPos(cursor);
    } else {
      setMentionQuery(null);
    }
  };

  return (
    <div 
        className={`p-4 bg-white dark:bg-gray-900 border-t relative z-20 transition-colors duration-200
        ${isDragging ? 'border-neon-cyan bg-neon-cyan/5 dark:bg-neon-cyan/5' : 'border-gray-200 dark:border-gray-800'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm pointer-events-none">
           <div className="flex flex-col items-center text-neon-cyan animate-pulse">
              <UploadCloud size={48} className="mb-2" />
              <span className="font-display font-bold text-xl uppercase tracking-widest">Drop to Upload</span>
           </div>
        </div>
      )}

      {/* Mention Popup */}
      {mentionQuery !== null && filteredUsers.length > 0 && (
        <div className="absolute bottom-full mb-2 left-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden min-w-[150px] max-h-48 overflow-y-auto z-50">
          {filteredUsers.map((u, idx) => {
            const isOnline = onlineUsers.some(ou => ou.id === u.id);
            const mobileStatus = onlineUsers.find(ou => ou.id === u.id)?.isMobile;
            
            return (
              <button
                key={`${u.id}-${idx}`}
                onClick={() => insertMention(u.username)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-neon-cyan/10 hover:text-neon-cyan flex items-center space-x-2 text-gray-700 dark:text-gray-300 transition-colors"
              >
                {/* Avatar / Initials */}
                <div className="relative">
                    {u.avatar ? (
                        <img src={u.avatar} alt={u.username} className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-500 flex items-center justify-center text-[8px] font-bold text-white uppercase">
                            {u.username.substring(0,2)}
                        </div>
                    )}
                    
                    {/* Status Dot/Icon Overlay */}
                    {isOnline && (
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-white dark:border-gray-800 flex items-center justify-center bg-green-500`}>
                           {mobileStatus && <Smartphone size={8} className="text-white" />}
                        </div>
                    )}
                </div>

                <span className="flex-1 truncate">{u.username}</span>
              </button>
            );
          })}
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

      {/* File Previews Area (Horizontal Scroll) */}
      {previews.length > 0 && (
        <div className="flex space-x-2 overflow-x-auto pb-3 mb-1 custom-scrollbar animate-slide-up">
           {previews.map(item => (
              <div key={item.id} className="relative flex-shrink-0 w-24 group/item">
                 <button 
                    onClick={() => removePreview(item.id)}
                    className="absolute -top-1 -right-1 z-10 bg-red-500 text-white rounded-full p-0.5 shadow-md hover:bg-red-600 border border-white dark:border-gray-900 opacity-0 group-hover/item:opacity-100 transition-opacity"
                  >
                    <X size={10} />
                  </button>

                  <div className="rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-black/20 h-24 w-24 flex items-center justify-center relative">
                      {item.type === 'image' && (
                          <img src={item.url} alt="preview" className="h-full w-full object-cover" />
                      )}
                      {item.type === 'video' && (
                          <video src={item.url} className="h-full w-full object-cover" />
                      )}
                      {item.type === 'audio' && (
                          <div className="flex flex-col items-center justify-center p-1 text-center">
                             <Mic size={20} className="text-neon-cyan mb-1" />
                             <span className="text-[8px] text-gray-500 truncate w-full">{item.file.name}</span>
                          </div>
                      )}
                      {item.type === 'file' && (
                          <div className="flex flex-col items-center justify-center p-1 text-center">
                             <FileGeneric size={20} className="text-neon-purple mb-1" />
                             <span className="text-[8px] text-gray-500 truncate w-full">{item.file.name}</span>
                          </div>
                      )}
                      {/* Overlay name for images/videos */}
                      {(item.type === 'image' || item.type === 'video') && (
                          <div className="absolute bottom-0 inset-x-0 bg-black/60 p-0.5">
                             <p className="text-[8px] text-white truncate text-center">{item.file.name}</p>
                          </div>
                      )}
                  </div>
              </div>
           ))}
        </div>
      )}

      {/* Input Bar */}
      <div className="flex items-end space-x-2">
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="p-3 text-gray-500 hover:text-neon-cyan dark:bg-gray-800 bg-gray-100 rounded-full transition-colors flex-shrink-0"
          title="Upload File"
        >
          <Paperclip size={20} />
        </button>
        
        {/* Input accepts multiple files */}
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileSelect}
          multiple
        />

        <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center border border-transparent transition-all">
          <textarea 
            ref={textInputRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={previews.length > 0 ? "Add a caption / message..." : "Type a message..."}
            className="w-full bg-transparent border-none focus:ring-0 p-3 max-h-32 resize-none text-gray-900 dark:text-gray-100 placeholder-gray-500"
            rows={1}
            style={{ minHeight: '44px' }}
          />
        </div>

        <button 
          onClick={handleSend}
          disabled={!text.trim() && previews.length === 0}
          className="p-3 bg-neon-cyan/20 text-neon-cyan rounded-full hover:bg-neon-cyan hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(0,255,255,0.2)] flex-shrink-0"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};