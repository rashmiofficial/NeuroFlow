
import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, MessageSquare, Loader2 } from 'lucide-react';
import { GoogleGenAI, Modality, LiveServerMessage, Type } from '@google/genai';

interface TimeValue {
  hour: string;
  minute: string;
  period: string;
}

interface AIPlannerProps {
  startTime: TimeValue;
  setStartTime: (v: TimeValue) => void;
  endTime: TimeValue;
  setEndTime: (v: TimeValue) => void;
  focusGoal: number;
  setFocusGoal: (v: number) => void;
  peakWindow: string;
  setPeakWindow: (v: string) => void;
}

// Audio helper functions as per guidelines
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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

function createBlob(data: Float32Array): { data: string; mimeType: string } {
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

const AIPlanner: React.FC<AIPlannerProps> = ({
  startTime, setStartTime, endTime, setEndTime, focusGoal, setFocusGoal, peakWindow, setPeakWindow
}) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcriptions, setTranscriptions] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const outAudioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const inputTranscriptionRef = useRef('');
  const outputTranscriptionRef = useRef('');

  const stopSession = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (outAudioContextRef.current) {
      outAudioContextRef.current.close();
      outAudioContextRef.current = null;
    }
    for (const source of sourcesRef.current) {
      source.stop();
    }
    sourcesRef.current.clear();
    setIsActive(false);
    setIsConnecting(false);
  };

  const startSession = async () => {
    setIsConnecting(true);
    try {
      // Initialize GoogleGenAI with API key from environment variables
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const scriptProcessor = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `You are an AI planner. Help the user configure their daily settings:
          - Daily Start Time (current: ${startTime.hour}:${startTime.minute} ${startTime.period})
          - Daily End Time (current: ${endTime.hour}:${endTime.minute} ${endTime.period})
          - Focus Goal (current: ${focusGoal} hours)
          - Peak Energy Window (current: ${peakWindow}).
          Use the 'updateSettings' function to apply changes. Confirm changes to the user after calling the function.`,
          tools: [{
            functionDeclarations: [{
              name: 'updateSettings',
              description: 'Update one or more user schedule settings.',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  startHour: { type: Type.STRING, description: 'Hour for start time (01-12)' },
                  startMinute: { type: Type.STRING, description: 'Minute for start time (00-59)' },
                  startPeriod: { type: Type.STRING, enum: ['AM', 'PM'] },
                  endHour: { type: Type.STRING, description: 'Hour for end time (01-12)' },
                  endMinute: { type: Type.STRING, description: 'Minute for end time (00-59)' },
                  endPeriod: { type: Type.STRING, enum: ['AM', 'PM'] },
                  focusGoal: { type: Type.NUMBER, description: 'Daily focus goal in hours' },
                  peakWindow: { type: Type.STRING, enum: ['Morning', 'Afternoon', 'Evening', 'Late Night'] },
                }
              }
            }]
          }],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsActive(true);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Transcription
            if (message.serverContent?.inputTranscription) {
              inputTranscriptionRef.current += message.serverContent.inputTranscription.text;
            }
            if (message.serverContent?.outputTranscription) {
              outputTranscriptionRef.current += message.serverContent.outputTranscription.text;
            }
            if (message.serverContent?.turnComplete) {
              const uText = inputTranscriptionRef.current;
              const mText = outputTranscriptionRef.current;
              setTranscriptions(prev => [
                ...prev,
                ...(uText ? [{ role: 'user' as const, text: uText }] : []),
                ...(mText ? [{ role: 'model' as const, text: mText }] : [])
              ]);
              inputTranscriptionRef.current = '';
              outputTranscriptionRef.current = '';
            }

            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outAudioContextRef.current) {
              const ctx = outAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
              const audioSource = ctx.createBufferSource();
              audioSource.buffer = audioBuffer;
              audioSource.connect(ctx.destination);
              audioSource.addEventListener('ended', () => sourcesRef.current.delete(audioSource));
              audioSource.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(audioSource);
            }

            if (message.serverContent?.interrupted) {
              for (const s of sourcesRef.current) s.stop();
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }

            // Handle Function Calls
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'updateSettings') {
                  const args = fc.args as any;
                  if (args.startHour || args.startMinute || args.startPeriod) {
                    setStartTime({
                      hour: args.startHour || startTime.hour,
                      minute: args.startMinute || startTime.minute,
                      period: args.startPeriod || startTime.period
                    });
                  }
                  if (args.endHour || args.endMinute || args.endPeriod) {
                    setEndTime({
                      hour: args.endHour || endTime.hour,
                      minute: args.endMinute || endTime.minute,
                      period: args.endPeriod || endTime.period
                    });
                  }
                  if (args.focusGoal !== undefined) setFocusGoal(args.focusGoal);
                  if (args.peakWindow) setPeakWindow(args.peakWindow);

                  sessionPromise.then(s => s.sendToolResponse({
                    functionResponses: { id: fc.id, name: fc.name, response: { result: 'ok' } }
                  }));
                }
              }
            }
          },
          onerror: (e) => {
            console.error('Gemini error:', e);
            stopSession();
          },
          onclose: () => stopSession()
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error('Failed to start session:', err);
      setIsConnecting(false);
    }
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptions]);

  return (
    <section className="bg-white rounded-3xl lg:rounded-[3rem] p-6 lg:p-10 shadow-sm border border-gray-50 flex flex-col h-[400px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-900">AI Planner</h3>
        <div className="flex items-center space-x-2">
          {isActive && (
            <div className="flex space-x-1">
              <div className="w-1 h-1 bg-[#ED6A45] rounded-full animate-bounce" />
              <div className="w-1 h-1 bg-[#ED6A45] rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-1 h-1 bg-[#ED6A45] rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          )}
          <button
            onClick={isActive ? stopSession : startSession}
            disabled={isConnecting}
            className={`p-3 rounded-full transition-all ${
              isActive ? 'bg-red-500 text-white animate-pulse' : 'bg-[#ED6A45] text-white hover:bg-[#d55e3c]'
            } disabled:opacity-50`}
          >
            {isConnecting ? <Loader2 className="animate-spin" size={20} /> : isActive ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto no-scrollbar space-y-4 pr-2 mb-4"
      >
        {transcriptions.length === 0 && !isActive && !isConnecting && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-2 text-gray-400">
            <MessageSquare size={32} className="opacity-20" />
            <p className="text-sm font-medium">Talk to Gemini to plan your schedule.<br/>Ask things like "Set my focus goal to 6 hours."</p>
          </div>
        )}
        {transcriptions.map((t, i) => (
          <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm ${
              t.role === 'user' 
                ? 'bg-[#ED6A45] text-white rounded-tr-none shadow-sm' 
                : 'bg-[#FDF8F5] text-gray-700 rounded-tl-none border border-gray-100'
            }`}>
              <p className="font-semibold text-[10px] mb-1 opacity-70 uppercase tracking-wider">
                {t.role === 'user' ? 'You' : 'Gemini'}
              </p>
              {t.text}
            </div>
          </div>
        ))}
      </div>

      <div className="text-[10px] text-gray-400 font-medium uppercase tracking-widest text-center border-t border-gray-50 pt-4">
        {isActive ? 'Conversation Active' : isConnecting ? 'Connecting...' : 'Ready to help'}
      </div>
    </section>
  );
};

export default AIPlanner;
