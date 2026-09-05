import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LiveServerMessage, Modality, Blob } from '@google/genai';
import { TranscriptMessage } from '../types';
import Icon from './Icon';
import { ai } from '../services/geminiService';
import { useLocalization } from '../contexts/LocalizationContext';

// --- Audio Encoding/Decoding Functions (from @google/genai guidelines) ---

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

// --- Component ---

type AssistantStatus = 'OFFLINE' | 'CONNECTING' | 'LISTENING' | 'SPEAKING' | 'ERROR';

interface VoiceAssistantProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ isOpen, setIsOpen }) => {
    const { t, languageName } = useLocalization();
    const [status, setStatus] = useState<AssistantStatus>('OFFLINE');
    const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
    
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const outputSourcesRef = useRef(new Set<AudioBufferSourceNode>());
    const nextStartTimeRef = useRef(0);

    const currentInputTranscriptionRef = useRef('');
    const currentOutputTranscriptionRef = useRef('');

    const cleanup = useCallback(() => {
        sessionPromiseRef.current?.then(session => session.close());
        sessionPromiseRef.current = null;

        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;

        sourceNodeRef.current?.disconnect();
        scriptProcessorRef.current?.disconnect();
        
        inputAudioContextRef.current?.close().catch(console.error);
        outputAudioContextRef.current?.close().catch(console.error);

        inputAudioContextRef.current = null;
        outputAudioContextRef.current = null;
        scriptProcessorRef.current = null;
        sourceNodeRef.current = null;
        
        outputSourcesRef.current.forEach(source => source.stop());
        outputSourcesRef.current.clear();
        nextStartTimeRef.current = 0;
    }, []);

    useEffect(() => {
        if (!isOpen) {
            cleanup();
            return;
        }

        if (!ai) {
            setStatus('OFFLINE');
            setTranscripts([{ role: 'model', text: t('voiceAssistantOfflineMessage') }]);
            return;
        }

        const startSession = async () => {
            setTranscripts([]);
            setStatus('CONNECTING');
            
            try {
                // Fix: Cast window to `any` to allow access to vendor-prefixed `webkitAudioContext` for older browser compatibility.
                inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                // Fix: Cast window to `any` to allow access to vendor-prefixed `webkitAudioContext` for older browser compatibility.
                outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                
                streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

                sessionPromiseRef.current = ai.live.connect({
                    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                    callbacks: {
                        onopen: () => {
                            if (!inputAudioContextRef.current || !streamRef.current) return;
                            setStatus('LISTENING');
                            const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
                            sourceNodeRef.current = source;
                            const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                            scriptProcessorRef.current = scriptProcessor;
                            const gainNode = inputAudioContextRef.current.createGain();
                            gainNode.gain.setValueAtTime(0, inputAudioContextRef.current.currentTime);


                            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                                const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                                const pcmBlob = createBlob(inputData);
                                sessionPromiseRef.current!.then((session) => {
                                    session.sendRealtimeInput({ media: pcmBlob });
                                });
                            };
                            source.connect(scriptProcessor);
                            scriptProcessor.connect(gainNode);
                            gainNode.connect(inputAudioContextRef.current.destination);
                        },
                        onmessage: async (message: LiveServerMessage) => {
                             if (message.serverContent?.outputTranscription) {
                                currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                            }
                            if (message.serverContent?.inputTranscription) {
                                currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                            }

                            if (message.serverContent?.turnComplete) {
                                const userInput = currentInputTranscriptionRef.current.trim();
                                const modelOutput = currentOutputTranscriptionRef.current.trim();
                                
                                setTranscripts(prev => {
                                    const newHistory = [...prev];
                                    if(userInput) newHistory.push({ role: 'user', text: userInput });
                                    if(modelOutput) newHistory.push({ role: 'model', text: modelOutput });
                                    return newHistory;
                                });

                                currentInputTranscriptionRef.current = '';
                                currentOutputTranscriptionRef.current = '';
                            }

                            const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                            if (base64EncodedAudioString && outputAudioContextRef.current) {
                                setStatus('SPEAKING');
                                nextStartTimeRef.current = Math.max(
                                    nextStartTimeRef.current,
                                    outputAudioContextRef.current.currentTime,
                                );
                                const audioBuffer = await decodeAudioData(
                                    decode(base64EncodedAudioString),
                                    outputAudioContextRef.current,
                                    24000,
                                    1,
                                );
                                const source = outputAudioContextRef.current.createBufferSource();
                                source.buffer = audioBuffer;
                                source.connect(outputAudioContextRef.current.destination);
                                source.addEventListener('ended', () => {
                                    outputSourcesRef.current.delete(source);
                                    if(outputSourcesRef.current.size === 0) {
                                        setStatus('LISTENING');
                                    }
                                });

                                source.start(nextStartTimeRef.current);
                                nextStartTimeRef.current = nextStartTimeRef.current + audioBuffer.duration;
                                outputSourcesRef.current.add(source);
                            }

                            const interrupted = message.serverContent?.interrupted;
                            if (interrupted) {
                                outputSourcesRef.current.forEach(source => source.stop());
                                outputSourcesRef.current.clear();
                                nextStartTimeRef.current = 0;
                            }
                        },
                        onerror: (e: ErrorEvent) => {
                            console.error('Voice assistant error:', e);
                            setStatus('ERROR');
                            setTranscripts(prev => [...prev, {role: 'model', text: t('voiceAssistantConnectionError')}]);
                        },
                        onclose: (e: CloseEvent) => {
                           // The session is closed, cleanup is handled by the main effect hook.
                        },
                    },
                    config: {
                        responseModalities: [Modality.AUDIO],
                        speechConfig: {
                            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
                        },
                        inputAudioTranscription: {},
                        outputAudioTranscription: {},
                        systemInstruction: t('voiceAssistantSystemInstruction', { language: languageName }),
                    },
                });
            } catch(e) {
                console.error("Failed to start voice session:", e);
                setStatus('ERROR');
                setTranscripts([{role: 'model', text: t('voiceAssistantGenericError')}]);
            }
        };

        startSession();
        return () => cleanup();
    }, [isOpen, t, languageName, cleanup]);

    const getStatusText = () => {
        switch (status) {
            case 'CONNECTING': return t('voiceAssistantStatusConnecting');
            case 'LISTENING': return t('voiceAssistantStatusListening');
            case 'SPEAKING': return t('voiceAssistantStatusSpeaking');
            case 'ERROR': return t('voiceAssistantStatusError');
            case 'OFFLINE': return 'Offline';
            default: return '';
        }
    }

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex flex-col items-center justify-center z-[100] p-4">
             <header className="absolute top-0 left-0 right-0 flex items-center justify-between p-4">
                <h3 className="text-xl font-bold text-green-300">{t('voiceAssistantTitle')}</h3>
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white text-3xl font-bold">&times;</button>
            </header>

            <main className="w-full max-w-2xl flex flex-col items-center justify-center flex-1">
                <div className="relative w-48 h-48 flex items-center justify-center mb-8">
                     <div className={`absolute inset-0 rounded-full bg-green-500/20 animate-pulse ${status === 'LISTENING' ? 'animate-ping' : ''}`} style={{animationDuration: '2s'}}></div>
                    <div className={`absolute inset-2 rounded-full bg-green-500/30 ${status === 'SPEAKING' ? 'animate-pulse' : ''}`} style={{animationDuration: '1s'}}></div>
                    <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-colors ${status === 'ERROR' ? 'bg-red-500/50' : 'bg-green-500/50'}`}>
                         <Icon name="microphone" className="w-16 h-16 text-white"/>
                    </div>
                </div>
                 <p className="text-lg text-green-300 h-6">{getStatusText()}</p>
            </main>

             <div className="w-full max-w-3xl h-1/3 overflow-y-auto p-4 space-y-4 text-center">
                {transcripts.map((msg, index) => (
                    <div key={index}>
                        <p className={`text-lg ${msg.role === 'user' ? 'text-white font-semibold' : 'text-gray-300'}`}>
                           {msg.text}
                        </p>
                    </div>
                ))}
            </div>

        </div>
    );
};

export default VoiceAssistant;