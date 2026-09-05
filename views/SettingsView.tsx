import React from 'react';
import { useLocalization } from '../contexts/LocalizationContext';

// Fix: Removed imports for non-existent members 'getApiKeyStatus' and 'setSessionApiKey'.
// The component has been refactored to be informational-only to comply with API key guidelines.
interface SettingsViewProps {
    onApiKeyUpdate: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ onApiKeyUpdate }) => {
    const { t } = useLocalization();

    // The status is now determined directly from a check on the environment variable.
    // This is a simplified, read-only status for display purposes.
    const isConfigured = !!process.env.API_KEY;

    return (
        <div className="container mx-auto max-w-2xl p-4">
            <div className="text-center mb-12">
                <h2 className="text-4xl font-bold text-green-300">{t('settings')}</h2>
                <p className="text-gray-400 mt-4">
                    {t('settingsSubtitle')}
                </p>
            </div>

            <div className="bg-black/30 backdrop-blur-md p-8 rounded-xl holographic-border">
                <h3 className="text-2xl font-bold text-white mb-4">{t('settingsApiKeyTitle')}</h3>
                
                <div className={`p-4 rounded-lg mb-6 border ${isConfigured ? 'bg-green-500/10 border-green-400/30' : 'bg-yellow-500/10 border-yellow-400/30'}`}>
                    <p className="font-bold text-lg">{`${t('settingsStatus')}: ${isConfigured ? 'Configured' : 'Not Configured'}`}</p>
                    <p className="text-sm text-gray-300">
                        {isConfigured 
                            ? t('settingsStatusConfigured')
                            : t('settingsStatusNotConfigured')
                        }
                    </p>
                </div>

                <p className="text-gray-400 mb-4">
                    {t('settingsApiDescPart1')} <code className="bg-gray-800 text-yellow-300 px-1 py-0.5 rounded text-xs">API_KEY</code> {t('settingsApiDescPart2')}
                </p>
                <p className="text-sm text-green-300 mt-4">
                    The API key is managed via an environment variable and cannot be changed in this interface.
                </p>
            </div>
        </div>
    );
};

export default SettingsView;
