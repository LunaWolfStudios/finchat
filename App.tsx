import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Message, User, MessageType } from './types';
import { chatService, generateUUID } from './services/chatService';
import { STORAGE_KEY_USER, APP_NAME } from './constants';
import { MessageBubble } from './components/MessageBubble';
import { ChatInput } from './components/ChatInput';
import { ThemeToggle } from './components/ThemeToggle';
import { LoginModal } from './components/LoginModal';
import { SearchPanel } from './components/SearchPanel';
import { Search, Fish, Users, Activity, Wifi, WifiOff, Edit2, Check, X, Menu } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUserListOpen, setIsUserListOpen] = useState(false); // Mobile user list toggle

  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  
  // Username Edit State
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Initialize App
  useEffect(() => {
    // 1. Check for existing user
    const storedUser = localStorage.getItem(STORAGE_KEY_USER);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    // 2. Load Initial History
    const fetchHistory = async () => {
      const history = await chatService.getMessages();
      setMessages(history);
    };
    fetchHistory();

    // 3. Subscribe to real-time updates and status
    const unsubscribe = chatService.subscribe(
      (newMessage) => {
        setMessages(prev => [...prev, newMessage]);
      },
      (status) => {
        setConnectionStatus(status);
        if (status === 'connected' && user) {
           chatService.sendJoin(user);
        }
      },
      (updatedMessage) => {
        setMessages(prev => prev.map(m => m.id === updatedMessage.id ? updatedMessage : m));
      },
      (usersList) => {
        setOnlineUsers(usersList);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.id]); // Re-subscribe if user ID changes (unlikely) but safer

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Derive Offline Users
  const offlineUsers = useMemo(() => {
    const onlineIds = new Set(onlineUsers.map(u => u.id));
    const knownUsers = new Map<string, string>(); // Id -> Username

    messages.forEach(msg => {
      // If we haven't seen this user ID yet, add them
      if (!knownUsers.has(msg.userId)) {
        knownUsers.set(msg.userId, msg.username);
      }
      // If we have seen them, but the message is newer/different username, update it (optional, but good for keeping names fresh)
      // For V1, simple set is fine.
    });

    const offline: User[] = [];
    knownUsers.forEach((name, id) => {
      if (!onlineIds.has(id)) {
        offline.push({ id, username: name });
      }
    });

    return offline;
  }, [messages, onlineUsers]);


  const handleLogin = (username: string) => {
    const newUser: User = { id: generateUUID(), username };
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
    setUser(newUser);
    // Connection might be open already, send join
    if (connectionStatus === 'connected') {
      chatService.sendJoin(newUser);
    }
  };

  const handleChangeUsername = () => {
    if (!user || !editNameValue.trim()) return;
    const updatedUser = { ...user, username: editNameValue.trim() };
    setUser(updatedUser);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
    chatService.updateUser(updatedUser);
    setIsEditingName(false);
  };

  const handleSendMessage = async (content: string, type: MessageType, file?: File) => {
    if (!user) return;
    
    try {
      await chatService.saveMessage({
        userId: user.id,
        username: user.username,
        type,
        content,
        fileName: file?.name,
        replyTo: replyTo?.id,
        file: file 
      });
      setReplyTo(null);
    } catch (e) {
      alert("Failed to send message. Check server connection.");
    }
  };

  const handleEditMessage = (id: string, newContent: string) => {
    const msg = messages.find(m => m.id === id);
    if (msg) chatService.editMessage(msg, newContent);
  };

  const handleDeleteMessage = (id: string) => {
    const msg = messages.find(m => m.id === id);
    if (msg) chatService.deleteMessage(msg);
  };

  const scrollToMessage = (id: string) => {
    // Close search panel when jumping
    setIsSearchOpen(false);
    
    const element = document.getElementById(`msg-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Highlight effect
      element.classList.add('bg-neon-purple/20', 'transition-colors', 'duration-1000');
      setTimeout(() => element.classList.remove('bg-neon-purple/20'), 1000);
    } else {
      console.warn("Message element not found in DOM");
    }
  };

  if (!user) {
    return <LoginModal onLogin={handleLogin} />;
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-white dark:bg-neon-dark text-gray-900 dark:text-gray-100 transition-colors duration-300 overflow-hidden">
      
      {/* Header */}
      <header className="flex-none flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 z-50 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded bg-gradient-to-br from-neon-cyan to-neon-purple flex items-center justify-center shadow-[0_0_10px_rgba(0,255,255,0.4)]">
             <Fish className="text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="font-display font-bold text-lg md:text-xl tracking-wide dark:text-white leading-tight">
              {APP_NAME}
            </h1>
            
            {/* Username Display / Edit */}
            <div className="flex items-center space-x-2 text-sm">
               {isEditingName ? (
                 <div className="flex items-center bg-gray-100 dark:bg-black/50 rounded px-1">
                   <input 
                     type="text" 
                     value={editNameValue}
                     onChange={(e) => setEditNameValue(e.target.value)}
                     className="bg-transparent border-none text-neon-cyan w-24 text-xs focus:ring-0 px-0 py-0.5 h-auto"
                     autoFocus
                   />
                   <button onClick={handleChangeUsername} className="text-green-500 hover:text-green-400 mx-1"><Check size={12}/></button>
                   <button onClick={() => setIsEditingName(false)} className="text-red-500 hover:text-red-400"><X size={12}/></button>
                 </div>
               ) : (
                 <div className="flex items-center group cursor-pointer" onClick={() => { setEditNameValue(user.username); setIsEditingName(true); }}>
                   <span className="text-neon-cyan font-bold truncate max-w-[100px] sm:max-w-none">{user.username}</span>
                   <Edit2 size={10} className="ml-1 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                 </div>
               )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="hidden md:flex flex-col items-end text-[10px] text-gray-500 mr-2">
              {connectionStatus === 'connected' ? (
                <span className="flex items-center text-green-500 font-bold">
                  <Wifi size={10} className="mr-1" /> Online
                </span>
              ) : (
                <span className="flex items-center text-red-500 font-bold animate-pulse">
                  <WifiOff size={10} className="mr-1" /> Offline
                </span>
              )}
          </div>
          
          <button 
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className={`p-2 rounded-full transition-all ${isSearchOpen ? 'bg-neon-cyan/20 text-neon-cyan' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'}`}
          >
            <Search size={20} />
          </button>
          
          {/* Mobile User List Toggle */}
          <button 
             onClick={() => setIsUserListOpen(!isUserListOpen)}
             className={`lg:hidden p-2 rounded-full transition-all ${isUserListOpen ? 'bg-neon-purple/20 text-neon-purple' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'}`}
          >
             <Users size={20} />
          </button>

          <div className="h-6 w-px bg-gray-300 dark:bg-gray-700"></div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 overflow-hidden relative flex">
        
        {/* Sidebar (Responsive) */}
        <div className={`
            absolute lg:relative z-30 inset-y-0 left-0 w-64 
            bg-gray-50 dark:bg-[#0f1422] border-r border-gray-200 dark:border-gray-800 
            flex flex-col p-4 overflow-y-auto custom-scrollbar transform transition-transform duration-300
            ${isUserListOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            shadow-2xl lg:shadow-none
        `}>
           {/* Close Button Mobile */}
           <div className="lg:hidden flex justify-end mb-4">
              <button onClick={() => setIsUserListOpen(false)} className="text-gray-500 hover:text-white">
                <X size={20} />
              </button>
           </div>

           {/* Stats */}
           <div className="mb-6">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Stats</h2>
              <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                 <span className="flex items-center"><Activity size={14} className="mr-2"/> Messages</span>
                 <span className="font-mono">{messages.length}</span>
              </div>
           </div>
           
           {/* Online Users */}
           <div className="mb-6">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex justify-between">
                <span className="text-green-500">Online</span>
                <span className="bg-green-500/10 text-green-500 px-1.5 rounded-full text-[10px]">{onlineUsers.length}</span>
              </h2>
              <ul className="space-y-2">
                {onlineUsers.map((u, idx) => (
                  <li key={`${u.id}-${idx}`} className="flex items-center space-x-2 text-sm text-gray-300">
                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]"></div>
                    <span className={u.id === user.id ? "text-white font-bold" : ""}>{u.username}</span>
                    {u.id === user.id && <span className="text-[10px] text-gray-500">(You)</span>}
                  </li>
                ))}
                {onlineUsers.length === 0 && (
                  <li className="text-xs text-gray-500 italic">Connecting...</li>
                )}
              </ul>
           </div>

           {/* Offline Users */}
           <div className="flex-1">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex justify-between">
                <span className="text-gray-500">Offline</span>
                <span className="bg-gray-800 text-gray-500 px-1.5 rounded-full text-[10px]">{offlineUsers.length}</span>
              </h2>
              <ul className="space-y-2 opacity-60">
                {offlineUsers.map((u, idx) => (
                  <li key={`off-${u.id}-${idx}`} className="flex items-center space-x-2 text-sm text-gray-400">
                    <div className="w-2 h-2 rounded-full bg-gray-600"></div>
                    <span>{u.username}</span>
                  </li>
                ))}
                {offlineUsers.length === 0 && (
                  <li className="text-xs text-gray-600 italic">No offline history</li>
                )}
              </ul>
           </div>
        </div>

        {/* Overlay for Mobile Sidebar */}
        {isUserListOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setIsUserListOpen(false)}
          />
        )}

        {/* Message Feed Container */}
        <div className="flex-1 flex flex-col relative min-w-0">
          
          <SearchPanel 
            isOpen={isSearchOpen} 
            onClose={() => setIsSearchOpen(false)}
            messages={messages}
            onJumpToMessage={scrollToMessage}
          />

          {/* Chat Messages */}
          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2 custom-scrollbar bg-gray-100 dark:bg-transparent"
          >
             {connectionStatus === 'connecting' && messages.length === 0 ? (
                <div className="flex justify-center items-center h-full text-neon-cyan animate-pulse">
                  Connecting to server...
                </div>
             ) : messages.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50">
                 <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center mb-4">
                   <Fish size={40} />
                 </div>
                 <p>No messages yet. Start the conversation!</p>
               </div>
             ) : (
               messages.map((msg, index) => {
                 const isOwn = msg.userId === user.id;
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

          {/* Input Area - pb-safe handles iPhone Home bar */}
          <div className="flex-none pb-safe bg-white dark:bg-gray-900">
            <ChatInput 
              onSendMessage={handleSendMessage}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;