import React, { useState, useEffect } from 'react';
import { Search, X, User, Link as LinkIcon, MessageSquare, ArrowRight, Calendar } from 'lucide-react';
import { Message, MessageType } from '../types';

interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  onJumpToMessage: (id: string) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ isOpen, onClose, messages, onJumpToMessage }) => {
  const [query, setQuery] = useState('');
  const [author, setAuthor] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<MessageType | 'link' | 'all'>('all');
  const [results, setResults] = useState<Message[]>([]);

  useEffect(() => {
    // If no filters are active, show nothing
    if (!query && !author && !startDate && !endDate && typeFilter === 'all') {
      setResults([]);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const lowerAuthor = author.toLowerCase();
    
    const filtered = messages.filter(msg => {
      // 1. Text Search (Content)
      const matchesQuery = !lowerQuery || msg.content.toLowerCase().includes(lowerQuery);

      // 2. Author Search
      const matchesAuthor = !lowerAuthor || msg.username.toLowerCase().includes(lowerAuthor);

      // 3. Date Search
      let matchesDate = true;
      if (startDate || endDate) {
        const msgTime = new Date(msg.timestamp).getTime();
        if (startDate) {
           const start = new Date(startDate).setHours(0,0,0,0);
           if (msgTime < start) matchesDate = false;
        }
        if (endDate && matchesDate) {
           const end = new Date(endDate).setHours(23,59,59,999);
           if (msgTime > end) matchesDate = false;
        }
      }

      // 4. Type Search
      let matchesType = true;
      if (typeFilter !== 'all') {
        if (typeFilter === 'link') {
          matchesType = /(https?:\/\/[^\s]+)/g.test(msg.content);
        } else {
          matchesType = msg.type === typeFilter;
        }
      }

      return matchesQuery && matchesAuthor && matchesDate && matchesType;
    });

    setResults(filtered.reverse()); // Show newest first
  }, [query, author, startDate, endDate, typeFilter, messages]);

  const handleJump = (id: string) => {
    onJumpToMessage(id);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-y-0 right-0 z-40 w-full sm:w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl animate-slide-up flex flex-col">
      
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <h3 className="text-neon-cyan font-display font-bold flex items-center">
          <Search size={18} className="mr-2" /> Search Filters
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Controls */}
      <div className="p-4 space-y-3 border-b border-gray-800">
        {/* Content Search */}
        <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
            <input 
                type="text" 
                placeholder="Search content..." 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-1 focus:ring-neon-cyan focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-500"
                autoFocus
            />
        </div>

        {/* Author Search */}
        <div className="relative">
            <User className="absolute left-3 top-2.5 text-gray-500" size={16} />
            <input 
                type="text" 
                placeholder="Filter by author..." 
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-1 focus:ring-neon-cyan focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-500"
            />
        </div>

        {/* Date Range */}
        <div className="flex space-x-2">
            <div className="flex-1 relative">
                <div className="absolute left-3 top-2.5 pointer-events-none text-gray-500"><Calendar size={14}/></div>
                <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg pl-8 pr-2 py-2 text-xs focus:ring-1 focus:ring-neon-cyan focus:outline-none text-gray-900 dark:text-gray-100 dark:[color-scheme:dark]"
                    placeholder="From"
                />
            </div>
            <div className="flex-1 relative">
                <div className="absolute left-3 top-2.5 pointer-events-none text-gray-500"><Calendar size={14}/></div>
                <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg pl-8 pr-2 py-2 text-xs focus:ring-1 focus:ring-neon-cyan focus:outline-none text-gray-900 dark:text-gray-100 dark:[color-scheme:dark]"
                    placeholder="To"
                />
            </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 pt-1">
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
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex justify-between">
          <span>{results.length} Matches</span>
          {(query || author || startDate || endDate || typeFilter !== 'all') && (
              <button 
                onClick={() => { setQuery(''); setAuthor(''); setStartDate(''); setEndDate(''); setTypeFilter('all'); }}
                className="text-neon-pink hover:underline"
              >
                  Clear All
              </button>
          )}
        </div>

        {results.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">
            <p>No results found.</p>
          </div>
        ) : (
          results.map(msg => (
            <div 
              key={msg.id}
              onClick={() => handleJump(msg.id)}
              className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-neon-cyan cursor-pointer group transition-all"
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-xs text-neon-purple">{msg.username}</span>
                <span className="text-[10px] text-gray-500">{new Date(msg.timestamp).toLocaleDateString()} {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
              <div className="text-sm text-gray-800 dark:text-gray-300 line-clamp-3">
                {msg.deleted ? <span className="italic text-gray-500">Deleted message</span> : 
                 msg.type === 'image' ? <span className="text-gray-400 italic flex items-center gap-1">Image Upload</span> :
                 msg.type === 'video' ? <span className="text-gray-400 italic flex items-center gap-1">Video Upload</span> :
                 msg.type === 'audio' ? <span className="text-gray-400 italic flex items-center gap-1">Audio Upload</span> :
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