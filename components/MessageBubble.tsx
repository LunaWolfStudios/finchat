import React, { useState } from 'react';
import { Message } from '../types';
import { Edit2, Trash2, Reply, FileText } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  onReply: (message: Message) => void;
  onEdit: (id: string, newContent: string) => void;
  onDelete: (id: string) => void;
  scrollToMessage: (id: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  message, 
  isOwnMessage, 
  onReply, 
  onEdit, 
  onDelete,
  scrollToMessage
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const handleSaveEdit = () => {
    if (editContent.trim() !== message.content) {
      onEdit(message.id, editContent);
    }
    setIsEditing(false);
  };

  const renderContent = () => {
    if (message.deleted) {
      return <span className="italic text-gray-500">Message deleted</span>;
    }

    if (message.type === 'image') {
      return (
        <div className="relative group rounded-lg overflow-hidden border border-white/10 mt-1 max-w-sm">
           <img src={message.content} alt="User upload" className="w-full h-auto object-cover max-h-64" />
        </div>
      );
    }
    
    if (message.type === 'video') {
      return (
        <div className="relative rounded-lg overflow-hidden border border-white/10 mt-1 max-w-sm">
          <video src={message.content} controls className="w-full max-h-64 bg-black" />
        </div>
      );
    }

    if (message.type === 'audio') {
      return (
         <div className="mt-1 min-w-[200px]">
           <audio src={message.content} controls className="w-full h-10" />
         </div>
      );
    }

    return <p className="whitespace-pre-wrap break-words">{message.content}</p>;
  };

  return (
    <div 
      className={`group flex flex-col mb-4 animate-slide-up ${isOwnMessage ? 'items-end' : 'items-start'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      id={`msg-${message.id}`}
    >
      <div className={`flex flex-col max-w-[85%] md:max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
        
        {/* Username & Timestamp */}
        <div className="flex items-center space-x-2 mb-1 px-1">
          <span className={`text-xs font-display font-bold ${isOwnMessage ? 'text-neon-cyan' : 'text-neon-purple'}`}>
            {message.username}
          </span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Reply Context */}
        {message.replyTo && (
           <div 
             className="text-xs text-gray-400 mb-1 border-l-2 border-neon-pink pl-2 cursor-pointer hover:text-white transition-colors"
             onClick={() => scrollToMessage(message.replyTo!)}
           >
             Replying to message...
           </div>
        )}

        {/* Bubble */}
        <div className={`
          relative px-4 py-3 rounded-2xl shadow-md transition-all duration-200
          ${isOwnMessage 
            ? 'bg-neon-cyan/10 border border-neon-cyan/30 text-gray-900 dark:text-gray-100 rounded-tr-sm' 
            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-tl-sm'
          }
          ${isHovered ? 'shadow-lg' : ''}
        `}>
          {isEditing ? (
            <div className="flex flex-col space-y-2 min-w-[200px]">
              <textarea 
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="bg-black/20 text-sm p-2 rounded focus:outline-none focus:ring-1 focus:ring-neon-cyan w-full text-white"
                rows={2}
              />
              <div className="flex justify-end space-x-2">
                <button onClick={() => setIsEditing(false)} className="text-xs text-gray-400 hover:text-white">Cancel</button>
                <button onClick={handleSaveEdit} className="text-xs text-neon-cyan font-bold hover:text-white">Save</button>
              </div>
            </div>
          ) : (
            <>
              {renderContent()}
              {message.edited && !message.deleted && (
                <span className="text-[10px] text-gray-400 block text-right mt-1">(edited)</span>
              )}
            </>
          )}

          {/* Action Overlay */}
          {!message.deleted && (
            <div className={`
              absolute -top-3 ${isOwnMessage ? '-left-20' : '-right-20'} 
              flex items-center space-x-1 bg-gray-900/90 border border-gray-700 rounded-lg p-1
              transition-opacity duration-200
              ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}
            `}>
              <button onClick={() => onReply(message)} className="p-1 hover:text-neon-cyan text-gray-400" title="Reply">
                <Reply size={14} />
              </button>
              {isOwnMessage && message.type === 'text' && (
                <button onClick={() => setIsEditing(true)} className="p-1 hover:text-neon-purple text-gray-400" title="Edit">
                  <Edit2 size={14} />
                </button>
              )}
              {isOwnMessage && (
                <button onClick={() => onDelete(message.id)} className="p-1 hover:text-neon-pink text-gray-400" title="Delete">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};