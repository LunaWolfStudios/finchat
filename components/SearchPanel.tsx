import React, { useState, useEffect } from 'react';
import { Search, X, User, Link as LinkIcon, MessageSquare, ArrowRight, Calendar, Layers } from 'lucide-react';
import { Message, MessageType, Channel } from '../types';
import { chatService } from '../services/chatService';

interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeChannelId: string;
  channels: Channel[];
  onJumpToMessage: (message: Message) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ isOpen, onClose, activeChannelId, channels, onJumpToMessage }) => {
  const [query, setQuery] = useState('');
  const [author, setAuthor] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<MessageType | 'link' | 'all'>('all');
  const [channelFilter, setChannelFilter] = useState<string>(activeChannelId);
  
  const [results, setResults] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounce search execution
  useEffect(() => {
    // If no filters are active, show nothing
    if (!query && !author && !startDate && !endDate && typeFilter === 'all' && channelFilter === activeChannelId) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        // Fetch from Server
        const searchResults = await chatService.searchMessages({
          query,
          username: author || undefined,
          date: startDate || undefined, // Simple date pass, refined below
          type: typeFilter === 'all' ? undefined : typeFilter,
          channelId: channelFilter
        });

        // Additional client-side filtering for Author/Date/Type 
        // (Since server currently primarily handles 'q' and 'channelId')
        const refined = searchResults.filter(msg => {
           let matches = true;
           if (author && !msg.username.toLowerCase().includes(author.toLowerCase())) matches = false;
           
           if (startDate || endDate) {
             const msgTime = new Date(msg.timestamp).getTime();
             if (startDate && msgTime < new Date(startDate).setHours(0,0,0,0)) matches = false;
             if (endDate && msgTime > new Date(endDate).setHours(23,59,59,999)) matches = false;
           }

           if (typeFilter !== 'all') {
              if (typeFilter === 'link') matches = /(https?:\/\/[^\s]+)/g.test(msg.content);
              else if (msg.type !== typeFilter) matches = false;
           }

           return matches;
        });

        setResults(refined.reverse()); // Newest first
      } catch (e) {
        console.error("Search error", e);
      } finally {
        setIsSearching(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [query, author, startDate, endDate, typeFilter, channelFilter]);

  const handleJump = (msg: Message) => {
    onJumpToMessage(msg);
    onClose();
  };

  const getChannelName = (id: string) => channels.find(c => c.id === id)?.name || 'Unknown';

  if (!isOpen) return null;

  return (
    <div className="absolute inset-y-0 right-0 z-40 w-full sm:w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl animate-slide-up flex flex-col">
      
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <h3 className="text-cyan-700 dark:text-neon-cyan font-display font-bold flex items-center">
          <Search size={18} className="mr-2" /> Search Filters
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Controls */}
      <div className="p-4 space-y-3 border-b border-gray-200 dark:border-gray-800">
        
        {/* Channel Filter */}
        <div className="relative">
             <Layers className="absolute left-3 top-2.5 text-gray-500" size={16} />
             <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-1 focus:ring-neon-cyan focus:outline-none text-gray-900 dark:text-gray-100 border-none appearance-none"
             >
                <option value={activeChannelId}>Current Channel</option>
                <option value="all">All Channels</option>
                <option disabled>──────────</option>
                {channels.map(c => (
                   <option key={c.id} value={c.id}>#{c.name}</option>
                ))}
             </select>
        </div>

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
                        ? 'bg-purple-100 dark:bg-neon-purple/20 border-purple-500 dark:border-neon-purple text-purple-700 dark:text-neon-purple' 
                        : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-500'
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
          <span>{isSearching ? 'Searching...' : `${results.length} Matches`}</span>
          {(query || author || startDate || endDate || typeFilter !== 'all' || channelFilter !== activeChannelId) && (
              <button 
                onClick={() => { setQuery(''); setAuthor(''); setStartDate(''); setEndDate(''); setTypeFilter('all'); setChannelFilter(activeChannelId); }}
                className="text-pink-600 dark:text-neon-pink hover:underline"
              >
                  Clear All
              </button>
          )}
        </div>

        {!isSearching && results.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">
            <p>No results found.</p>
          </div>
        ) : (
          results.map(msg => (
            <div 
              key={msg.id}
              onClick={() => handleJump(msg)}
              className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-cyan-500/50 dark:hover:border-neon-cyan cursor-pointer group transition-all"
            >
              <div className="flex justify-between items-start mb-1">
                <div className="flex flex-col">
                    <span className="font-bold text-xs text-purple-700 dark:text-neon-purple">{msg.username}</span>
                    <span className="text-[10px] text-gray-400 bg-gray-200 dark:bg-gray-700 px-1 rounded w-fit mt-0.5">#{getChannelName(msg.channelId)}</span>
                </div>
                <span className="text-[10px] text-gray-500">{new Date(msg.timestamp).toLocaleDateString()}</span>
              </div>
              <div className="text-sm text-gray-800 dark:text-gray-300 line-clamp-3 mt-1">
                {msg.deleted ? <span className="italic text-gray-500">Deleted message</span> : 
                 msg.type === 'image' ? <span className="text-gray-400 italic flex items-center gap-1">Image Upload</span> :
                 msg.type === 'video' ? <span className="text-gray-400 italic flex items-center gap-1">Video Upload</span> :
                 msg.type === 'audio' ? <span className="text-gray-400 italic flex items-center gap-1">Audio Upload</span> :
                 msg.content
                }
              </div>
              <div className="mt-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                 <span className="text-xs text-cyan-700 dark:text-neon-cyan flex items-center">Jump <ArrowRight size={12} className="ml-1"/></span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};