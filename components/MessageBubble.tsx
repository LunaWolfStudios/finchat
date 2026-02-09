import React, { useState, useEffect } from 'react';
import { Message, LinkPreview, User } from '../types';
import { Edit2, Trash2, Reply, ExternalLink, Smile, X } from 'lucide-react';
import { chatService } from '../services/chatService';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  onReply: (message: Message) => void;
  onEdit: (id: string, newContent: string) => void;
  onDelete: (id: string) => void;
  scrollToMessage: (id: string) => void;
  currentUser: User | null;
}

// --- Rich Text Parser Components ---

const LinkPreviewCard: React.FC<{ url: string }> = ({ url }) => {
  const [data, setData] = useState<LinkPreview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    chatService.getLinkPreview(url).then(res => {
      if (mounted) {
        setData(res);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [url]);

  if (loading) return null; 
  if (!data || (!data.title && !data.image)) return null; 

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-2 max-w-sm rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 hover:border-neon-cyan transition-colors">
      {data.image && (
        <div className="h-32 w-full overflow-hidden relative bg-black/50">
           <img src={data.image} alt={data.title} className="w-full h-full object-cover" />
           <div className="absolute bottom-1 right-1 bg-black/70 px-1 rounded text-[10px] text-white uppercase font-bold tracking-wider">
             {data.siteName || new URL(url).hostname.replace('www.', '')}
           </div>
        </div>
      )}
      <div className="p-3">
        {data.title && <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100 line-clamp-2 leading-tight">{data.title}</h4>}
        {data.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{data.description}</p>}
      </div>
    </a>
  );
};

const FormatInline: React.FC<{ text: string }> = ({ text }) => {
  const codeParts = text.split(/(`[^`]+`)/g);
  
  return (
    <>
      {codeParts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return <code key={i} className="bg-black/30 text-neon-pink px-1.5 py-0.5 rounded text-xs font-mono mx-0.5">{part.slice(1, -1)}</code>;
        }

        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urlParts = part.split(urlRegex);

        return (
          <span key={i}>
            {urlParts.map((subPart, j) => {
              if (subPart.match(urlRegex)) {
                return (
                  <span key={j}>
                    <a 
                      href={subPart} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-neon-cyan underline hover:text-white break-all inline-flex items-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {subPart} <ExternalLink size={10} className="ml-1 inline" />
                    </a>
                    {/* Render Preview Card */}
                    <LinkPreviewCard url={subPart} />
                  </span>
                );
              }

              const boldParts = subPart.split(/(\*\*[^*]+\*\*)/g);
              return (
                <span key={j}>
                  {boldParts.map((boldPart, k) => {
                    if (boldPart.startsWith('**') && boldPart.endsWith('**') && boldPart.length > 4) {
                      return <strong key={k} className="font-bold text-neon-purple">{boldPart.slice(2, -2)}</strong>;
                    }
                    const strikeParts = boldPart.split(/(~~[^~]+~~)/g);
                    return (
                      <span key={k}>
                         {strikeParts.map((strikePart, l) => {
                            if (strikePart.startsWith('~~') && strikePart.endsWith('~~') && strikePart.length > 4) {
                              return <s key={l} className="opacity-70">{strikePart.slice(2, -2)}</s>;
                            }
                            return <span key={l}>{strikePart}</span>;
                         })}
                      </span>
                    )
                  })}
                </span>
              );
            })}
          </span>
        );
      })}
    </>
  );
};

const RichTextRenderer: React.FC<{ content: string }> = ({ content }) => {
  const codeBlocks = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
      {codeBlocks.map((block, i) => {
        if (block.startsWith('```') && block.endsWith('```')) {
          const codeContent = block.slice(3, -3).replace(/^\n/, '');
          return (
            <pre key={i} className="bg-black/40 border border-gray-700 p-3 rounded-lg my-2 overflow-x-auto custom-scrollbar font-mono text-xs text-gray-300">
              {codeContent}
            </pre>
          );
        }
        const lines = block.split('\n');
        return (
          <span key={i}>
            {lines.map((line, j) => {
              const isLast = j === lines.length - 1;
              const wrapperClass = isLast ? "" : "block min-h-[1.2em]";

              if (line.match(/^#{1,3}\s/)) {
                const level = line.match(/^(#{1,3})/)?.[0].length || 1;
                const text = line.replace(/^#{1,3}\s/, '');
                const sizeClass = level === 1 ? 'text-lg font-bold border-b border-gray-700 pb-1 mb-1 mt-2' : level === 2 ? 'text-base font-bold mt-2' : 'text-sm font-bold mt-1';
                return <div key={j} className={`${sizeClass} text-neon-cyan/90 font-display`}>{text}</div>;
              }
              if (line.startsWith('> ')) {
                return (
                  <div key={j} className="border-l-4 border-neon-pink/50 pl-3 py-1 my-1 bg-neon-pink/5 text-gray-400 italic">
                    <FormatInline text={line.slice(2)} />
                  </div>
                );
              }
              return (
                 <div key={j} className={wrapperClass}>
                    <FormatInline text={line} />
                 </div>
              );
            })}
          </span>
        );
      })}
    </div>
  );
};

// --- Emoji Picker ---
const DEFAULT_EMOJIS = [
  '👍', '👎', '❤️', '🔥', '😂', '😮', '😢', '🎉', 
  '🚀', '🤘', '💯', '👀', '🙌', '💀', '💩', '🤡',
  '❗', '❓', '✨', '⚡', '🧠', '🧊', '🤝', '🌮', 
  '🎵', '🎮', '👾', '🌈', '✅', '❌'
];

const ReactionPicker: React.FC<{ onSelect: (emoji: string) => void; onClose: () => void }> = ({ onSelect, onClose }) => {
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('finchat_recent_emojis');
    if (stored) setRecents(JSON.parse(stored));
  }, []);

  const handleSelect = (emoji: string) => {
    // Update recents
    const newRecents = [emoji, ...recents.filter(e => e !== emoji)].slice(0, 8);
    localStorage.setItem('finchat_recent_emojis', JSON.stringify(newRecents));
    setRecents(newRecents);
    
    onSelect(emoji);
    onClose();
  };

  return (
    <div className="absolute bottom-full mb-1 -left-2 bg-gray-900 border border-gray-600 rounded-lg p-3 shadow-2xl z-50 w-64 animate-slide-up">
      <div className="flex justify-between items-center mb-2 pb-1 border-b border-gray-700">
        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Reactions</span>
        <button onClick={onClose} className="text-gray-400 hover:text-white"><XIcon size={14}/></button>
      </div>
      
      {recents.length > 0 && (
        <div className="mb-2">
           <span className="text-[10px] text-gray-500 mb-1 block">Recently Used</span>
           <div className="grid grid-cols-8 gap-1">
             {recents.map(e => (
               <button key={e} onClick={() => handleSelect(e)} className="hover:bg-white/20 rounded p-1 text-base transition">{e}</button>
             ))}
           </div>
        </div>
      )}
      
      <div className="grid grid-cols-8 gap-1">
        {DEFAULT_EMOJIS.map(e => (
          <button key={e} onClick={() => handleSelect(e)} className="hover:bg-white/20 rounded p-1 text-base transition">{e}</button>
        ))}
      </div>
    </div>
  );
};
const XIcon = ({size}: {size:number}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>;

export const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  message, 
  isOwnMessage, 
  onReply, 
  onEdit, 
  onDelete,
  scrollToMessage,
  currentUser
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const handleSaveEdit = () => {
    if (editContent.trim() !== message.content) {
      onEdit(message.id, editContent);
    }
    setIsEditing(false);
  };

  const handleReaction = (emoji: string) => {
    if (!currentUser) return;
    chatService.toggleReaction(message.id, emoji, currentUser.id);
  };

  const isMentioned = currentUser && !isOwnMessage && message.content.includes(`@${currentUser.username}`);

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

    return <RichTextRenderer content={message.content} />;
  };

  return (
    <div 
      className={`group flex flex-col mb-4 animate-slide-up ${isOwnMessage ? 'items-end' : 'items-start'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      id={`msg-${message.id}`}
    >
      <div className={`flex flex-col max-w-[95%] md:max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
        
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
          relative px-4 py-3 rounded-2xl shadow-md transition-all duration-200 min-w-[120px]
          ${isOwnMessage 
            ? 'bg-neon-cyan/10 border border-neon-cyan/30 text-gray-900 dark:text-gray-100 rounded-tr-sm' 
            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-tl-sm'
          }
          ${isMentioned ? 'bg-yellow-500/10 border-l-4 border-l-yellow-500' : ''}
          ${isHovered ? 'shadow-lg' : ''}
        `}>
          {isEditing ? (
            <div className="flex flex-col space-y-2 min-w-[200px]">
              <textarea 
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="bg-black/20 text-sm p-2 rounded focus:outline-none focus:ring-1 focus:ring-neon-cyan w-full text-white"
                rows={3}
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
              transition-opacity duration-200 z-10
              ${isHovered || showReactionPicker ? 'opacity-100' : 'opacity-0 pointer-events-none'}
            `}>
              <div className="relative">
                <button onClick={() => setShowReactionPicker(!showReactionPicker)} className="p-1 hover:text-yellow-400 text-gray-400" title="React">
                  <Smile size={14} />
                </button>
                {showReactionPicker && (
                  <ReactionPicker onSelect={handleReaction} onClose={() => setShowReactionPicker(false)} />
                )}
              </div>
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

        {/* Reactions Display */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(message.reactions).map(([emoji, users]) => {
              const userIds = users as string[];
              return (
                <button 
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className={`
                    text-xs px-1.5 py-0.5 rounded-full border flex items-center gap-1 transition-colors
                    ${currentUser && userIds.includes(currentUser.id) 
                      ? 'bg-neon-cyan/20 border-neon-cyan text-neon-cyan' 
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                    }
                  `}
                >
                  <span>{emoji}</span>
                  <span className="font-mono text-[10px]">{userIds.length}</span>
                </button>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
};