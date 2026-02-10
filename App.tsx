import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Message, User, MessageType, Channel } from './types';
import { chatService, generateUUID } from './services/chatService';
import { STORAGE_KEY_USER, APP_NAME } from './constants';
import { MessageBubble } from './components/MessageBubble';
import { ChatInput } from './components/ChatInput';
import { ThemeToggle } from './components/ThemeToggle';
import { LoginModal } from './components/LoginModal';
import { SearchPanel } from './components/SearchPanel';
import { PinnedPanel } from './components/PinnedPanel';
import { SettingsModal } from './components/SettingsModal';
import { Search, Fish, Users, Activity, Wifi, WifiOff, Edit2, Check, X, Menu, Bell, BellOff, ArrowUp, Pin, Hash, Plus, ChevronRight, Smartphone, Settings } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Channels
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>('general');
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  
  // Channel Rename State
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editChannelName, setEditChannelName] = useState('');

  // Unread Mentions
  const [unreadMentions, setUnreadMentions] = useState<{ [channelId: string]: number }>({});

  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [knownUsers, setKnownUsers] = useState<Map<string, User>>(new Map()); // id -> User Object
  
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isPinnedOpen, setIsPinnedOpen] = useState(false);
  const [isUserListOpen, setIsUserListOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  
  // Pin Notification State
  const [lastViewedPinTime, setLastViewedPinTime] = useState<string>(
    localStorage.getItem('finchat_last_pin_view') || new Date(0).toISOString()
  );

  // Username Edit State (Top Bar)
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');

  // Notifications
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Pagination
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [headerImgError, setHeaderImgError] = useState(false);

  // Swipe Gestures
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

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
      setNotificationsEnabled(false);
    } else {
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

  // --- Initial Data Loading ---
  useEffect(() => {
    const storedUser = localStorage.getItem(STORAGE_KEY_USER);
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    // Load Channels
    const loadChannels = async () => {
      const chs = await chatService.getChannels();
      setChannels(chs);
      // Ensure active channel exists, fallback to general
      if (!chs.find(c => c.id === activeChannelId)) {
        setActiveChannelId('general');
      }
    };
    loadChannels();
  }, []);

  // Update header fallback on avatar change
  useEffect(() => {
     if (user?.avatar) setHeaderImgError(false);
  }, [user?.avatar]);

  const activeChannelRef = useRef(activeChannelId);
  useEffect(() => { activeChannelRef.current = activeChannelId; }, [activeChannelId]);
  
  // Subscriptions
  useEffect(() => {
    const unsubscribe = chatService.subscribe(
        (newMessage) => {
            if (newMessage.channelId === activeChannelRef.current) {
                setMessages(prev => [...prev, newMessage]);
            } else if (user && newMessage.content.includes(`@${user.username}`)) {
                 // Mention in another channel
                 setUnreadMentions(prev => ({
                     ...prev,
                     [newMessage.channelId]: (prev[newMessage.channelId] || 0) + 1
                 }));
            }

            // Handle notifications regardless of channel if mentioned
            if (user && newMessage.userId !== user.id && newMessage.content.includes(`@${user.username}`) && notificationsEnabled) {
                new Notification(`${newMessage.username} in #${channels.find(c=>c.id===newMessage.channelId)?.name || 'unknown'}`, {
                    body: newMessage.content
                });
            }
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
    return () => unsubscribe();
  }, [user, notificationsEnabled, channels]);


  // --- Channel Switching & History ---
  useEffect(() => {
    // Clear unread mentions for this channel
    if (unreadMentions[activeChannelId]) {
        setUnreadMentions(prev => {
            const next = { ...prev };
            delete next[activeChannelId];
            return next;
        });
    }

    const fetchHistory = async () => {
      setIsLoadingHistory(true);
      setMessages([]); // Clear previous channel messages immediately
      setHasMoreHistory(true);
      
      const limit = 200;
      const history = await chatService.getMessages(activeChannelId, limit);
      setMessages(history);
      
      if (history.length < limit) {
        setHasMoreHistory(false);
      }

      setIsLoadingHistory(false);
      initialLoadDone.current = true;
      
      // Scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 50);
    };

    if (activeChannelId) {
        fetchHistory();
    }
  }, [activeChannelId]);

  // Update Known Users (Persistent offline list & Avatars)
  useEffect(() => {
     setKnownUsers(prev => {
         const next = new Map(prev);
         let changed = false;
         
         // Add from messages
         messages.forEach(m => {
             const existing = next.get(m.userId);
             if (!existing) {
                 next.set(m.userId, { id: m.userId, username: m.username });
                 changed = true;
             }
         });
         
         // Add from online users
         onlineUsers.forEach(u => {
             const existing = next.get(u.id);
             // Update if new info (avatar/status)
             if (!existing || existing.avatar !== u.avatar || existing.username !== u.username || existing.statusMessage !== u.statusMessage) {
                 next.set(u.id, u);
                 changed = true;
             }
         });
         
         return changed ? next : prev;
     });
  }, [messages, onlineUsers]);


  // Auto-scroll
  useEffect(() => {
    if (initialLoadDone.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const loadOlderMessages = async () => {
    if (messages.length === 0 || isLoadingHistory) return;
    
    setIsLoadingHistory(true);
    const oldestTimestamp = messages[0].timestamp;
    const limit = 200;
    
    const olderMessages = await chatService.getMessages(activeChannelId, limit, oldestTimestamp);
    
    if (olderMessages.length > 0) {
      setMessages(prev => [...olderMessages, ...prev]);
      if (olderMessages.length < limit) {
        setHasMoreHistory(false);
      }
    } else {
      setHasMoreHistory(false);
    }
    setIsLoadingHistory(false);
  };

  const createNewChannel = async () => {
    if (!newChannelName.trim()) return;
    try {
        const ch = await chatService.createChannel(newChannelName.trim());
        setChannels(prev => [...prev, ch]);
        setNewChannelName('');
        setIsCreatingChannel(false);
        setActiveChannelId(ch.id);
    } catch (e) {
        alert("Failed to create channel. It might already exist.");
    }
  };

  const renameChannel = async () => {
      if (!editingChannelId || !editChannelName.trim()) return;
      try {
          const channel = channels.find(c => c.id === editingChannelId);
          if (channel) {
             const updated = await chatService.updateChannel({ ...channel, name: editChannelName.trim() });
             setChannels(prev => prev.map(c => c.id === updated.id ? updated : c));
          }
          setEditingChannelId(null);
          setEditChannelName('');
      } catch (e) {
          alert("Failed to rename channel");
      }
  };

  // Derive Offline Users
  const offlineUsers = useMemo(() => {
    const onlineIds = new Set(onlineUsers.map(u => u.id));
    const offline: User[] = [];
    knownUsers.forEach((u, id) => {
        if (!onlineIds.has(id)) {
            offline.push(u);
        }
    });
    return offline;
  }, [onlineUsers, knownUsers]);

  const allKnownUsers = useMemo(() => {
    const list = [...onlineUsers];
    const onlineIds = new Set(onlineUsers.map(u => u.id));
    
    knownUsers.forEach((u, id) => {
        if (!onlineIds.has(id)) {
            list.push(u);
        }
    });
    return list;
  }, [onlineUsers, knownUsers]);

  // Calculate NEW pins for notification
  const newPinsCount = useMemo(() => {
      return messages.filter(m => m.pinned && !m.deleted && m.pinnedAt && m.pinnedAt > lastViewedPinTime).length;
  }, [messages, lastViewedPinTime]);

  // Handle Opening Pin Panel
  const handleTogglePinPanel = () => {
      if (!isPinnedOpen) {
          // Opening: Mark all as seen
          const now = new Date().toISOString();
          setLastViewedPinTime(now);
          localStorage.setItem('finchat_last_pin_view', now);
          setIsSearchOpen(false);
      }
      setIsPinnedOpen(!isPinnedOpen);
  };

  const getReplySnippet = useCallback((id: string) => {
    const msg = messages.find(m => m.id === id);
    if (!msg) return "Message unavailable";
    return msg.type === 'text' ? msg.content : `[${msg.type}]`;
  }, [messages]);

  const handleLogin = (username: string, userId?: string) => {
    // If userId provided (new device login), use it. Else generate.
    const newUser: User = { 
        id: userId || generateUUID(), 
        username 
    };
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
    setUser(newUser);
    if (connectionStatus === 'connected') {
      chatService.sendJoin(newUser);
    }
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission().then(perm => {
        setNotificationsEnabled(perm === 'granted');
      });
    }
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
    chatService.updateUser(updatedUser);
  };

  const handleChangeUsername = () => {
    if (!user || !editNameValue.trim()) return;
    handleUpdateUser({ ...user, username: editNameValue.trim() });
    setIsEditingName(false);
  };

  const handleSendMessage = async (content: string, type: MessageType, file?: File) => {
    if (!user) return;
    try {
      await chatService.saveMessage({
        channelId: activeChannelId,
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

  const handleJumpToMessage = async (msgOrId: Message | string) => {
      let targetId: string;
      let channelIdOfMsg: string = activeChannelId;

      if (typeof msgOrId === 'string') {
          targetId = msgOrId;
          const localMsg = messages.find(m => m.id === targetId);
          if (localMsg) channelIdOfMsg = localMsg.channelId;
      } else {
          targetId = msgOrId.id;
          channelIdOfMsg = msgOrId.channelId;
      }

      setIsSearchOpen(false);
      setIsPinnedOpen(false);

      if (channelIdOfMsg !== activeChannelId) {
          // Switch Channel first
          setActiveChannelId(channelIdOfMsg);
          // Wait briefly for channel switch effect to fire and load messages
          await new Promise(r => setTimeout(r, 600)); 
      }

      const element = document.getElementById(`msg-${targetId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('bg-neon-purple/20', 'transition-colors', 'duration-1000');
        setTimeout(() => element.classList.remove('bg-neon-purple/20'), 1000);
      }
  };

  // --- Gestures ---
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    handleSwipe();
  };

  const handleSwipe = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) { // Threshold 50px
      if (diff < 0) {
        // Swipe Right -> Open Menu
        setIsUserListOpen(true);
      } else {
        // Swipe Left -> Close Menu
        setIsUserListOpen(false);
      }
    }
  };

  // --- Drag and Drop Channels ---
  const handleDragStart = (e: React.DragEvent, index: number) => {
      e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
      const dragIndex = parseInt(e.dataTransfer.getData("text/plain"));
      if (dragIndex === dropIndex) return;

      const newChannels = [...channels];
      const [draggedItem] = newChannels.splice(dragIndex, 1);
      newChannels.splice(dropIndex, 0, draggedItem);
      
      // Optimistic update
      setChannels(newChannels);
      
      // Sync Order to Server
      for (let i = 0; i < newChannels.length; i++) {
          const c = newChannels[i];
          if (c.order !== i) {
              await chatService.updateChannel({ ...c, order: i });
          }
      }
  };

  if (!user) {
    return <LoginModal onLogin={handleLogin} />;
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-white dark:bg-neon-dark text-gray-900 dark:text-gray-100 transition-colors duration-300 overflow-hidden">
      
      {isSettingsOpen && (
          <SettingsModal 
            user={user} 
            onClose={() => setIsSettingsOpen(false)} 
            onUpdateUser={handleUpdateUser} 
          />
      )}

      {/* Header */}
      <header className="flex-none flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 z-50 shadow-md">
        <div className="flex items-center space-x-3">
          <div 
            onClick={() => setIsSettingsOpen(true)}
            className="w-10 h-10 rounded-full cursor-pointer overflow-hidden bg-gradient-to-br from-neon-cyan to-neon-purple flex items-center justify-center shadow-[0_0_10px_rgba(0,255,255,0.4)] hover:scale-105 transition-transform"
          >
             {user.avatar && !headerImgError ? (
                 <img 
                    src={user.avatar} 
                    alt="Profile" 
                    className="w-full h-full object-cover" 
                    onError={() => setHeaderImgError(true)}
                 />
             ) : (
                 <Fish className="text-white" />
             )}
          </div>
          <div className="flex flex-col">
            <h1 className="font-display font-bold text-lg md:text-xl tracking-wide dark:text-white leading-tight">
              {APP_NAME} <span className="text-gray-400 text-sm">#{channels.find(c=>c.id===activeChannelId)?.name}</span>
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
                   <span className="text-cyan-600 dark:text-neon-cyan font-bold truncate max-w-[100px] sm:max-w-none">{user.username}</span>
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
             className={`p-2 rounded-full transition-all ${notificationsEnabled ? 'text-cyan-600 dark:text-neon-cyan hover:bg-neon-cyan/10' : 'text-gray-500 hover:text-gray-300'}`}
             title={notificationsEnabled ? "Notifications On" : "Enable Notifications"}
          >
             {notificationsEnabled ? <Bell size={20}/> : <BellOff size={20}/>}
          </button>
          
          <button 
            onClick={handleTogglePinPanel}
            className={`p-2 rounded-full transition-all relative ${isPinnedOpen ? 'bg-yellow-500/20 text-yellow-500' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'}`}
            title="Pinned Messages"
          >
            <Pin size={20} className={isPinnedOpen ? "fill-current" : ""} />
            {newPinsCount > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[9px] flex items-center justify-center rounded-full font-bold shadow-sm">
                    {newPinsCount > 9 ? '9+' : newPinsCount}
                </span>
            )}
          </button>

          <button 
            onClick={() => { setIsSearchOpen(!isSearchOpen); setIsPinnedOpen(false); }}
            className={`p-2 rounded-full transition-all ${isSearchOpen ? 'bg-cyan-100 dark:bg-neon-cyan/20 text-cyan-700 dark:text-neon-cyan' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'}`}
            title="Search"
          >
            <Search size={20} />
          </button>
          
          <button 
             onClick={() => setIsUserListOpen(!isUserListOpen)}
             className={`lg:hidden p-2 rounded-full transition-all ${isUserListOpen ? 'bg-purple-100 dark:bg-neon-purple/20 text-purple-700 dark:text-neon-purple' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'}`}
          >
             <Menu size={20} />
          </button>

          <div className="h-6 w-px bg-gray-300 dark:bg-gray-700"></div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Layout */}
      <div 
        className="flex-1 overflow-hidden relative flex"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        
        {/* Sidebar */}
        <div className={`
            absolute lg:relative z-30 inset-y-0 left-0 w-64 
            bg-gray-50 dark:bg-[#0f1422] border-r border-gray-200 dark:border-gray-800 
            flex flex-col overflow-hidden transform transition-transform duration-300
            ${isUserListOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            shadow-2xl lg:shadow-none
        `}>
           <div className="lg:hidden flex justify-end p-4 pb-0">
              <button onClick={() => setIsUserListOpen(false)} className="text-gray-500 hover:text-white">
                <X size={20} />
              </button>
           </div>
           
           <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
               {/* CHANNELS SECTION */}
               <div className="mb-8">
                  <div className="flex justify-between items-center mb-3">
                      <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Channels</h2>
                      <button onClick={() => setIsCreatingChannel(true)} className="text-gray-400 hover:text-neon-cyan">
                          <Plus size={16} />
                      </button>
                  </div>

                  {isCreatingChannel && (
                      <div className="mb-3 animate-slide-up bg-white dark:bg-gray-900 p-2 rounded border border-neon-cyan/50">
                          <input 
                              autoFocus
                              className="w-full bg-transparent text-sm mb-2 outline-none border-b border-gray-700 focus:border-neon-cyan"
                              placeholder="Channel name..."
                              value={newChannelName}
                              onChange={(e) => setNewChannelName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                              onKeyDown={(e) => e.key === 'Enter' && createNewChannel()}
                          />
                          <div className="flex justify-end gap-2 text-xs">
                              <button onClick={() => setIsCreatingChannel(false)} className="text-red-400">Cancel</button>
                              <button onClick={createNewChannel} className="text-green-400">Create</button>
                          </div>
                      </div>
                  )}

                  <ul className="space-y-1">
                      {channels.map((c, index) => (
                          <li 
                            key={c.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, index)}
                            className="group/channel relative"
                          >
                              {editingChannelId === c.id ? (
                                  <div className="flex items-center px-2 py-1 bg-white dark:bg-gray-800 rounded">
                                      <input 
                                          autoFocus
                                          value={editChannelName}
                                          onChange={(e) => setEditChannelName(e.target.value)}
                                          className="w-full bg-transparent text-sm border-b border-gray-500 focus:border-neon-cyan outline-none"
                                          onKeyDown={(e) => e.key === 'Enter' && renameChannel()}
                                          onBlur={renameChannel}
                                      />
                                  </div>
                              ) : (
                                  <button
                                      onClick={() => { setActiveChannelId(c.id); setIsUserListOpen(false); }}
                                      className={`w-full flex items-center px-3 py-2 rounded-lg text-sm transition-all relative ${
                                          activeChannelId === c.id 
                                          ? 'bg-cyan-100 dark:bg-neon-cyan/10 text-cyan-700 dark:text-neon-cyan font-bold shadow-[0_0_10px_rgba(0,255,255,0.1)]' 
                                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                                      }`}
                                  >
                                      <Hash size={14} className="mr-2 opacity-70" />
                                      <span className="truncate">{c.name}</span>
                                      
                                      {/* Unread Mention Badge */}
                                      {unreadMentions[c.id] > 0 && activeChannelId !== c.id && (
                                          <span className="absolute right-8 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white font-bold animate-pulse">
                                              {unreadMentions[c.id]}
                                          </span>
                                      )}

                                      {activeChannelId === c.id ? (
                                          // Allow settings access even on active channel
                                          <div 
                                              onClick={(e) => { e.stopPropagation(); setEditingChannelId(c.id); setEditChannelName(c.name); }}
                                              className="ml-auto opacity-0 group-hover/channel:opacity-100 p-1 hover:text-neon-purple transition-opacity"
                                          >
                                              <Settings size={12} />
                                          </div>
                                      ) : (
                                        <div 
                                            onClick={(e) => { e.stopPropagation(); setEditingChannelId(c.id); setEditChannelName(c.name); }}
                                            className="ml-auto opacity-0 group-hover/channel:opacity-100 p-1 hover:text-neon-purple transition-opacity"
                                        >
                                            <Settings size={12} />
                                        </div>
                                      )}
                                  </button>
                              )}
                          </li>
                      ))}
                  </ul>
               </div>
               
               {/* USERS SECTION */}
               <div className="mb-6">
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex justify-between">
                    <span className="text-green-600 dark:text-green-500">Online</span>
                    <span className="bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-500 px-1.5 rounded-full text-[10px]">{onlineUsers.length}</span>
                  </h2>
                  <ul className="space-y-3">
                    {onlineUsers.map((u, idx) => (
                      <li key={`${u.id}-${idx}`} className="flex items-start space-x-2 text-sm text-gray-600 dark:text-gray-300">
                        {/* Avatar with Status Overlay */}
                        <div className="relative flex-shrink-0">
                            {u.avatar ? (
                                <img src={u.avatar} alt={u.username} className="w-8 h-8 rounded-full object-cover border border-gray-300 dark:border-gray-700" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center text-[10px] font-bold text-white uppercase border border-gray-300 dark:border-gray-700">
                                    {u.username.substring(0,2)}
                                </div>
                            )}
                            {/* Status Overlay: Mobile Icon or Green Dot */}
                            {u.isMobile ? (
                                <div className="absolute -bottom-1 -right-1 bg-black/50 rounded-full p-0.5 border border-black">
                                    <Smartphone size={10} className="text-green-500 fill-current" />
                                </div>
                            ) : (
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-[#0f1422] flex items-center justify-center bg-green-500"></div>
                            )}
                        </div>

                        <div className="flex flex-col min-w-0 justify-center h-full pt-0.5">
                            <span className={`truncate leading-none ${u.id === user.id ? "text-gray-900 dark:text-white font-bold" : ""}`}>
                                {u.username} {u.id === user.id && <span className="text-[10px] font-normal text-gray-400 ml-1">(You)</span>}
                            </span>
                            {u.statusMessage && (
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{u.statusMessage}</span>
                            )}
                        </div>
                      </li>
                    ))}
                  </ul>
               </div>

               <div className="mb-6">
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex justify-between">
                    <span className="text-gray-500">Offline</span>
                    <span className="bg-gray-200 dark:bg-gray-800 text-gray-500 px-1.5 rounded-full text-[10px]">{offlineUsers.length}</span>
                  </h2>
                  <ul className="space-y-3 opacity-60">
                    {offlineUsers.map((u, idx) => (
                      <li key={`off-${u.id}-${idx}`} className="flex items-start space-x-2 text-sm text-gray-500 dark:text-gray-400">
                         {/* Avatar (No Status Overlay) */}
                         <div className="relative flex-shrink-0">
                            {u.avatar ? (
                                <img src={u.avatar} alt={u.username} className="w-8 h-8 rounded-full object-cover grayscale" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-400 dark:bg-gray-600 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                                    {u.username.substring(0,2)}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col min-w-0 justify-center h-full pt-0.5">
                            <span className="truncate leading-none">{u.username}</span>
                            {u.statusMessage && (
                                <span className="text-[10px] text-gray-400 truncate">{u.statusMessage}</span>
                            )}
                        </div>
                      </li>
                    ))}
                  </ul>
               </div>
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
            activeChannelId={activeChannelId}
            channels={channels}
            onJumpToMessage={handleJumpToMessage}
          />

          <PinnedPanel 
            isOpen={isPinnedOpen}
            onClose={() => setIsPinnedOpen(false)}
            messages={messages}
            onJumpToMessage={handleJumpToMessage}
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
                    className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 rounded-full text-xs text-cyan-700 dark:text-neon-cyan hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 shadow-sm"
                 >
                   {isLoadingHistory ? 'Loading...' : 'Show Older Messages'} <ArrowUp size={12} className="ml-1"/>
                 </button>
               </div>
             )}

             {messages.length === 0 && !isLoadingHistory ? (
               <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50">
                 <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-400 dark:border-gray-600 flex items-center justify-center mb-4">
                   <Hash size={40} />
                 </div>
                 <p>This channel is empty.</p>
                 <p className="text-xs mt-1">Be the first to say something!</p>
               </div>
             ) : (
               messages.map((msg, index) => {
                 const isOwn = msg.userId === user.id;
                 const authorUser = knownUsers.get(msg.userId);
                 return (
                   <MessageBubble 
                     key={msg.id}
                     message={msg}
                     isOwnMessage={isOwn}
                     onReply={setReplyTo}
                     onEdit={handleEditMessage}
                     onDelete={handleDeleteMessage}
                     scrollToMessage={(id) => handleJumpToMessage(id)}
                     currentUser={user}
                     getReplySnippet={getReplySnippet}
                     authorUser={authorUser}
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
              allUsers={allKnownUsers}
              onlineUsers={onlineUsers}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;