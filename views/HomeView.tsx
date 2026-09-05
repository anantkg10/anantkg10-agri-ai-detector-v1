
import React from 'react';
import { View } from '../types';
import HolographicButton from '../components/HolographicButton';
import Icon from '../components/Icon';
import { useLocalization } from '../contexts/LocalizationContext';

interface HomeViewProps {
  setView: (view: View, state?: any) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ setView }) => {
  const { t } = useLocalization();
  return (
    <div className="container mx-auto text-center flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
      <div className="p-8 bg-black/30 backdrop-blur-md rounded-2xl holographic-border animate-subtle-float">
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-4">
          {t('homeTitlePart1')} <span className="text-green-400">Agri-AI</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-8">
          {t('homeSubtitle')}
        </p>
        <HolographicButton
          onClick={() => setView(View.SCAN)}
          className="animate-glowing"
          icon={<Icon name="scan" className="w-8 h-8" />}
        >
          {t('homeScanButton')}
        </HolographicButton>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20 max-w-5xl w-full">
        <FeatureCard
          icon={<Icon name="shield" className="w-10 h-10 text-green-400" />}
          title={t('feature1Title')}
          description={t('feature1Desc')}
        />
        <FeatureCard
          icon={<Icon name="book" className="w-10 h-10 text-green-400" />}
          title={t('feature2Title')}
          description={t('feature2Desc')}
        />
        <FeatureCard
          icon={<Icon name="community" className="w-10 h-10 text-green-400" />}
          title={t('feature3Title')}
          description={t('feature3Desc')}
        />
      </div>
    </div>
  );
};

const FeatureCard: React.FC<{ icon: React.ReactNode, title: string, description: string }> = ({ icon, title, description }) => (
    <div className="bg-black/30 backdrop-blur-md p-6 rounded-xl holographic-border text-center transform hover:scale-105 transition-transform duration-300">
        <div className="flex justify-center mb-4">{icon}</div>
        <h3 className="text-xl font-bold text-green-300 mb-2">{title}</h3>
        <p className="text-gray-400">{description}</p>
    </div>
);


export default HomeView;
