
import React from 'react';

interface HolographicButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

const HolographicButton: React.FC<HolographicButtonProps> = ({
  children,
  icon,
  className = '',
  ...props
}) => {
  return (
    <button
      className={`
        px-8 py-4 rounded-lg font-bold text-lg text-white
        bg-green-500/20 border border-green-400/50
        backdrop-blur-sm
        transition-all duration-300 ease-in-out
        hover:bg-green-500/40 hover:text-white hover:shadow-[0_0_25px_rgba(72,187,120,0.6)]
        focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75
        disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
        flex items-center justify-center space-x-3
        ${className}
      `}
      {...props}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
};

export default HolographicButton;