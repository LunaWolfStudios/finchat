import React, { useState } from 'react';
import { Button } from './Button';

interface LoginModalProps {
  onLogin: (username: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim().length > 1) {
      onLogin(username.trim());
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
            <label className="block text-xs font-bold uppercase text-neon-cyan mb-2">Identify Yourself</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter Display Name"
              className="w-full bg-black/50 border border-gray-700 focus:border-neon-cyan rounded-lg p-3 text-white outline-none transition-colors"
              autoFocus
              maxLength={20}
            />
          </div>
          
          <Button type="submit" className="w-full" disabled={username.length < 2}>
            Enter Room
          </Button>
        </form>
      </div>
    </div>
  );
};