import React, { useState, useEffect } from 'react';
import { Search, X, User, Link as LinkIcon, MessageSquare, ArrowRight } from 'lucide-react';
import { Message, MessageType } from '../types';

interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  onJumpToMessage: (id: string) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ isOpen, onClose, messages, onJumpToMessage }) => {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<MessageType | 'link' | 'all'>('all');
  const [results, setResults] = useState<Message[]>([]);

  useEffect(() => {
    if (!query && typeFilter === 'all') {
      setResults([]);
      return;
    }

    const lowerQuery = query.toLowerCase();
    
    const filtered = messages.filter(msg => {
      // 1. Text Search
      const matchesQuery = !lowerQuery || 
        msg.content.toLowerCase().includes(lowerQuery) || 
        msg.username.toLowerCase().includes(lowerQuery);

      // 2. Type Search
      let matchesType = true;
      if (typeFilter !== 'all') {
        if (typeFilter === 'link') {
          matchesType = /(https?:\/\/[^\s]+)/g.test(msg.content);
        } else {
          matchesType = msg.type === typeFilter;
        }
      }

      return matchesQuery && matchesType;
    });

    setResults(filtered.reverse()); // Show newest first
  }, [query, typeFilter, messages]);

  if (!isOpen) return null;

  return (
    <div className="absolute inset-y-0 right-0 z-40 w-full sm:w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl animate-slide-up flex flex-col">
      
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <h3 className="text-neon-cyan font-display font-bold flex items-center">
          <Search size={18} className="mr-2" /> Search
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Controls */}
      <div className="p-4 space-y-4">
        <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
            <input 
                type="text" 
                placeholder="Search messages..." 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-1 focus:ring-neon-cyan focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-500"
                autoFocus
            />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
            {(['all', 'image', 'video', 'link'] as const).map((t) => (
                <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-3 py-1 rounded-full text-xs border capitalize transition-all ${
                        typeFilter === t 
                        ? 'bg-neon-purple/20 border-neon-purple text-neon-purple' 
                        : 'border-gray-600 text-gray-400 hover:border-gray-400'
                    }`}
                >
                    {t}
                </button>
            ))}
        </div>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          {results.length} Matches
        </div>

        {results.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">
            <p>No results found.</p>
          </div>
        ) : (
          results.map(msg => (
            <div 
              key={msg.id}
              onClick={() => onJumpToMessage(msg.id)}
              className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-neon-cyan cursor-pointer group transition-all"
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-xs text-neon-purple">{msg.username}</span>
                <span className="text-[10px] text-gray-500">{new Date(msg.timestamp).toLocaleDateString()}</span>
              </div>
              <div className="text-sm text-gray-800 dark:text-gray-300 line-clamp-3">
                {msg.deleted ? <span className="italic text-gray-500">Deleted message</span> : 
                 msg.type === 'image' ? '[Image]' :
                 msg.type === 'video' ? '[Video]' :
                 msg.type === 'audio' ? '[Audio]' :
                 msg.content
                }
              </div>
              <div className="mt-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                 <span className="text-xs text-neon-cyan flex items-center">Jump <ArrowRight size={12} className="ml-1"/></span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};