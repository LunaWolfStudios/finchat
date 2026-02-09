import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  ...props 
}) => {
  const baseStyles = "relative inline-flex items-center justify-center font-display font-bold uppercase tracking-wider transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan hover:bg-neon-cyan hover:text-black shadow-[0_0_10px_rgba(0,255,255,0.3)] hover:shadow-[0_0_20px_rgba(0,255,255,0.6)]",
    secondary: "bg-neon-purple/10 text-neon-purple border border-neon-purple hover:bg-neon-purple hover:text-white shadow-[0_0_10px_rgba(155,92,255,0.3)] hover:shadow-[0_0_20px_rgba(155,92,255,0.6)]",
    danger: "bg-neon-pink/10 text-neon-pink border border-neon-pink hover:bg-neon-pink hover:text-white shadow-[0_0_10px_rgba(255,60,172,0.3)] hover:shadow-[0_0_20px_rgba(255,60,172,0.6)]",
    ghost: "bg-transparent text-gray-400 hover:text-white hover:bg-white/5 border-transparent",
  };

  const sizes = {
    sm: "px-3 py-1 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};