import React, { useState } from 'react';
import { Button } from './Button';
import { generateUUID } from '../services/chatService';

interface LoginModalProps {
  onLogin: (username: string, userId?: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLogin }) => {
  const [inputValue, setInputValue] = useState('');
  const [isIdMode, setIsIdMode] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim().length > 1) {
      if (isIdMode) {
        // In a real app, we'd fetch the user profile here.
        // For V1, we trust the ID and ask for a name update later if needed, 
        // or just use a default name if it's a raw ID login without local storage history.
        // We'll pass the ID up.
        onLogin('User', inputValue.trim());
      } else {
        onLogin(inputValue.trim(), generateUUID());
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md p-8 bg-gray-900 border border-neon-cyan/30 rounded-2xl shadow-[0_0_30px_rgba(0,255,255,0.1)] animate-slide-up">
        <h2 className="text-3xl font-display font-bold text-center mb-2 text-white">
          <span className="text-neon-cyan">Fin</span>Chat <span className="text-neon-purple">V1</span>
        </h2>
        <p className="text-center text-gray-400 mb-8">Punch your way into the neon grid.</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold uppercase text-neon-cyan">
                    {isIdMode ? 'Enter User ID' : 'Identify Yourself'}
                </label>
                <button 
                    type="button"
                    onClick={() => { setIsIdMode(!isIdMode); setInputValue(''); }}
                    className="text-[10px] text-gray-500 hover:text-white underline"
                >
                    {isIdMode ? 'Login with Name' : 'Login with ID'}
                </button>
            </div>
            <input 
              type="text" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={isIdMode ? "Paste User ID..." : "Enter Display Name"}
              className="w-full bg-black/50 border border-gray-700 focus:border-neon-cyan rounded-lg p-3 text-white outline-none transition-colors"
              autoFocus
              maxLength={isIdMode ? 100 : 20}
            />
          </div>
          
          <Button type="submit" className="w-full" disabled={inputValue.length < 2}>
            {isIdMode ? 'Recover Account' : 'Enter Room'}
          </Button>
        </form>
      </div>
    </div>
  );
};