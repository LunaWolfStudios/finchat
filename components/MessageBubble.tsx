import React, { useState, useEffect, useRef } from 'react';
import { Message, LinkPreview, User } from '../types';
import { Edit2, Trash2, Reply, ExternalLink, Smile, X, Copy, Check, FileText, Download } from 'lucide-react';
import { chatService } from '../services/chatService';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  onReply: (message: Message) => void;
  onEdit: (id: string, newContent: string) => void;
  onDelete: (id: string) => void;
  scrollToMessage: (id: string) => void;
  currentUser: User | null;
  getReplySnippet?: (id: string) => string;
}

// --- Rich Text Parser Components ---

const LinkPreviewCard: React.FC<{ url: string, onRemove?: () => void, canRemove?: boolean }> = ({ url, onRemove, canRemove }) => {
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
    <div className="relative group/preview">
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
      {canRemove && onRemove && (
        <button 
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
          className="absolute -top-2 -right-2 bg-gray-800 text-gray-400 hover:text-red-500 rounded-full p-1 opacity-0 group-hover/preview:opacity-100 transition-opacity shadow-md border border-gray-600"
          title="Remove Preview"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
};

const FormatInline: React.FC<{ text: string, hiddenPreviews?: string[], onRemovePreview?: (url: string) => void, canRemovePreview?: boolean }> = ({ text, hiddenPreviews = [], onRemovePreview, canRemovePreview }) => {
  const codeParts = text.split(/(`[^`]+`)/g);
  
  return (
    <>
      {codeParts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return <code key={i} className="bg-black/30 text-neon-pink px-1.5 py-0.5 rounded text-xs font-mono mx-0.5">{part.slice(1, -1)}</code>;
        }

        // Regex to capture <url> OR url
        const urlRegex = /(<https?:\/\/[^\s>]+>)|(https?:\/\/[^\s]+)/g;
        const urlParts = part.split(urlRegex);

        return (
          <span key={i}>
            {urlParts.map((subPart, j) => {
              if (!subPart) return null; 

              if (subPart.startsWith('<') && subPart.endsWith('>') && subPart.match(/<https?:\/\//)) {
                const cleanUrl = subPart.slice(1, -1);
                return (
                  <a 
                    key={j}
                    href={cleanUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-600 dark:text-neon-cyan underline hover:text-blue-800 dark:hover:text-white break-all inline-flex items-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {cleanUrl} <ExternalLink size={10} className="ml-1 inline" />
                  </a>
                );
              }

              if (subPart.match(/^https?:\/\//)) {
                const isHidden = hiddenPreviews.includes(subPart);
                return (
                  <span key={j}>
                    <a 
                      href={subPart} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-600 dark:text-neon-cyan underline hover:text-blue-800 dark:hover:text-white break-all inline-flex items-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {subPart} <ExternalLink size={10} className="ml-1 inline" />
                    </a>
                    {!isHidden && (
                      <LinkPreviewCard 
                        url={subPart} 
                        canRemove={canRemovePreview} 
                        onRemove={() => onRemovePreview && onRemovePreview(subPart)} 
                      />
                    )}
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
                            
                            // Regex to include hyphens and underscores for usernames
                            const mentionParts = strikePart.split(/(@[\w-]+)/g);
                            return (
                                <span key={l}>
                                    {mentionParts.map((mPart, m) => {
                                        if (mPart.match(/^@[\w-]+$/)) {
                                            return <span key={m} className="font-bold text-blue-600 dark:text-blue-400">{mPart}</span>;
                                        }
                                        return <span key={m}>{mPart}</span>;
                                    })}
                                </span>
                            );
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

const RichTextRenderer: React.FC<{ content: string, message: Message, onRemovePreview?: (url: string) => void, canEdit?: boolean }> = ({ content, message, onRemovePreview, canEdit }) => {
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
                    <FormatInline text={line.slice(2)} hiddenPreviews={message.hiddenPreviews} />
                  </div>
                );
              }
              return (
                 <div key={j} className={wrapperClass}>
                    <FormatInline 
                      text={line} 
                      hiddenPreviews={message.hiddenPreviews}
                      onRemovePreview={onRemovePreview}
                      canRemovePreview={canEdit}
                    />
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
    // onSelect handles the storage update via handleEmojiSelect in parent
    onSelect(emoji);
    onClose();
  };

  return (
    <div className="absolute bottom-full mb-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-3 shadow-2xl z-50 w-64 animate-slide-up">
      <div className="flex justify-between items-center mb-2 pb-1 border-b border-gray-200 dark:border-gray-700">
        <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider">Reactions</span>
        <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white"><XIcon size={14}/></button>
      </div>
      
      {recents.length > 0 && (
        <div className="mb-2">
           <span className="text-[10px] text-gray-500 mb-1 block">Recently Used</span>
           <div className="grid grid-cols-8 gap-1">
             {recents.map(e => (
               <button key={e} onClick={() => handleSelect(e)} className="hover:bg-gray-100 dark:hover:bg-white/20 rounded p-1 text-base transition">{e}</button>
             ))}
           </div>
        </div>
      )}
      
      <div className="grid grid-cols-8 gap-1">
        {DEFAULT_EMOJIS.map(e => (
          <button key={e} onClick={() => handleSelect(e)} className="hover:bg-gray-100 dark:hover:bg-white/20 rounded p-1 text-base transition">{e}</button>
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
  currentUser,
  getReplySnippet
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [isCopied, setIsCopied] = useState(false);
  
  // Mobile Interaction State
  const [showMobileOptions, setShowMobileOptions] = useState(false);
  const touchTimer = useRef<NodeJS.Timeout | null>(null);

  // Initialize recents
  useEffect(() => {
    if (isHovered || showReactionPicker || showMobileOptions) {
      const stored = localStorage.getItem('finchat_recent_emojis');
      if (stored) {
        try {
          setRecentEmojis(JSON.parse(stored).slice(0, 3));
        } catch (e) {}
      }
    }
  }, [isHovered, showReactionPicker, showMobileOptions]);

  const handleSaveEdit = () => {
    if (editContent.trim() !== message.content) {
      onEdit(message.id, editContent);
    }
    setIsEditing(false);
  };

  const handleReaction = (emoji: string) => {
    if (!currentUser) return;
    chatService.toggleReaction(message.id, emoji, currentUser.id);
    setShowMobileOptions(false);
  };

  const handleEmojiSelect = (emoji: string) => {
    const stored = localStorage.getItem('finchat_recent_emojis');
    const current = stored ? JSON.parse(stored) : [];
    const newRecents = [emoji, ...current.filter((e: string) => e !== emoji)].slice(0, 8);
    localStorage.setItem('finchat_recent_emojis', JSON.stringify(newRecents));
    
    // Update local state immediately so UI reflects it
    setRecentEmojis(newRecents.slice(0, 3));
    
    handleReaction(emoji);
  };
  
  const handleRemovePreview = (url: string) => {
    chatService.removePreview(message, url);
  };

  const handleCopy = () => {
    // Attempt standard copy
    const textToCopy = message.content;
    const onSuccess = () => {
        setIsCopied(true);
        setShowMobileOptions(false);
        setTimeout(() => setIsCopied(false), 2000);
    };

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textToCopy)
            .then(onSuccess)
            .catch(err => {
                console.error('Clipboard API failed', err);
                fallbackCopy(textToCopy, onSuccess);
            });
    } else {
        fallbackCopy(textToCopy, onSuccess);
    }
  };

  const fallbackCopy = (text: string, onSuccess: () => void) => {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
          document.execCommand('copy');
          onSuccess();
      } catch (err) {
          console.error('Fallback copy failed', err);
      }
      document.body.removeChild(textArea);
  };

  // --- Interaction Logic ---
  const handleTouchStart = () => {
    touchTimer.current = setTimeout(() => {
      setShowMobileOptions(true);
    }, 300); // 300ms long press triggers options (Shortened)
  };

  const handleTouchEnd = () => {
    if (touchTimer.current) clearTimeout(touchTimer.current);
  };

  const handleTouchMove = () => {
    if (touchTimer.current) clearTimeout(touchTimer.current);
  };

  const handleDoubleClick = () => {
    setShowMobileOptions(true);
  };

  const isMentioned = currentUser && !isOwnMessage && message.content.includes(`@${currentUser.username}`);

  const renderContent = () => {
    if (message.deleted) {
      return <span className="italic text-gray-500">Message deleted</span>;
    }

    if (message.type === 'image') {
      return (
        <div className="relative group rounded-lg overflow-hidden border border-white/10 mt-1 max-w-full">
           <img src={message.content} alt="User upload" className="w-full h-auto object-cover max-h-64" />
        </div>
      );
    }
    
    if (message.type === 'video') {
      return (
        <div className="relative rounded-lg overflow-hidden border border-white/10 mt-1 max-w-full">
          <video src={message.content} controls className="w-full max-h-64 bg-black" />
        </div>
      );
    }

    if (message.type === 'audio') {
      return (
         <div className="mt-1 min-w-[200px] max-w-full">
           <audio src={message.content} controls className="w-full h-10" />
         </div>
      );
    }

    if (message.type === 'file') {
       return (
         <a 
           href={message.content} 
           target="_blank" 
           rel="noopener noreferrer" 
           className="mt-1 flex items-center p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-black/30 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors group/file min-w-[200px]"
           onClick={(e) => e.stopPropagation()}
         >
            <div className="p-2 rounded bg-neon-purple/20 text-neon-purple mr-3">
               <FileText size={24} />
            </div>
            <div className="flex-1 min-w-0">
               <div className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{message.fileName || 'Unknown File'}</div>
               <div className="text-[10px] text-gray-500 uppercase tracking-wide">Download File</div>
            </div>
            <div className="ml-2 text-gray-400 group-hover/file:text-neon-cyan transition-colors">
               <Download size={20} />
            </div>
         </a>
       );
    }

    return <RichTextRenderer 
             content={message.content} 
             message={message} 
             onRemovePreview={handleRemovePreview}
             canEdit={isOwnMessage}
           />;
  };

  // Helper for reply preview
  const replySnippet = message.replyTo && getReplySnippet ? getReplySnippet(message.replyTo) : "Message unavailable";

  return (
    <>
      <div 
        className={`group flex flex-col mb-4 animate-slide-up ${isOwnMessage ? 'items-end' : 'items-start'}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        id={`msg-${message.id}`}
      >
        <div className={`flex flex-col max-w-[95%] md:max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
          
          {/* Username & Timestamp */}
          <div className="flex items-center space-x-2 mb-1 px-1">
            <span className={`text-xs font-display font-bold ${isOwnMessage ? 'text-cyan-600 dark:text-neon-cyan' : 'text-purple-600 dark:text-neon-purple'}`}>
              {message.username}
            </span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Reply Context */}
          {message.replyTo && (
            <div 
              className="text-xs text-gray-400 mb-1 border-l-2 border-neon-pink pl-2 cursor-pointer hover:text-white transition-colors max-w-full truncate"
              onClick={() => scrollToMessage(message.replyTo!)}
            >
              <span className="font-bold opacity-70">Replying to: </span>
              <span className="italic">{replySnippet.length > 50 ? replySnippet.substring(0, 50) + '...' : replySnippet}</span>
            </div>
          )}

          {/* Bubble Container */}
          <div 
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onDoubleClick={handleDoubleClick}
            className={`
            relative px-4 py-3 rounded-2xl shadow-md transition-all duration-300 min-w-[120px] cursor-default
            group-hover:brightness-110 group-hover:shadow-lg
            ${isOwnMessage 
              ? 'bg-neon-cyan/10 border border-neon-cyan/30 text-gray-900 dark:text-gray-100 rounded-tr-sm' 
              : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-tl-sm'
            }
            ${isMentioned ? 'bg-yellow-500/20 dark:bg-yellow-500/10 border-2 border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)]' : ''}
          `}>
            {isEditing ? (
              <div className="flex flex-col space-y-2 min-w-[200px] w-full" onClick={e => e.stopPropagation()}>
                <textarea 
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="bg-black/20 text-sm p-2 rounded focus:outline-none focus:ring-1 focus:ring-neon-cyan w-full text-white resize-none"
                  rows={Math.max(3, Math.min(10, editContent.split('\n').length + 1))}
                  style={{ minHeight: '80px' }}
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

            {/* Desktop Action Toolbar (Side-Aligned) */}
            {!message.deleted && (
              <div 
                onClick={(e) => e.stopPropagation()}
                className={`
                hidden md:flex absolute top-0 bottom-0 m-auto h-fit
                ${isOwnMessage ? 'right-full mr-2' : 'left-full ml-2'} 
                items-center gap-1
                transition-opacity duration-200 z-10 
                ${isHovered || showReactionPicker ? 'opacity-100' : 'opacity-0 pointer-events-none'}
              `}>
                <div className="flex items-center gap-1 bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 rounded-lg p-1.5 shadow-xl backdrop-blur-sm">
                  {/* Quick Reactions */}
                  {recentEmojis.map(emoji => (
                    <button 
                      key={emoji}
                      onClick={() => handleEmojiSelect(emoji)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded text-base transition-colors min-w-[24px] flex items-center justify-center"
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}

                  {recentEmojis.length > 0 && <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-0.5"></div>}

                  <div className="relative">
                    <button onClick={() => setShowReactionPicker(!showReactionPicker)} className="p-1 hover:text-yellow-600 dark:hover:text-yellow-400 text-gray-500 dark:text-gray-400" title="React">
                      <Smile size={16} />
                    </button>
                    {showReactionPicker && (
                      <ReactionPicker onSelect={handleEmojiSelect} onClose={() => setShowReactionPicker(false)} />
                    )}
                  </div>
                  <button 
                    onClick={() => onReply(message)} 
                    className="p-1 hover:text-cyan-600 dark:hover:text-neon-cyan text-gray-500 dark:text-gray-400" 
                    title="Reply"
                  >
                    <Reply size={16} />
                  </button>
                  
                  <button onClick={handleCopy} className="p-1 hover:text-green-600 dark:hover:text-green-400 text-gray-500 dark:text-gray-400" title="Copy">
                      {isCopied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                  </button>

                  {isOwnMessage && message.type === 'text' && (
                    <button 
                      onClick={() => setIsEditing(true)} 
                      className="p-1 hover:text-purple-600 dark:hover:text-neon-purple text-gray-500 dark:text-gray-400" 
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                  )}
                  {isOwnMessage && (
                    <button 
                      onClick={() => onDelete(message.id)} 
                      className="p-1 hover:text-pink-600 dark:hover:text-neon-pink text-gray-500 dark:text-gray-400" 
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
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
                        ? 'bg-cyan-100 dark:bg-neon-cyan/20 border-cyan-500 dark:border-neon-cyan text-cyan-700 dark:text-neon-cyan' 
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
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

      {/* Mobile/Desktop Action Sheet (Long Press / Double Click) */}
      {showMobileOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           {/* Backdrop */}
           <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMobileOptions(false)}></div>
           
           {/* Modal Content */}
           <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl w-full max-w-xs p-4 shadow-2xl animate-slide-up overflow-hidden">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="text-neon-purple dark:text-neon-cyan font-bold text-sm uppercase tracking-wide">Message Options</h3>
                 <button onClick={() => setShowMobileOptions(false)} className="text-gray-400"><X size={18}/></button>
              </div>

              {/* Recent Reactions */}
              {recentEmojis.length > 0 && (
                <div className="mb-3">
                    <div className="text-[10px] text-gray-500 mb-1">Recent</div>
                    <div className="flex gap-2">
                        {recentEmojis.map(emoji => (
                             <button 
                                key={`rec-${emoji}`} 
                                onClick={() => handleEmojiSelect(emoji)}
                                className="text-xl p-2 bg-gray-100 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                              >
                                {emoji}
                              </button>
                        ))}
                    </div>
                </div>
              )}

              {/* Default Reaction Grid */}
              <div className="text-[10px] text-gray-500 mb-1">All</div>
              <div className="grid grid-cols-6 gap-2 mb-4 max-h-48 overflow-y-auto">
                 {DEFAULT_EMOJIS.map(emoji => (
                    <button 
                      key={emoji} 
                      onClick={() => handleEmojiSelect(emoji)}
                      className="text-xl p-2 bg-gray-100 dark:bg-gray-800 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                      {emoji}
                    </button>
                 ))}
              </div>

              {/* Actions List */}
              <div className="flex flex-col space-y-2">
                 <button 
                    onClick={() => { onReply(message); setShowMobileOptions(false); }}
                    className="flex items-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700"
                 >
                    <Reply size={18} className="mr-3 text-neon-cyan"/> Reply
                 </button>
                 
                 <button 
                    onClick={handleCopy}
                    className="flex items-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700"
                 >
                    {isCopied ? <Check size={18} className="mr-3 text-green-500"/> : <Copy size={18} className="mr-3 text-green-400"/>} 
                    {isCopied ? "Copied!" : "Copy Text"}
                 </button>

                 {isOwnMessage && message.type === 'text' && (
                   <button 
                      onClick={() => { setIsEditing(true); setShowMobileOptions(false); }}
                      className="flex items-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700"
                   >
                      <Edit2 size={18} className="mr-3 text-neon-purple"/> Edit
                   </button>
                 )}

                 {isOwnMessage && (
                   <button 
                      onClick={() => { onDelete(message.id); setShowMobileOptions(false); }}
                      className="flex items-center p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700"
                   >
                      <Trash2 size={18} className="mr-3 text-neon-pink"/> Delete
                   </button>
                 )}
              </div>
           </div>
        </div>
      )}
    </>
  );
};