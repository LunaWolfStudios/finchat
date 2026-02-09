import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Video, Mic, X, Paperclip, FileText, File as FileGeneric, UploadCloud } from 'lucide-react';
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
  const [preview, setPreview] = useState<string | null>(null); // Holds DataURL or Text Content
  const [fileType, setFileType] = useState<MessageType>('text');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
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
  const processFile = (file: File) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert(`File too large. Max size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`);
      return;
    }

    let type: MessageType = 'file';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('video/')) type = 'video';
    else if (file.type.startsWith('audio/')) type = 'audio';
    
    // Check for Text Files to preview content
    // Common text mime types or extensions
    const isText = file.type.startsWith('text/') || 
                   file.type === 'application/json' ||
                   file.name.match(/\.(txt|md|csv|json|js|ts|tsx|jsx|html|css|py|java|c|cpp|h|xml|log)$/i);

    setSelectedFile(file);
    setFileType(type);

    const reader = new FileReader();

    if (isText) {
       // Read as text for preview
       reader.onload = (e) => {
         // Limit preview to ~2000 chars to avoid UI lag
         const result = e.target?.result as string;
         setPreview(result.slice(0, 2000) + (result.length > 2000 ? '...\n(Preview Truncated)' : ''));
       };
       reader.readAsText(file);
    } else {
       // Read as DataURL for media or just to have a reference
       reader.onload = (e) => {
         setPreview(e.target?.result as string);
       };
       reader.readAsDataURL(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
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
    
    // Only set false if leaving the main container (not entering a child)
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  // --- Send Logic ---
  const handleSend = () => {
    if ((!text.trim() && !selectedFile) || (fileType !== 'text' && !preview)) return;

    if (selectedFile && preview) {
      // If it's a file type message, we send the preview (which might be DataURL) or handled by service
      // Service logic: if `file` is present, it uploads. `content` is fallback or URL.
      onSendMessage(selectedFile.name, fileType, selectedFile);
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

      {/* File Preview Area */}
      {preview && selectedFile && (
        <div className="relative mb-3 animate-slide-up">
           <button 
              onClick={() => { setPreview(null); setSelectedFile(null); setFileType('text'); }}
              className="absolute -top-2 -right-2 z-10 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 border border-white dark:border-gray-900"
            >
              <X size={12} />
            </button>

          {/* Media Previews */}
          {fileType === 'image' && (
             <div className="relative inline-block border border-neon-cyan/30 rounded-lg overflow-hidden bg-black/20">
                <img src={preview} alt="preview" className="h-32 w-auto object-contain" />
                <div className="absolute bottom-0 w-full bg-black/60 text-white text-[10px] p-1 truncate">{selectedFile.name}</div>
             </div>
          )}
          {fileType === 'video' && (
             <div className="relative inline-block border border-neon-cyan/30 rounded-lg overflow-hidden bg-black/20">
                 <video src={preview} className="h-32 w-auto" />
                 <div className="absolute bottom-0 w-full bg-black/60 text-white text-[10px] p-1 truncate">{selectedFile.name}</div>
             </div>
          )}
          {fileType === 'audio' && (
             <div className="inline-flex items-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-neon-cyan/50">
                <Mic size={24} className="text-neon-cyan mr-3" />
                <div className="flex flex-col">
                   <span className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate max-w-[150px]">{selectedFile.name}</span>
                   <span className="text-[10px] text-gray-500">Audio File</span>
                </div>
             </div>
          )}

          {/* Generic & Text File Preview */}
          {fileType === 'file' && (
            <div className="flex flex-col max-h-48 w-full max-w-lg">
                <div className="flex items-center p-2 bg-gray-100 dark:bg-gray-800 rounded-t-lg border border-gray-300 dark:border-gray-700">
                    <FileGeneric size={20} className="text-neon-purple mr-2" />
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{selectedFile.name}</span>
                    <span className="ml-auto text-[10px] text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                </div>
                {/* Text Content Reader */}
                <div className="bg-gray-50 dark:bg-black/40 p-3 rounded-b-lg border-x border-b border-gray-300 dark:border-gray-700 overflow-y-auto max-h-32 custom-scrollbar">
                   <pre className="text-[10px] font-mono text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words">
                      {/* Check if preview looks like Data URL (binary) or text */}
                      {preview.startsWith('data:') ? '(Binary File - No Text Preview)' : preview}
                   </pre>
                </div>
            </div>
          )}
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
        
        {/* Accept * to allow all files */}
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileSelect}
        />

        <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center border border-transparent transition-all">
          <textarea 
            ref={textInputRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={selectedFile ? "Add a caption (optional)..." : "Type a message..."}
            className="w-full bg-transparent border-none focus:ring-0 p-3 max-h-32 resize-none text-gray-900 dark:text-gray-100 placeholder-gray-500"
            rows={1}
            style={{ minHeight: '44px' }}
          />
        </div>

        <button 
          onClick={handleSend}
          disabled={!text.trim() && !selectedFile}
          className="p-3 bg-neon-cyan/20 text-neon-cyan rounded-full hover:bg-neon-cyan hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(0,255,255,0.2)] flex-shrink-0"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};