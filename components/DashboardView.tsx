import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Settings, ChevronLeft, Play, Pause, RotateCcw, CheckCircle2, X, Volume2, VolumeX } from 'lucide-react';
import { CalendarEvent } from '../App';

interface DashboardViewProps {
  startTime: { hour: string; minute: string; period: string };
  endTime: { hour: string; minute: string; period: string };
  focusGoal: number;
  peakWindow: string;
  calendarEvents: CalendarEvent[];
  onBack: () => void;
}

interface ScheduleItem {
  id: string;
  type: 'focus' | 'meeting' | 'break' | 'wellness' | 'lunch' | 'transition' | 'hobby';
  label: string;
  startTime: string;
  startTimeMins: number;
  duration: number;
  subLabel?: string;
  color: string;
  stripeColor: string;
}

interface AppSettings {
  shortBreakDuration: number;
  hobbyBreakDuration: number;
  isMuted: boolean;
}

const IST_TIMEZONE = 'Asia/Kolkata';

// Hard boundaries as per user request
const DAY_START_LIMIT = 7 * 60; // 7:00 AM
const DAY_END_LIMIT = 23 * 60;  // 11:00 PM

const playNotificationSound = (isMuted: boolean) => {
  if (isMuted) return;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;
  
  const audioCtx = new AudioContextClass();
  const now = audioCtx.currentTime;

  const createTone = (type: OscillatorType, freq: number, volume: number, decay: number, attack: number = 0.01) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, now + decay);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(now);
    osc.stop(now + decay);
  };

  createTone('square', 1200, 0.4, 0.05, 0.005);
  createTone('triangle', 1800, 0.8, 1.5, 0.01);
  createTone('sine', 3600, 0.3, 1.0, 0.01);
  createTone('sine', 900, 0.5, 2.5, 0.02);
};

const DashboardView: React.FC<DashboardViewProps> = ({ 
  startTime, endTime, focusGoal, peakWindow, calendarEvents, onBack 
}) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0); 
  const [isPaused, setIsPaused] = useState<boolean>(true);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('focusPlannerSettings');
    return saved ? JSON.parse(saved) : {
      shortBreakDuration: 15,
      hobbyBreakDuration: 45,
      isMuted: false
    };
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    localStorage.setItem('focusPlannerSettings', JSON.stringify(settings));
  }, [settings]);

  const days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const now = new Date();
      const date = new Date(now.getTime() + (i * 24 * 60 * 60 * 1000));
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: IST_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short'
      }).formatToParts(date);
      const findPart = (type: string) => parts.find(p => p.type === type)?.value || '';
      const yyyy = findPart('year');
      const mm = findPart('month');
      const dd = findPart('day');
      const weekday = findPart('weekday');
      const yyyymmdd = `${yyyy}${mm}${dd}`;

      const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: IST_TIMEZONE,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      const hasEvents = calendarEvents.some(e => e.date === yyyymmdd);

      return {
        day: weekday,
        date: dd,
        fullDateString: fullDateFormatter.format(date),
        yyyymmdd,
        dot: hasEvents
      };
    });
  }, [calendarEvents]);

  const activeDay = days[selectedDayIndex];

  const schedule = useMemo(() => {
    const items: ScheduleItem[] = [];
    const BREAK_TYPES = ['break', 'lunch', 'wellness', 'hobby', 'transition'];

    const toMinutes = (h: string, m: string, p: string) => {
      let hours = parseInt(h);
      if (p === 'PM' && hours !== 12) hours += 12;
      if (p === 'AM' && hours === 12) hours = 0;
      return hours * 60 + parseInt(m);
    };
    
    const formatMinutes = (m: number) => {
      let hours = Math.floor(m / 60);
      const mins = m % 60;
      const p = hours >= 12 ? 'pm' : 'am';
      hours = (hours % 12) || 12;
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${p}`;
    };

    const userDayStart = toMinutes(startTime.hour, startTime.minute, startTime.period);
    const userDayEnd = toMinutes(endTime.hour, endTime.minute, endTime.period);
    
    const activeDayEvents = calendarEvents
      .filter(e => e.date === activeDay.yyyymmdd)
      .map(e => {
        const [h, m] = e.startTime.split(':');
        const startMins = parseInt(h) * 60 + parseInt(m);
        return {
          ...e,
          startMins,
          endMins: startMins + e.durationMinutes
        };
      })
      .sort((a, b) => a.startMins - b.startMins);

    let dayStartMins = Math.max(DAY_START_LIMIT, userDayStart);
    let dayEndMins = Math.min(DAY_END_LIMIT, userDayEnd);
    
    if (activeDayEvents.length > 0) {
      dayStartMins = Math.min(dayStartMins, Math.max(DAY_START_LIMIT, activeDayEvents[0].startMins));
      dayEndMins = Math.max(dayEndMins, Math.min(DAY_END_LIMIT, activeDayEvents[activeDayEvents.length - 1].endMins));
    }

    const getEventTypeFromSummary = (summary: string): ScheduleItem['type'] => {
      const s = summary.toLowerCase();
      if (s.includes('lunch')) return 'lunch';
      if (s.includes('wellness') || s.includes('gym')) return 'wellness';
      if (s.includes('hobby')) return 'hobby';
      if (s.includes('break')) return 'break';
      return 'meeting';
    };

    const getTypeStyles = (type: ScheduleItem['type']) => {
      switch (type) {
        case 'focus': return { color: 'bg-[#FEF1EE] border-[#FADCD5]', stripe: 'bg-[#ED6A45]' };
        case 'meeting': return { color: 'bg-[#FEF6F0] border-[#FADCD5]', stripe: 'bg-[#8E6043]' };
        case 'lunch': return { color: 'bg-blue-50 border-blue-100', stripe: 'bg-blue-400' };
        case 'wellness': return { color: 'bg-green-50 border-green-100', stripe: 'bg-green-400' };
        case 'hobby': return { color: 'bg-purple-50 border-purple-100', stripe: 'bg-purple-400' };
        case 'break': return { color: 'bg-gray-50 border-gray-100', stripe: 'bg-gray-200' };
        case 'transition': return { color: 'bg-gray-50 border-gray-100', stripe: 'bg-gray-300' };
        default: return { color: 'bg-white border-gray-100', stripe: 'bg-gray-400' };
      }
    };

    const totalMeetingsMinutes = activeDayEvents
      .filter(e => getEventTypeFromSummary(e.summary) === 'meeting')
      .reduce((acc, curr) => acc + curr.durationMinutes, 0);

    let remainingFocusMinutes = Math.max(0, focusGoal * 60 - totalMeetingsMinutes);

    // Dynamic Peak Windows (Early hours prioritize productive work)
    const peakRanges: Record<string, [number, number]> = {
      'Morning': [420, 720],       // 7 AM - 12 PM
      'Afternoon': [720, 1020],    // 12 PM - 5 PM
      'Evening': [1020, 1260],     // 5 PM - 9 PM
      'Late Night': [1260, 1380],  // 9 PM - 11 PM
    };
    const currentPeak = peakRanges[peakWindow] || [420, 720];

    let currentTime = dayStartMins;
    let safety = 0;
    let hasBreakfastBeenAdded = false;
    let hasLunchBeenAdded = activeDayEvents.some(e => getEventTypeFromSummary(e.summary) === 'lunch');

    const addItem = (item: ScheduleItem) => {
      if (items.length === 0) {
        // "Do not start the day with any sort of hobby or wellness break."
        if (['hobby', 'wellness', 'break'].includes(item.type)) {
          return; 
        }
        items.push(item);
        return;
      }
      const last = items[items.length - 1];
      const isCurrentBreak = BREAK_TYPES.includes(item.type);
      const isLastBreak = BREAK_TYPES.includes(last.type);

      if (isCurrentBreak && isLastBreak) {
        if (item.type === last.type) {
          last.duration += item.duration;
        }
      } else {
        items.push(item);
      }
    };

    const isMorningStart = dayStartMins >= 420 && dayStartMins < 540;

    while (currentTime < dayEndMins && safety < 150) {
      safety++;

      // 1. Mandatory Breakfast check
      if (isMorningStart && !hasBreakfastBeenAdded && currentTime >= 420 && currentTime < 540) {
        const morningMeeting = activeDayEvents.find(e => e.startMins <= currentTime && e.endMins > currentTime);
        if (!morningMeeting) {
          const styles = getTypeStyles('lunch');
          addItem({
            id: 'breakfast-mandatory',
            type: 'lunch',
            label: 'Fuel & Prep: Breakfast',
            subLabel: 'Nutritional anchor',
            startTime: formatMinutes(currentTime),
            startTimeMins: currentTime,
            duration: 30,
            color: styles.color,
            stripeColor: styles.stripe
          });
          currentTime += 30;
          hasBreakfastBeenAdded = true;
          continue;
        }
      }

      // 2. Lunch suggestion if not in calendar
      if (!hasLunchBeenAdded && currentTime >= 720 && currentTime < 840) {
        const lunchMeeting = activeDayEvents.find(e => e.startMins <= currentTime && e.endMins > currentTime);
        if (!lunchMeeting) {
          const styles = getTypeStyles('lunch');
          addItem({
            id: 'lunch-auto',
            type: 'lunch',
            label: 'Lunch Break',
            subLabel: 'Mid-day reset',
            startTime: formatMinutes(currentTime),
            startTimeMins: currentTime,
            duration: 45,
            color: styles.color,
            stripeColor: styles.stripe
          });
          currentTime += 45;
          hasLunchBeenAdded = true;
          continue;
        }
      }

      const currentEvent = activeDayEvents.find(e => e.startMins <= currentTime && e.endMins > currentTime);
      const nextEvent = activeDayEvents.find(e => e.startMins > currentTime);

      if (currentEvent) {
        const type = getEventTypeFromSummary(currentEvent.summary);
        const styles = getTypeStyles(type);
        addItem({
          id: `event-${currentEvent.startMins}-${currentEvent.summary}`,
          type,
          label: currentEvent.summary,
          startTime: formatMinutes(currentEvent.startMins),
          startTimeMins: currentEvent.startMins,
          duration: currentEvent.durationMinutes,
          color: styles.color,
          stripeColor: styles.stripe
        });
        currentTime = currentEvent.endMins;
        continue;
      }

      const gapEnd = nextEvent ? Math.min(nextEvent.startMins, dayEndMins) : dayEndMins;
      const gapDuration = gapEnd - currentTime;

      if (gapDuration > 0) {
        const isPeak = currentTime >= currentPeak[0] && currentTime <= currentPeak[1];
        
        // Priority: Focus segments in peak hours (early focus prioritization)
        if (remainingFocusMinutes > 0 && gapDuration >= 20) {
          const focusBlock = isPeak 
            ? Math.min(90, gapDuration, remainingFocusMinutes) 
            : Math.min(45, gapDuration, remainingFocusMinutes);
          
          const styles = getTypeStyles('focus');
          addItem({
            id: `focus-${currentTime}`,
            type: 'focus',
            label: isPeak ? 'Peak Window Deep Work' : 'Focus Sprint',
            subLabel: isPeak ? 'High-impact productivity' : 'Execution focus',
            startTime: formatMinutes(currentTime),
            startTimeMins: currentTime,
            duration: focusBlock,
            color: styles.color,
            stripeColor: styles.stripe
          });
          
          currentTime += focusBlock;
          remainingFocusMinutes -= focusBlock;

          // Wellness buffer post-focus
          if (currentTime < gapEnd) {
             const wellnessDuration = isPeak ? 15 : 10;
             if (gapEnd - currentTime >= wellnessDuration) {
               const wellStyles = getTypeStyles('wellness');
               addItem({
                 id: `well-${currentTime}`,
                 type: 'wellness',
                 label: 'Wellness Buffer',
                 subLabel: 'Hydrate & Context Reset',
                 startTime: formatMinutes(currentTime),
                 startTimeMins: currentTime,
                 duration: wellnessDuration,
                 color: wellStyles.color,
                 stripeColor: wellStyles.stripe
               });
               currentTime += wellnessDuration;
             }
          }
        } else if (gapDuration > 90 && items.length > 0) {
           // Hobby breaks for substantial gaps when goal met
           const styles = getTypeStyles('hobby');
           addItem({
            id: `hobby-${currentTime}`,
            type: 'hobby',
            label: 'Creative Hobby Break',
            subLabel: 'Personal exploration',
            startTime: formatMinutes(currentTime),
            startTimeMins: currentTime,
            duration: settings.hobbyBreakDuration,
            color: styles.color,
            stripeColor: styles.stripe
          });
          currentTime += settings.hobbyBreakDuration;
        } else {
          // General breaks
          const breakDur = Math.min(gapDuration, settings.shortBreakDuration);
          const styles = getTypeStyles('break');
          addItem({
            id: `break-${currentTime}`,
            type: 'break',
            label: 'Mental Pivot',
            subLabel: 'Strategic pause',
            startTime: formatMinutes(currentTime),
            startTimeMins: currentTime,
            duration: breakDur,
            color: styles.color,
            stripeColor: styles.stripe
          });
          currentTime = gapEnd;
        }
      } else {
        currentTime = gapEnd;
      }
    }

    return items.sort((a, b) => a.startTimeMins - b.startTimeMins);
  }, [startTime, endTime, focusGoal, peakWindow, calendarEvents, activeDay, settings]);

  useEffect(() => {
    if (!isPaused && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && activeItemIndex !== null && !isPaused) {
      playNotificationSound(settings.isMuted);
      const finishedItem = schedule[activeItemIndex];
      setCompletedIds((prev) => new Set(prev).add(finishedItem.id));
      if (activeItemIndex < schedule.length - 1) {
        const nextIndex = activeItemIndex + 1;
        setActiveItemIndex(nextIndex);
        setTimeLeft(schedule[nextIndex].duration * 60);
        setIsPaused(false);
      } else {
        setActiveItemIndex(null);
        setIsPaused(true);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, timeLeft, activeItemIndex, schedule, settings.isMuted]);

  const toggleTimer = (index: number) => {
    if (activeItemIndex === index) {
      setIsPaused(!isPaused);
    } else {
      setActiveItemIndex(index);
      setTimeLeft(schedule[index].duration * 60);
      setIsPaused(false);
    }
  };

  const formatTimeLeft = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#FDF8F5] flex flex-col items-center">
      <div className="w-full max-w-5xl bg-white min-h-screen shadow-2xl flex flex-col relative">
        
        {isSettingsOpen && (
          <div className="absolute inset-0 z-[100] bg-black/40 backdrop-blur-sm flex justify-center items-center p-6">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-2xl font-black text-[#1A2D42] tracking-tight">App Settings</h2>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 text-gray-400 hover:text-[#ED6A45] transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-8">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-bold text-gray-400 uppercase tracking-widest">Short Break Duration</label>
                    <span className="text-xl font-bold text-[#ED6A45]">{settings.shortBreakDuration}m</span>
                  </div>
                  <input 
                    type="range" min="5" max="30" step="5"
                    value={settings.shortBreakDuration}
                    onChange={(e) => setSettings({ ...settings, shortBreakDuration: parseInt(e.target.value) })}
                    className="w-full accent-[#ED6A45]"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-bold text-gray-400 uppercase tracking-widest">Hobby Break Duration</label>
                    <span className="text-xl font-bold text-[#ED6A45]">{settings.hobbyBreakDuration}m</span>
                  </div>
                  <input 
                    type="range" min="15" max="90" step="5"
                    value={settings.hobbyBreakDuration}
                    onChange={(e) => setSettings({ ...settings, hobbyBreakDuration: parseInt(e.target.value) })}
                    className="w-full accent-[#ED6A45]"
                  />
                </div>

                <div className="flex items-center justify-between p-6 bg-[#FEF1EE] rounded-3xl border border-[#FADCD5]/30">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-2xl shadow-sm">
                      {settings.isMuted ? <VolumeX className="text-red-400" size={20} /> : <Volume2 className="text-[#ED6A45]" size={20} />}
                    </div>
                    <div>
                      <span className="block font-bold text-[#8E6043]">Mute Alerts</span>
                      <span className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter">Session end notifications</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSettings({ ...settings, isMuted: !settings.isMuted })}
                    className={`w-14 h-8 rounded-full p-1 transition-colors relative ${settings.isMuted ? 'bg-[#ED6A45]' : 'bg-gray-200'}`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform transform ${settings.isMuted ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </button>
                </div>
              </div>

              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="w-full mt-10 bg-[#1A2D42] text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}

        <header className="px-6 md:px-10 pt-8 pb-4 space-y-6">
          <div className="flex justify-between items-center">
            <button onClick={onBack} className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-[#ED6A45] transition-all shadow-sm group">
              <ChevronLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-md border border-gray-50 text-[#1A2D42] hover:text-[#ED6A45] transition-colors"
            >
              <Settings size={28} />
            </button>
          </div>
          <div className="space-y-1">
            <span className="text-[#ED6A45] text-sm font-bold tracking-widest uppercase">{selectedDayIndex === 0 ? 'Today' : activeDay.day}</span>
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#1A2D42]">{activeDay.fullDateString}</h1>
          </div>
          
          <div className="flex items-center justify-between py-6 overflow-x-auto no-scrollbar gap-3 md:gap-4 px-1">
            {days.map((d, i) => (
              <div 
                key={i} 
                onClick={() => setSelectedDayIndex(i)} 
                className={`flex flex-col items-center justify-center flex-1 min-w-[65px] h-[110px] md:h-[130px] rounded-[2.5rem] transition-all cursor-pointer ${
                  selectedDayIndex === i 
                    ? 'bg-[#ED6A45] text-white shadow-xl shadow-[#ED6A45]/30 scale-[1.03] z-10' 
                    : 'bg-[#FEF1EE] text-[#ED6A45] hover:bg-[#FADCD5]/40 border border-[#FADCD5]/20'
                }`}
              >
                <span className={`text-[10px] md:text-xs font-black mb-1.5 uppercase tracking-widest ${selectedDayIndex === i ? 'opacity-90' : 'opacity-60 text-[#8E6043]'}`}>
                  {d.day}
                </span>
                <span className="text-xl md:text-2xl font-black leading-none">{d.date}</span>
                <div className="h-2 mt-2 flex items-center justify-center">
                  {d.dot && (
                    <div className={`w-1.5 h-1.5 rounded-full ${selectedDayIndex === i ? 'bg-white' : 'bg-[#ED6A45]'}`}></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </header>

        <main className="flex-1 px-6 md:px-10 pb-12 overflow-y-auto">
          <div className="max-w-3xl mx-auto py-8">
            <div className="relative">
              <div className="absolute left-[84px] top-6 bottom-6 w-[2px] bg-gray-100 hidden sm:block"></div>
              <div className="space-y-6">
                {schedule.length > 0 ? schedule.map((item, idx) => {
                  const isCompleted = completedIds.has(item.id);
                  const isActive = activeItemIndex === idx;
                  return (
                    <div key={item.id} className={`flex group transition-all duration-500 ${isCompleted ? 'opacity-50 grayscale-[0.5]' : ''}`}>
                      <div className="w-24 pr-6 pt-2 flex flex-col items-end flex-shrink-0">
                        <span className={`text-xs font-black tabular-nums uppercase whitespace-nowrap ${isCompleted ? 'text-gray-300 line-through' : 'text-gray-400'}`}>{item.startTime}</span>
                      </div>
                      <div className="flex-1 relative">
                        <div className={`absolute left-[-15px] top-6 w-3 h-3 bg-white border-2 rounded-full z-10 hidden sm:block transition-colors ${isCompleted ? 'border-[#00C853] bg-[#00C853]' : isActive ? 'border-[#ED6A45] animate-pulse' : 'border-gray-200'}`}></div>
                        <div className={`${item.color} rounded-3xl p-6 border border-transparent hover:border-gray-200 transition-all shadow-sm relative overflow-hidden group/card ${isActive ? 'ring-2 ring-[#ED6A45]/30 shadow-lg' : ''}`}>
                          <div className={`absolute left-0 top-0 bottom-0 w-2 ${item.stripeColor}`}></div>
                          <div className="pl-2">
                            <div className="flex items-start justify-between">
                              <div className="pr-4 flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <h3 className={`font-bold text-xl leading-tight transition-all ${isCompleted ? 'text-gray-400 line-through decoration-2' : (item.type === 'meeting' ? 'text-[#8E6043]' : 'text-[#1A2D42]')}`}>{item.label}</h3>
                                  {isCompleted ? <CheckCircle2 className="text-[#00C853]" size={20} /> : <span className="text-[10px] bg-white/60 px-2 py-0.5 rounded-full border border-gray-100/30 text-gray-400 font-bold uppercase tracking-widest">{item.duration}m</span>}
                                </div>
                                {item.subLabel && <p className="text-gray-500 text-sm font-medium flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${item.stripeColor} opacity-50`}></span>{item.subLabel}</p>}
                                {!isCompleted && (
                                  <div className="mt-4 flex items-center gap-4">
                                    <button onClick={() => toggleTimer(idx)} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all active:scale-95 ${isActive && !isPaused ? 'bg-red-50 text-red-500' : 'bg-white text-[#ED6A45]'}`}>
                                      {isActive && !isPaused ? <Pause size={16} /> : <Play size={16} />}
                                      <span>{isActive ? (isPaused ? 'Resume' : 'Pause') : 'Start Timer'}</span>
                                    </button>
                                    {isActive && (
                                      <div className="flex items-center gap-3">
                                        <div className="bg-[#1A2D42] text-white px-3 py-1.5 rounded-lg font-mono text-lg shadow-inner flex items-center gap-2">
                                          <div className="w-1.5 h-1.5 bg-[#ED6A45] rounded-full animate-pulse"></div>
                                          {formatTimeLeft(timeLeft)}
                                        </div>
                                        <button onClick={() => setTimeLeft(item.duration * 60)} className="p-2 text-gray-400 hover:text-[#ED6A45] transition-colors"><RotateCcw size={18} /></button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <span className="text-[10px] font-black text-gray-300 tracking-widest uppercase hidden md:inline opacity-40">{item.type}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }) : <div className="text-center py-20 text-gray-300 font-medium">No blocks scheduled.</div>}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardView;