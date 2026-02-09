import React, { useEffect, useState, useRef } from 'react';
import { Message, User, SearchFilters, MessageType } from './types';
import { chatService } from './services/chatService';
import { STORAGE_KEY_USER, APP_NAME } from './constants';
import { MessageBubble } from './components/MessageBubble';
import { ChatInput } from './components/ChatInput';
import { ThemeToggle } from './components/ThemeToggle';
import { LoginModal } from './components/LoginModal';
import { SearchPanel } from './components/SearchPanel';
import { Search, Hash, Users, Activity } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({ query: '' });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Initialize App
  useEffect(() => {
    // 1. Check for existing user
    const storedUser = localStorage.getItem(STORAGE_KEY_USER);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    // 2. Load Messages & Run Archive Job
    const loadedMessages = chatService.getMessages();
    setMessages(loadedMessages);
    chatService.runArchiveJob();

    // 3. Subscribe to real-time updates
    const unsubscribe = chatService.subscribe((newMessage) => {
      setMessages(prev => [...prev, newMessage]);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Filter Logic
  useEffect(() => {
    let result = messages;
    const { query, username, type } = searchFilters;

    if (query) {
      const lowerQuery = query.toLowerCase();
      result = result.filter(m => m.content.toLowerCase().includes(lowerQuery));
    }
    if (username) {
      const lowerUser = username.toLowerCase();
      result = result.filter(m => m.username.toLowerCase().includes(lowerUser));
    }
    if (type) {
      result = result.filter(m => m.type === type);
    }

    setFilteredMessages(result);
  }, [messages, searchFilters]);

  // Scroll to bottom on new message if not searching
  useEffect(() => {
    if (!searchFilters.query && !searchFilters.username && !searchFilters.type) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, searchFilters]);

  const handleLogin = (username: string) => {
    const newUser: User = { id: crypto.randomUUID(), username };
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
    setUser(newUser);
  };

  const handleSendMessage = async (content: string, type: MessageType, file?: File) => {
    if (!user) return;
    
    // In a real app, upload file here and get URL.
    // Here we already have the DataURL in content.
    await chatService.saveMessage({
      userId: user.id,
      username: user.username,
      type,
      content,
      fileName: file?.name,
      replyTo: replyTo?.id
    });
    
    // Optimistic update happens via subscriber for broadcast, 
    // but for local sender, we force a refresh if broadcast is async
    setMessages(chatService.getMessages());
    setReplyTo(null);
  };

  const handleEditMessage = (id: string, newContent: string) => {
    const updated = chatService.editMessage(id, newContent);
    setMessages(updated);
  };

  const handleDeleteMessage = (id: string) => {
    const updated = chatService.deleteMessage(id);
    setMessages(updated);
  };

  const scrollToMessage = (id: string) => {
    const element = document.getElementById(`msg-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Highlight effect
      element.classList.add('bg-neon-purple/20', 'transition-colors', 'duration-1000');
      setTimeout(() => element.classList.remove('bg-neon-purple/20'), 1000);
    }
  };

  if (!user) {
    return <LoginModal onLogin={handleLogin} />;
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-neon-dark text-gray-900 dark:text-gray-100 transition-colors duration-300">
      
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 z-50 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded bg-gradient-to-br from-neon-cyan to-neon-purple flex items-center justify-center shadow-[0_0_10px_rgba(0,255,255,0.4)]">
             <Hash className="text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl tracking-wide dark:text-white">
              {APP_NAME} <span className="text-neon-cyan text-sm">{user.username}</span>
            </h1>
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <span className="flex items-center"><div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div> Online</span>
              <span className="hidden md:inline">| Global Channel</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className={`p-2 rounded-full transition-all ${isSearchOpen ? 'bg-neon-cyan/20 text-neon-cyan' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'}`}
          >
            <Search size={20} />
          </button>
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-700"></div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Chat Area */}
      <div className="flex-1 overflow-hidden relative flex">
        
        {/* Sidebar (Desktop only visual) */}
        <div className="hidden lg:flex w-64 bg-gray-50 dark:bg-[#0f1422] border-r border-gray-200 dark:border-gray-800 flex-col p-4">
           <div className="mb-6">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Stats</h2>
              <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                 <span className="flex items-center"><Users size={14} className="mr-2"/> Users</span>
                 <span>1 (You)</span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-400">
                 <span className="flex items-center"><Activity size={14} className="mr-2"/> Msgs</span>
                 <span>{messages.length}</span>
              </div>
           </div>
           
           <div className="mt-auto">
             <div className="p-4 rounded-xl bg-neon-purple/5 border border-neon-purple/20">
               <h3 className="text-neon-purple font-display text-sm font-bold mb-1">Archival Active</h3>
               <p className="text-xs text-gray-500">Messages older than 180 days are automatically compressed locally.</p>
             </div>
           </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 flex flex-col relative min-w-0">
          <SearchPanel 
            isOpen={isSearchOpen} 
            onClose={() => setIsSearchOpen(false)}
            onSearch={setSearchFilters}
          />

          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2 custom-scrollbar"
          >
             {filteredMessages.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50">
                 <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center mb-4">
                   <Hash size={40} />
                 </div>
                 <p>No messages yet. Start the conversation!</p>
               </div>
             ) : (
               filteredMessages.map((msg, index) => {
                 const isOwn = msg.userId === user.id;
                 const showAvatar = !isOwn && (index === 0 || filteredMessages[index - 1].userId !== msg.userId);
                 
                 return (
                   <MessageBubble 
                     key={msg.id}
                     message={msg}
                     isOwnMessage={isOwn}
                     onReply={setReplyTo}
                     onEdit={handleEditMessage}
                     onDelete={handleDeleteMessage}
                     scrollToMessage={scrollToMessage}
                   />
                 );
               })
             )}
             <div ref={messagesEndRef} />
          </div>

          <ChatInput 
            onSendMessage={handleSendMessage}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
          />
        </div>
      </div>
    </div>
  );
};

export default App;