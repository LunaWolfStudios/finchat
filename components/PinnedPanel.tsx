import React from 'react';
import { Pin, X, ArrowRight, Trash2 } from 'lucide-react';
import { Message } from '../types';
import { chatService } from '../services/chatService';

interface PinnedPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  onJumpToMessage: (id: string) => void;
}

export const PinnedPanel: React.FC<PinnedPanelProps> = ({ isOpen, onClose, messages, onJumpToMessage }) => {
  const pinnedMessages = messages.filter(m => m.pinned && !m.deleted).reverse(); // Newest first

  if (!isOpen) return null;

  return (
    <div className="absolute inset-y-0 right-0 z-40 w-full sm:w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl animate-slide-up flex flex-col">
      
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <h3 className="text-cyan-700 dark:text-neon-cyan font-display font-bold flex items-center">
          <Pin size={18} className="mr-2" /> Pinned Messages
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {pinnedMessages.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">
            <p className="mb-2">No pinned messages yet.</p>
            <p className="text-xs">Pin messages in the chat to see them here.</p>
          </div>
        ) : (
          pinnedMessages.map(msg => (
            <div 
              key={msg.id}
              className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-cyan-500/50 dark:hover:border-neon-cyan group transition-all relative"
            >
              {/* Message Header */}
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-xs text-purple-700 dark:text-neon-purple">{msg.username}</span>
                <span className="text-[10px] text-gray-500">
                  {new Date(msg.timestamp).toLocaleDateString()}
                </span>
              </div>
              
              {/* Message Content Snippet */}
              <div className="text-sm text-gray-800 dark:text-gray-300 line-clamp-4 cursor-pointer" onClick={() => { onJumpToMessage(msg.id); onClose(); }}>
                 {msg.type === 'image' ? <span className="text-gray-400 italic">Image Upload</span> :
                 msg.type === 'video' ? <span className="text-gray-400 italic">Video Upload</span> :
                 msg.type === 'audio' ? <span className="text-gray-400 italic">Audio Upload</span> :
                 msg.type === 'file' ? <span className="text-gray-400 italic">File Attachment</span> :
                 msg.content
                }
              </div>

              {/* Actions */}
              <div className="mt-3 flex justify-between items-center border-t border-gray-200 dark:border-gray-700 pt-2">
                 <button 
                    onClick={() => chatService.togglePin(msg.id)}
                    className="text-[10px] text-gray-400 hover:text-pink-600 dark:hover:text-neon-pink flex items-center transition-colors"
                    title="Unpin"
                 >
                    <Pin size={10} className="mr-1 rotate-45" /> Unpin
                 </button>
                 
                 <button 
                    onClick={() => { onJumpToMessage(msg.id); onClose(); }}
                    className="text-xs text-cyan-700 dark:text-neon-cyan flex items-center hover:text-black dark:hover:text-white transition-colors"
                 >
                    Jump <ArrowRight size={12} className="ml-1"/>
                 </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};