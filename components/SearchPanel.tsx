import React, { useState } from 'react';
import { Search, X, Calendar, User, ImageIcon } from 'lucide-react';
import { SearchFilters, MessageType } from '../types';

interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (filters: SearchFilters) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ isOpen, onClose, onSearch }) => {
  const [query, setQuery] = useState('');
  const [user, setUser] = useState('');
  const [type, setType] = useState<MessageType | 'all'>('all');

  const handleSearch = () => {
    onSearch({
      query,
      username: user || undefined,
      type: type === 'all' ? undefined : type
    });
  };

  const handleClear = () => {
      setQuery('');
      setUser('');
      setType('all');
      onSearch({ query: '' });
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-16 right-4 z-30 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-xl p-4 animate-slide-up">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-neon-cyan font-display font-bold">Search Filter</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X size={18} />
        </button>
      </div>

      <div className="space-y-4">
        {/* Keyword */}
        <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
            <input 
                type="text" 
                placeholder="Keyword..." 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-1 focus:ring-neon-cyan focus:outline-none"
            />
        </div>

        {/* User */}
        <div className="relative">
            <User className="absolute left-3 top-2.5 text-gray-500" size={16} />
            <input 
                type="text" 
                placeholder="Username..." 
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-1 focus:ring-neon-cyan focus:outline-none"
            />
        </div>

        {/* Type */}
        <div className="flex space-x-2">
            {(['all', 'image', 'video', 'audio'] as const).map((t) => (
                <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`px-3 py-1 rounded-full text-xs border capitalize transition-all ${
                        type === t 
                        ? 'bg-neon-purple/20 border-neon-purple text-neon-purple' 
                        : 'border-gray-600 text-gray-400 hover:border-gray-400'
                    }`}
                >
                    {t}
                </button>
            ))}
        </div>

        <div className="flex space-x-2 pt-2">
            <button 
                onClick={handleClear}
                className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-400 hover:text-white text-sm"
            >
                Clear
            </button>
            <button 
                onClick={handleSearch}
                className="flex-1 py-2 rounded-lg bg-neon-cyan/20 border border-neon-cyan text-neon-cyan hover:bg-neon-cyan hover:text-black font-bold text-sm shadow-[0_0_10px_rgba(0,255,255,0.2)]"
            >
                Find
            </button>
        </div>
      </div>
    </div>
  );
};