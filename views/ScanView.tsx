import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Chat, GenerateContentResponse } from "@google/genai";
import { analyzePlantImage, findRelatedArticles, translateScanResult } from '../services/geminiService';
import { ScanResult, Severity, HistoryItem, TranscriptMessage, View, Article } from '../types';
import HolographicButton from '../components/HolographicButton';
import Icon from '../components/Icon';
import LoadingSpinner from '../components/LoadingSpinner';
import Gauge from '../components/Gauge';
import { ai } from '../services/geminiService';
import { getArticles } from './KnowledgeHubView';
import { useLocalization } from '../contexts/LocalizationContext';
import { translations } from '../services/localization';
import ScanResultVoiceAssistant from '../components/ScanResultVoiceAssistant';


interface ScanViewProps {
  setView: (view: View, state?: any) => void;
}

const ScanView: React.FC<ScanViewProps> = ({ setView }) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessageKey, setLoadingMessageKey] = useState<string>('scanLoading');
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [englishScanResult, setEnglishScanResult] = useState<ScanResult | null>(null);
  const [displayedResult, setDisplayedResult] = useState<ScanResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t, language, languageName } = useLocalization();

  // Gets articles in the currently selected UI language. It will re-evaluate on language change.
  const allArticles = useMemo(() => getArticles(t), [t]);
  
  // Store language-independent article IDs
  const [relatedArticleIds, setRelatedArticleIds] = useState<number[]>([]);

  // Calculate displayed related articles based on IDs and current language's articles
  const relatedArticles = useMemo(() => {
    return allArticles.filter(a => relatedArticleIds.includes(a.id));
  }, [relatedArticleIds, allArticles]);


  const [followUpChat, setFollowUpChat] = useState<Chat | null>(null);
  const [followUpMessages, setFollowUpMessages] = useState<TranscriptMessage[]>([]);
  const [isReplying, setIsReplying] = useState(false);
  const [followUpInput, setFollowUpInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isScanAssistantOpen, setIsScanAssistantOpen] = useState(false);

  useEffect(() => {
    // Fix: Replaced NodeJS.Timeout with 'number' for browser compatibility.
    // The setInterval function in a browser environment returns a number, not a NodeJS.Timeout object.
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isLoading) {
      const messages = [
        'scanLoading1',
        'scanLoading2',
        'scanLoading3',
        'scanLoading4',
        'scanLoading5',
        'scanLoading6',
      ];
      let messageIndex = 0;
      setLoadingMessageKey(messages[messageIndex]);

      interval = setInterval(() => {
        messageIndex = (messageIndex + 1) % messages.length;
        setLoadingMessageKey(messages[messageIndex]);
      }, 2500);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isLoading]);

  useEffect(() => {
    if (!englishScanResult) {
      setDisplayedResult(null);
      return;
    }
    
    if (language === 'en') {
      setDisplayedResult(englishScanResult);
      return;
    }

    let isCancelled = false;
    const translate = async () => {
      setIsTranslating(true);
      try {
        const translatedResult = await translateScanResult(englishScanResult, languageName);
        if (!isCancelled) {
          setDisplayedResult(translatedResult);
        }
      } catch (e) {
        console.error("Failed to translate scan result:", e);
        // Fallback to English result on translation failure
        if (!isCancelled) {
          setDisplayedResult(englishScanResult);
        }
      } finally {
        if (!isCancelled) {
          setIsTranslating(false);
        }
      }
    };

    translate();

    return () => {
      isCancelled = true;
    };
  }, [englishScanResult, language, languageName]);

  useEffect(() => {
    if (displayedResult) {
      const initialContext = t('scanFollowupSystemInstruction', {
          language: languageName,
          scanResult: JSON.stringify(displayedResult)
      });

      // Provide a clean initial greeting without sending an empty message to the API
      setFollowUpMessages([{
          role: 'model',
          text: languageName.toLowerCase() === 'hindi'
              ? `नमस्ते! मैं इस पौधे के निदान (${displayedResult.diseaseName}) के बारे में आपके सवालों के उत्तर देने के लिए तैयार हूँ। आप उपचार, रोकथाम या देखभाल के बारे में पूछ सकते हैं।`
              : `Hello! I am your AI plant specialist. Feel free to ask me anything about this diagnosis (${displayedResult.diseaseName}), including treatment procedures, organic alternatives, or prevention.`
      }]);

      if (ai) {
        try {
          const newChat = ai.chats.create({
              model: 'gemini-3.1-flash-lite',
              config: {
                systemInstruction: initialContext,
                thinkingConfig: { thinkingBudget: 0 },
              },
          });
          setFollowUpChat(newChat);
        } catch (error) {
          console.warn("Could not create client chat session, will use server fallback:", error);
        }
      }
    } else {
        setFollowUpChat(null);
        setFollowUpMessages([]);
    }
  }, [displayedResult, t, languageName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [followUpMessages]);

  const handleSendFollowUp = async () => {
    if (!followUpInput.trim() || isReplying) return;

    const userMessage: TranscriptMessage = { role: 'user', text: followUpInput };
    setFollowUpMessages(prev => [...prev, userMessage]);
    const currentInput = followUpInput;
    setFollowUpInput('');
    setIsReplying(true);

    try {
        if (followUpChat) {
            const result: AsyncGenerator<GenerateContentResponse> = await followUpChat.sendMessageStream({ message: currentInput });
            let modelResponse = '';
            setFollowUpMessages(prev => [...prev, { role: 'model', text: '...' }]);

            for await (const chunk of result) {
                modelResponse += chunk.text;
                setFollowUpMessages(prev => {
                    const newMessages = [...prev];
                    if (newMessages.length > 0) {
                        newMessages[newMessages.length - 1].text = modelResponse + '...';
                    }
                    return newMessages;
                });
            }
            
            setFollowUpMessages(prev => {
                const newMessages = [...prev];
                if (newMessages.length > 0) {
                    newMessages[newMessages.length - 1].text = modelResponse;
                }
                return newMessages;
            });
            return;
        }

        // Server API fallback if direct chat is unavailable
        const initialContext = t('scanFollowupSystemInstruction', {
            language: languageName,
            scanResult: JSON.stringify(displayedResult)
        });
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: currentInput,
                systemInstruction: initialContext,
                history: followUpMessages.map(m => ({ role: m.role, content: m.text })),
            }),
        });
        if (res.ok) {
            const data = await res.json();
            setFollowUpMessages(prev => [...prev, { role: 'model', text: data.text || '' }]);
        } else {
            throw new Error('Server chat route returned ' + res.status);
        }
    } catch (error) {
        console.error('Follow-up chat error:', error);
        setFollowUpMessages(prev => [...prev, { role: 'model', text: t('scanFollowupGenericError') }]);
    } finally {
        setIsReplying(false);
    }
  };


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      resetState();
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!imageFile || !imagePreview) return;

    setIsLoading(true);
    setError(null);
    setEnglishScanResult(null);
    setRelatedArticleIds([]);
    try {
      const result = await analyzePlantImage(imageFile);
      setEnglishScanResult(result);
      // Immediately reveal diagnosis results to the user without blocking for secondary calls
      setIsLoading(false);

      try {
        const newHistoryItem: HistoryItem = {
            ...result,
            id: new Date().toISOString(),
            date: new Date().toISOString(),
            imagePreview: imagePreview,
        };
        const existingHistory: HistoryItem[] = JSON.parse(localStorage.getItem('scanHistory') || '[]');
        const updatedHistory = [newHistoryItem, ...existingHistory].slice(0, 50); 
        localStorage.setItem('scanHistory', JSON.stringify(updatedHistory));
      } catch (storageErr) {
        console.warn('Could not save to localStorage:', storageErr);
      }

      // Fetch related articles asynchronously in the background without holding up the screen
      const englishT = (key: string): string => translations['en'][key] || key;
      const allEnglishArticles = getArticles(englishT);
      findRelatedArticles(result.diseaseName, allEnglishArticles)
        .then(ids => {
          setRelatedArticleIds(ids);
        })
        .catch(err => {
          console.warn("Could not load related articles:", err);
        });

    } catch (err: any) {
      setError(err.message || t('scanErrorUnknown'));
      setIsLoading(false);
    }
  };

  const handleShareToCommunity = () => {
    if (!displayedResult || !imagePreview) return;
    const postData = {
      ...displayedResult,
      imagePreview,
    };
    setView(View.COMMUNITY, { action: 'CREATE_POST_FROM_SCAN', data: postData });
  };

  const resetState = () => {
    setImageFile(null);
    setImagePreview(null);
    setEnglishScanResult(null);
    setDisplayedResult(null);
    setError(null);
    setIsLoading(false);
    setFollowUpChat(null);
    setFollowUpMessages([]);
    setFollowUpInput('');
    setRelatedArticleIds([]);
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };
  
  const getSeverityIcon = (severity: Severity) => {
    switch(severity) {
        case Severity.HEALTHY: return <Icon name="healthy" className="w-6 h-6 text-green-400" />;
        case Severity.MILD: return <Icon name="warning" className="w-6 h-6 text-yellow-400" />;
        case Severity.MODERATE: return <Icon name="warning" className="w-6 h-6 text-orange-400" />;
        case Severity.SEVERE: return <Icon name="warning" className="w-6 h-6 text-red-500" />;
        default: return null;
    }
  }

  const getTreatmentIcon = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('spray') || lowerName.includes('fungicide')) return <Icon name="spray" className="w-8 h-8 text-green-300" />;
    if (lowerName.includes('fertilize') || lowerName.includes('nutrient')) return <Icon name="fertilizer" className="w-8 h-8 text-green-300" />;
    if (lowerName.includes('prun') || lowerName.includes('remove')) return <Icon name="scissors" className="w-8 h-8 text-green-300" />;
    return <Icon name="leaf" className="w-8 h-8 text-green-300" />;
  }

  const getPreventionIcon = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('rotat')) return <Icon name="rotate" className="w-8 h-8 text-green-300" />;
    if (lowerName.includes('variety') || lowerName.includes('resistant')) return <Icon name="shield" className="w-8 h-8 text-green-300" />;
    if (lowerName.includes('irrigat') || lowerName.includes('water')) return <Icon name="water" className="w-8 h-8 text-green-300" />;
    return <Icon name="leaf" className="w-8 h-8 text-green-300" />;
  }

  const TranslationOverlay = () => (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
        <div className="flex flex-col items-center space-y-2">
            <div className="w-8 h-8 border-t-2 border-green-400 rounded-full animate-spin"></div>
            <p className="text-green-300">{t('translating')}</p>
        </div>
    </div>
  );


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
        <LoadingSpinner textKey={loadingMessageKey} />
        {imagePreview && <img src={imagePreview} alt={t('scanningAlt')} className="mt-8 rounded-lg max-w-sm w-full h-auto object-cover opacity-30" />}
      </div>
    );
  }

  if (displayedResult) {
    return (
      <div className="container mx-auto p-4">
        <h2 className="text-4xl font-bold text-center mb-8 text-green-300">{t('scanResultTitle')}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-8">
                <div className="bg-black/30 backdrop-blur-md p-6 rounded-xl holographic-border">
                    <img src={imagePreview!} alt={t('analyzedAlt')} className="rounded-lg w-full h-auto object-cover mb-4" />
                    <HolographicButton onClick={resetState} className="w-full">{t('scanAnotherButton')}</HolographicButton>
                    <HolographicButton 
                        onClick={handleShareToCommunity} 
                        className="w-full mt-4 bg-blue-500/20 border-blue-400/50 hover:bg-blue-500/40 hover:shadow-[0_0_25px_rgba(96,165,250,0.6)]"
                        icon={<Icon name="community" className="w-6 h-6"/>}
                    >
                        {t('shareToCommunityButton')}
                    </HolographicButton>
                </div>
                <div className="bg-black/30 backdrop-blur-md p-6 rounded-xl holographic-border text-center">
                    <h3 className="text-xl font-bold text-green-300 mb-4">{t('severityAssessment')}</h3>
                    <div className="flex justify-center">
                        <Gauge severity={displayedResult.severity} />
                    </div>
                </div>
            </div>

            <div className="lg:col-span-2 space-y-8">
                <div className="bg-black/30 backdrop-blur-md p-6 rounded-xl holographic-border relative">
                    {isTranslating && <TranslationOverlay />}
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-3xl font-bold text-green-300">{displayedResult.diseaseName}</h3>
                            <p className="text-gray-400">{t('confidence')}: {displayedResult.confidence.toFixed(1)}%</p>
                        </div>
                        {getSeverityIcon(displayedResult.severity)}
                    </div>
                    <p className="mt-4 text-gray-300">{displayedResult.summary}</p>
                </div>

                <div className="bg-black/30 backdrop-blur-md rounded-xl holographic-border flex flex-col h-[400px]">
                     <div className="p-4 border-b border-green-400/30 flex justify-between items-center">
                        <h3 className="text-2xl font-bold text-green-300">{t('askFollowUp')}</h3>
                        <button
                            onClick={() => setIsScanAssistantOpen(true)}
                            className="bg-green-500/30 text-white p-2 rounded-full hover:bg-green-500/50 transition-colors"
                            aria-label={t('discussWithAgriBot')}
                            title={t('discussWithAgriBot')}
                        >
                            <Icon name="microphone" className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex-1 p-4 overflow-y-auto space-y-4">
                        {followUpMessages.map((msg, index) => (
                            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-md px-4 py-2 rounded-2xl ${msg.role === 'user' ? 'bg-green-600/50 text-white rounded-br-none' : 'bg-gray-700/50 text-gray-200 rounded-bl-none'}`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isReplying && followUpMessages[followUpMessages.length -1]?.role === 'user' && (
                             <div className="flex justify-start">
                                <div className="max-w-xs px-4 py-2 rounded-2xl bg-gray-700/50 text-gray-200 rounded-bl-none animate-pulse">...</div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                     <div className="p-4 border-t border-green-400/30">
                        <div className="flex items-center space-x-2 bg-black/30 rounded-full holographic-border p-1">
                             <input
                                type="text"
                                value={followUpInput}
                                onChange={(e) => setFollowUpInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSendFollowUp()}
                                placeholder={t('followUpPlaceholder')}
                                className="flex-1 bg-transparent px-4 py-2 text-white placeholder-gray-400 focus:outline-none"
                                disabled={isReplying}
                            />
                            <button onClick={handleSendFollowUp} disabled={isReplying || !followUpInput.trim()} className="bg-green-500/80 text-white p-2 rounded-full hover:bg-green-500 disabled:opacity-50">
                                <Icon name="arrowRight" className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {relatedArticles.length > 0 && (
                    <div className="bg-black/30 backdrop-blur-md p-6 rounded-xl holographic-border">
                        <h3 className="text-2xl font-bold text-green-300 mb-4">{t('relatedArticles')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {relatedArticles.map((article) => (
                                <div 
                                    key={article.id} 
                                    className="bg-black/30 p-4 rounded-lg holographic-border cursor-pointer hover:border-green-400 transition-colors"
                                    onClick={() => setView(View.KNOWLEDGE_HUB, { selectedArticleId: article.id })}
                                >
                                    <h4 className="font-bold text-lg text-white">{article.title}</h4>
                                    <p className="text-sm text-gray-400 line-clamp-2">{article.summary}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}


                <div className="bg-black/30 backdrop-blur-md p-6 rounded-xl holographic-border relative">
                    {isTranslating && <TranslationOverlay />}
                    <h3 className="text-2xl font-bold text-green-300 mb-4">{t('treatmentRecommendations')}</h3>
                    <div className="space-y-4">
                        {displayedResult.treatments.map((item, index) => (
                            <div key={index} className="flex items-start space-x-4">
                                <div className="p-3 bg-green-500/10 rounded-full">{getTreatmentIcon(item.name)}</div>
                                <div>
                                    <h4 className="font-bold text-lg text-white">{item.name}</h4>
                                    <p className="text-gray-400">{item.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="bg-black/30 backdrop-blur-md p-6 rounded-xl holographic-border relative">
                    {isTranslating && <TranslationOverlay />}
                    <h3 className="text-2xl font-bold text-green-300 mb-4">{t('preventionTips')}</h3>
                     <div className="space-y-4">
                        {displayedResult.preventionTips.map((item, index) => (
                           <div key={index} className="flex items-start space-x-4">
                                <div className="p-3 bg-green-500/10 rounded-full">{getPreventionIcon(item.name)}</div>
                                <div>
                                    <h4 className="font-bold text-lg text-white">{item.name}</h4>
                                    <p className="text-gray-400">{item.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
         <ScanResultVoiceAssistant
          isOpen={isScanAssistantOpen}
          setIsOpen={setIsScanAssistantOpen}
          scanResult={displayedResult}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] text-center">
      <h2 className="text-4xl font-bold mb-4 text-green-300">{t('scanTitle')}</h2>
      <p className="text-gray-400 mb-8 max-w-lg">{t('scanSubtitle')}</p>

      <div
        className="w-full max-w-2xl h-80 border-2 border-dashed border-green-400/50 rounded-2xl flex flex-col items-center justify-center p-8 bg-black/20 backdrop-blur-sm cursor-pointer hover:border-green-400 hover:bg-black/40 transition-all duration-300"
        onClick={() => fileInputRef.current?.click()}
      >
        <input type="file" accept="image/*" onChange={handleFileChange} ref={fileInputRef} className="hidden" />
        {imagePreview ? (
          <img src={imagePreview} alt={t('plantPreviewAlt')} className="max-h-full rounded-lg" />
        ) : (
          <div className="text-center">
            <Icon name="upload" className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <p className="text-xl font-semibold">{t('uploadPrompt')}</p>
            <p className="text-gray-500">{t('supportedFormats')}</p>
          </div>
        )}
      </div>

      {error && (
        <div className="w-full max-w-2xl mt-4 bg-red-950/40 border border-red-500/40 rounded-xl p-4 text-left flex items-start justify-between gap-3 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <Icon name="warning" className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-red-300">Diagnosis Notice</p>
              <p className="text-red-200/90 mt-1 leading-relaxed">{error}</p>
            </div>
          </div>
          {imageFile && (
            <button
              onClick={handleAnalyze}
              disabled={isLoading}
              className="flex-shrink-0 px-3 py-1.5 bg-red-500/30 hover:bg-red-500/50 border border-red-400/50 text-red-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Retry
            </button>
          )}
        </div>
      )}
      
      {imageFile && (
        <HolographicButton
            onClick={handleAnalyze}
            disabled={isLoading}
            className="mt-8 animate-glowing"
        >
            {t('analyzeButton')}
        </HolographicButton>
      )}
    </div>
  );
};

export default ScanView;