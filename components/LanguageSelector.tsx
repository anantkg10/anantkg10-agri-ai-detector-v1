
import React, { useState, useRef, useEffect } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { languages, LanguageCode } from '../services/localization';
import Icon from './Icon';

const LanguageSelector: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { language, setLanguage } = useLocalization();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLanguageChange = (langCode: LanguageCode) => {
    setLanguage(langCode);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full text-sm font-medium transition-all duration-300 text-gray-300 hover:bg-green-500/10 hover:text-white"
        aria-label="Select language"
      >
        <Icon name="globe" className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-black/50 backdrop-blur-lg rounded-xl holographic-border shadow-2xl z-50 overflow-hidden">
          <ul className="py-2">
            {Object.entries(languages).map(([code, name]) => (
              <li key={code}>
                <button
                  onClick={() => handleLanguageChange(code as LanguageCode)}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors duration-200 ${
                    language === code
                      ? 'bg-green-500/30 text-white'
                      : 'text-gray-200 hover:bg-green-500/10'
                  }`}
                >
                  {name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
