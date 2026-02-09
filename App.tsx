import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Message, User, MessageType } from './types';
import { chatService, generateUUID } from './services/chatService';
import { STORAGE_KEY_USER, APP_NAME } from './constants';
import { MessageBubble } from './components/MessageBubble';
import { ChatInput } from './components/ChatInput';
import { ThemeToggle } from './components/ThemeToggle';
import { LoginModal } from './components/LoginModal';
import { SearchPanel } from './components/SearchPanel';
import { Search, Fish, Users, Activity, Wifi, WifiOff, Edit2, Check, X, Menu, Bell, BellOff, ArrowUp } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUserListOpen, setIsUserListOpen] = useState(false);

  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  
  // Username Edit State
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');

  // Notifications
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Pagination
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);

  // Initialize Notification Permission State
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        setNotificationsEnabled(true);
      } else {
        setNotificationsEnabled(false);
      }
    }
  }, []);

  const toggleNotifications = async () => {
    if (!('Notification' in window)) {
      alert("This browser does not support desktop notifications");
      return;
    }

    if (notificationsEnabled) {
      // Logic to disable: we just update state to stop sending them, 
      // but we cannot revoke 'granted' permission via API.
      setNotificationsEnabled(false);
    } else {
      // Logic to enable
      if (Notification.permission === 'granted') {
        setNotificationsEnabled(true);
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setNotificationsEnabled(true);
          new Notification('Notifications Enabled', { body: 'You will now be notified when mentioned.' });
        } else {
           setNotificationsEnabled(false);
        }
      } else {
        alert("Notifications are denied in browser settings. Please enable them manually.");
      }
    }
  };

  // Initialize App
  useEffect(() => {
    // 1. Check for existing user
    const storedUser = localStorage.getItem(STORAGE_KEY_USER);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    // 2. Load Initial History (200 latest)
    const fetchHistory = async () => {
      setIsLoadingHistory(true);
      const history = await chatService.getMessages(200);
      setMessages(history);
      setIsLoadingHistory(false);
      initialLoadDone.current = true;
      
      // Initial Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 100);
    };
    fetchHistory();

    // 3. Subscribe to real-time updates and status
    const unsubscribe = chatService.subscribe(
      (newMessage) => {
        setMessages(prev => [...prev, newMessage]);
        // Trigger notification if mentioned
        // We use the Ref value of notificationEnabled implicitly via state closure in useEffect dependencies
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
  }, [user?.id]); // Re-subscribe if user ID changes. NOTE: Removed notificationsEnabled from dep array to avoid resubscribing on toggle.

  // Separate effect for notification handling to access fresh state
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || !initialLoadDone.current || !user || !notificationsEnabled) return;
    
    // Check if new message is from someone else and mentions user
    if (lastMsg.userId !== user.id && lastMsg.content.includes(`@${user.username}`)) {
       // Debounce check or simple timestamp check could go here if needed
       if ((new Date().getTime() - new Date(lastMsg.timestamp).getTime()) < 5000) { // Only notify if fresh
         try {
           new Notification(`${lastMsg.username} mentioned you`, {
             body: lastMsg.content,
             icon: '/favicon.ico'
           });
         } catch (e) { console.error("Notification failed", e); }
       }
    }
  }, [messages, user, notificationsEnabled]);

  // Auto-scroll logic: only if user is already near bottom
  useEffect(() => {
    if (initialLoadDone.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const loadOlderMessages = async () => {
    if (messages.length === 0 || isLoadingHistory) return;
    
    setIsLoadingHistory(true);
    const oldestTimestamp = messages[0].timestamp;
    
    const olderMessages = await chatService.getMessages(200, oldestTimestamp);
    
    if (olderMessages.length > 0) {
      setMessages(prev => [...olderMessages, ...prev]);
    } else {
      setHasMoreHistory(false);
    }
    setIsLoadingHistory(false);
  };

  // Derive Offline Users
  const offlineUsers = useMemo(() => {
    const onlineIds = new Set(onlineUsers.map(u => u.id));
    const knownUsers = new Map<string, string>(); // Id -> Username

    messages.forEach(msg => {
      if (!knownUsers.has(msg.userId)) {
        knownUsers.set(msg.userId, msg.username);
      }
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
    setIsSearchOpen(false);
    const element = document.getElementById(`msg-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
             onClick={toggleNotifications}
             className={`p-2 rounded-full transition-all ${notificationsEnabled ? 'text-neon-cyan hover:bg-neon-cyan/10' : 'text-gray-500 hover:text-gray-300'}`}
             title={notificationsEnabled ? "Notifications On" : "Enable Notifications"}
          >
             {notificationsEnabled ? <Bell size={20}/> : <BellOff size={20}/>}
          </button>

          <button 
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className={`p-2 rounded-full transition-all ${isSearchOpen ? 'bg-neon-cyan/20 text-neon-cyan' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'}`}
          >
            <Search size={20} />
          </button>
          
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
        
        {/* Sidebar */}
        <div className={`
            absolute lg:relative z-30 inset-y-0 left-0 w-64 
            bg-gray-50 dark:bg-[#0f1422] border-r border-gray-200 dark:border-gray-800 
            flex flex-col p-4 overflow-y-auto custom-scrollbar transform transition-transform duration-300
            ${isUserListOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            shadow-2xl lg:shadow-none
        `}>
           <div className="lg:hidden flex justify-end mb-4">
              <button onClick={() => setIsUserListOpen(false)} className="text-gray-500 hover:text-white">
                <X size={20} />
              </button>
           </div>
           
           <div className="mb-6">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Stats</h2>
              <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                 <span className="flex items-center"><Activity size={14} className="mr-2"/> Messages</span>
                 <span className="font-mono">{messages.length}</span>
              </div>
           </div>
           
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
              </ul>
           </div>

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
              </ul>
           </div>
        </div>

        {isUserListOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setIsUserListOpen(false)}
          />
        )}

        <div className="flex-1 flex flex-col relative min-w-0">
          
          <SearchPanel 
            isOpen={isSearchOpen} 
            onClose={() => setIsSearchOpen(false)}
            messages={messages}
            onJumpToMessage={scrollToMessage}
          />

          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2 custom-scrollbar bg-gray-100 dark:bg-transparent"
          >
             {/* Load Older Button */}
             {hasMoreHistory && (
               <div className="flex justify-center mb-4">
                 <button 
                    onClick={loadOlderMessages} 
                    disabled={isLoadingHistory}
                    className="flex items-center px-4 py-2 bg-gray-800 rounded-full text-xs text-neon-cyan hover:bg-gray-700 transition-colors disabled:opacity-50"
                 >
                   {isLoadingHistory ? 'Loading...' : 'Show Older Messages'} <ArrowUp size={12} className="ml-1"/>
                 </button>
               </div>
             )}

             {messages.length === 0 && !isLoadingHistory ? (
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
                     currentUser={user}
                   />
                 );
               })
             )}
             <div ref={messagesEndRef} />
          </div>

          <div className="flex-none pb-safe bg-white dark:bg-gray-900">
            <ChatInput 
              onSendMessage={handleSendMessage}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              onlineUsers={onlineUsers}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;