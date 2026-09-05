
import React, { useState, useCallback } from 'react';
import { View } from './types';
import Header from './components/Header';
import HomeView from './views/HomeView';
import ScanView from './views/ScanView';
import HistoryView from './views/HistoryView';
import KnowledgeHubView from './views/KnowledgeHubView';
import CommunityView from './views/CommunityView';
import VoiceAssistant from './components/VoiceAssistant';
import Chatbot from './components/Chatbot';
import Icon from './components/Icon';
import { useLocalization } from './contexts/LocalizationContext';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.DASHBOARD);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [navigationState, setNavigationState] = useState<any>(null);
  const { t } = useLocalization();


  const navigate = useCallback((view: View, state?: any) => {
    setCurrentView(view);
    setNavigationState(state);
  }, []);

  const renderView = useCallback(() => {
    const clearNavigationState = () => setNavigationState(null);

    switch (currentView) {
      case View.DASHBOARD:
        return <HomeView setView={navigate} />;
      case View.SCAN:
        return <ScanView setView={navigate} />;
      case View.HISTORY:
        return <HistoryView setView={navigate} />;
      case View.KNOWLEDGE_HUB:
        return <KnowledgeHubView navigationState={navigationState} clearNavigationState={clearNavigationState} />;
      case View.COMMUNITY:
        return <CommunityView navigationState={navigationState} clearNavigationState={clearNavigationState} />;
      default:
        return <HomeView setView={navigate} />;
    }
  }, [currentView, navigationState, navigate]);

  return (
    <div className="min-h-screen bg-cover bg-center bg-fixed text-gray-200" style={{ backgroundImage: "url('https://picsum.photos/seed/futurefarm/1920/1080')" }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-0"></div>
      <div className="relative z-10 font-sans">
        <Header currentView={currentView} setView={navigate} />
        
        <main className="pt-24 pb-20 px-4 md:px-8">
            {renderView()}
        </main>
        
        {/* Floating Action Buttons */}
        <div className="fixed bottom-8 right-8 z-50 flex flex-col items-center space-y-4">
            <button
                onClick={() => setIsChatbotOpen(true)}
                className="bg-green-500/80 backdrop-blur-md text-white p-4 rounded-full shadow-lg hover:bg-green-500 transition-transform hover:scale-110 animate-glowing"
                style={{ animationName: 'glowing, subtle-float', animationDuration: '3s, 6s', animationDelay: '0.2s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite' }}
                aria-label={t('openChatbot')}
            >
                <Icon name="chatbot" className="w-8 h-8" />
            </button>
            <button
                onClick={() => setIsAssistantOpen(true)}
                className="bg-green-500/80 backdrop-blur-md text-white p-4 rounded-full shadow-lg hover:bg-green-500 transition-transform hover:scale-110 animate-glowing"
                style={{ animationName: 'glowing, subtle-float', animationDuration: '3s, 6s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite' }}
                aria-label={t('openVoiceAssistant')}
            >
                <Icon name="microphone" className="w-8 h-8" />
            </button>
        </div>
        
        <Chatbot isOpen={isChatbotOpen} setIsOpen={setIsChatbotOpen} />
        <VoiceAssistant isOpen={isAssistantOpen} setIsOpen={setIsAssistantOpen} />
        
        <footer 
          className="fixed bottom-4 left-1/2 -translate-x-1/2 text-sm text-green-300/80 font-sans z-50 tracking-wider"
          style={{ textShadow: '0 0 8px rgba(72, 187, 120, 0.7)' }}
        >
          {t('footerText', { team: 'Abhishek' })}
        </footer>
      </div>
    </div>
  );
};

export default App;
