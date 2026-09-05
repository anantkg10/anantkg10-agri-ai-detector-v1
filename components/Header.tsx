import React from 'react';
import { View } from '../types';
import Icon from './Icon';
import { useLocalization } from '../contexts/LocalizationContext';
import LanguageSelector from './LanguageSelector';

interface HeaderProps {
  currentView: View;
  setView: (view: View, state?: any) => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, setView }) => {
  const { t } = useLocalization();

  const navItems = [
    { view: View.DASHBOARD, label: t('dashboard'), icon: 'dashboard' },
    { view: View.SCAN, label: t('scanPlant'), icon: 'scan' },
    { view: View.HISTORY, label: t('history'), icon: 'history' },
    { view: View.KNOWLEDGE_HUB, label: t('knowledgeHub'), icon: 'book' },
    { view: View.COMMUNITY, label: t('community'), icon: 'community' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 p-4 flex justify-center">
      <nav className="w-full max-w-5xl bg-black/30 backdrop-blur-md rounded-full holographic-border flex items-center justify-between p-2">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-green-500/20 rounded-full">
            <Icon name="leaf" className="w-6 h-6 text-green-400" />
          </div>
          <span className="font-bold text-lg hidden sm:block text-green-300 tracking-wider">AGRI-AI</span>
        </div>
        <div className="flex items-center space-x-1">
          {navItems.map((item) => (
            <button
              key={item.view}
              onClick={() => setView(item.view)}
              className={`px-3 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center space-x-2 ${
                currentView === item.view
                  ? 'bg-green-500/30 text-white'
                  : 'text-gray-300 hover:bg-green-500/10 hover:text-white'
              }`}
            >
              <Icon name={item.icon as any} className="w-4 h-4" />
              <span className="hidden md:inline">{item.label}</span>
            </button>
          ))}
            <LanguageSelector />
        </div>
      </nav>
    </header>
  );
};

export default Header;