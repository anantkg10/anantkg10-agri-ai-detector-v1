import React, { createContext, useState, useContext, useMemo, useEffect } from 'react';
import { translations, languages, LanguageCode } from '../services/localization';

interface LocalizationContextType {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  t: (key: string, replacements?: { [key: string]: string | number }) => string;
  languageName: string;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export const LocalizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const getInitialLanguage = (): LanguageCode => {
    const storedLang = localStorage.getItem('agri-ai-lang');
    if (storedLang && Object.keys(languages).includes(storedLang)) {
      return storedLang as LanguageCode;
    }
    return 'en';
  };

  const [language, setLanguageState] = useState<LanguageCode>(getInitialLanguage());

  useEffect(() => {
    localStorage.setItem('agri-ai-lang', language);
  }, [language]);
  
  const setLanguage = (lang: LanguageCode) => {
      setLanguageState(lang);
  };

  const t = (key: string, replacements?: { [key: string]: string | number }) => {
    let translation = translations[language][key] || translations['en'][key] || key;
    if (replacements) {
        Object.keys(replacements).forEach(placeholder => {
            translation = translation.replace(`{{${placeholder}}}`, String(replacements[placeholder]));
        });
    }
    return translation;
  };

  const languageName = useMemo(() => languages[language], [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t,
    languageName,
  }), [language, languageName, t]);

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
};

export const useLocalization = (): LocalizationContextType => {
  const context = useContext(LocalizationContext);
  if (context === undefined) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
};