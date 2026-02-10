import React, { useState, useRef } from 'react';
import { X, Upload, User as UserIcon, Check, Copy, Eye, EyeOff } from 'lucide-react';
import { User } from '../types';
import { Button } from './Button';
import { chatService } from '../services/chatService';

interface SettingsModalProps {
  user: User;
  onClose: () => void;
  onUpdateUser: (updatedUser: User) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ user, onClose, onUpdateUser }) => {
  const [username, setUsername] = useState(user.username);
  const [statusMessage, setStatusMessage] = useState(user.statusMessage || '');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [isUploading, setIsUploading] = useState(false);
  const [showUserId, setShowUserId] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsUploading(true);
      try {
        const file = e.target.files[0];
        // Reuse uploadFile service
        const url = await chatService.uploadFile(file);
        setAvatar(url);
      } catch (err) {
        alert("Failed to upload image");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSave = () => {
    if (!username.trim()) return;
    onUpdateUser({ 
        ...user, 
        username: username.trim(), 
        avatar,
        statusMessage: statusMessage.trim()
    });
    onClose();
  };

  const copyUserId = () => {
      navigator.clipboard.writeText(user.id);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl animate-slide-up overflow-hidden">
        
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
          <h2 className="text-xl font-display font-bold text-gray-900 dark:text-white">Profile Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 dark:hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Avatar Section */}
          <div className="flex flex-col items-center space-y-3">
             <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-neon-cyan shadow-[0_0_15px_rgba(0,255,255,0.3)] bg-gray-800 flex items-center justify-center">
                    {avatar ? (
                        <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                        <UserIcon size={40} className="text-gray-500" />
                    )}
                </div>
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Upload size={24} className="text-white" />
                </div>
                {isUploading && (
                    <div className="absolute inset-0 bg-black/70 rounded-full flex items-center justify-center">
                       <div className="w-6 h-6 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
             </div>
             <p className="text-xs text-gray-500">Tap to change avatar</p>
             <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
          </div>

          <div className="space-y-4">
            {/* Username Section */}
            <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Display Name</label>
                <input 
                   type="text" 
                   value={username} 
                   onChange={(e) => setUsername(e.target.value)}
                   maxLength={20}
                   className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-gray-900 dark:text-white focus:ring-1 focus:ring-neon-cyan outline-none"
                />
            </div>

            {/* Status Section */}
            <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Status Message</label>
                <input 
                   type="text" 
                   value={statusMessage} 
                   onChange={(e) => setStatusMessage(e.target.value)}
                   maxLength={50}
                   placeholder="What's on your mind?"
                   className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-gray-900 dark:text-white focus:ring-1 focus:ring-neon-cyan outline-none text-sm"
                />
            </div>

            {/* User ID Section */}
            <div className="bg-gray-100 dark:bg-black/30 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">User ID (Keep Secret)</label>
                <div className="flex items-center space-x-2">
                    <div className="flex-1 font-mono text-sm bg-gray-200 dark:bg-black/50 p-2 rounded text-gray-700 dark:text-gray-300 truncate">
                        {showUserId ? user.id : '••••••••-••••-••••-••••-••••••••••••'}
                    </div>
                    <button 
                        onClick={() => setShowUserId(!showUserId)}
                        className="p-2 text-gray-500 hover:text-neon-cyan"
                        title={showUserId ? "Hide ID" : "Show ID"}
                    >
                        {showUserId ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    {showUserId && (
                        <button 
                            onClick={copyUserId}
                            className="p-2 text-gray-500 hover:text-green-400"
                            title="Copy ID"
                        >
                            {isCopied ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                    )}
                </div>
                <p className="text-[10px] text-gray-500 mt-1">Use this ID to log in on other devices.</p>
            </div>
          </div>

          <Button onClick={handleSave} className="w-full flex items-center justify-center">
             <Check size={18} className="mr-2" /> Save Changes
          </Button>

        </div>
      </div>
    </div>
  );
};