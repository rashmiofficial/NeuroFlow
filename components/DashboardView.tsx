
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Coffee, ChevronLeft, Calendar, Play, Pause, RotateCcw, Timer as TimerIcon, CheckCircle2, Zap, BarChart3, AlertCircle, PlusCircle, MinusCircle } from 'lucide-react';
import { CalendarEvent } from '../App';

interface DashboardViewProps {
  startTime: { hour: string; minute: string; period: string };
  endTime: { hour: string; minute: string; period: string };
  focusGoal: number;
  peakWindow: string;
  shortBreak: number;
  longBreak: number;
  isMuted: boolean;
  calendarEvents: CalendarEvent[];
  onBack: () => void;
}

interface ScheduleItem {
  id: string;
  type: 'focus' | 'meeting' | 'break' | 'wellness' | 'lunch' | 'hobby';
  label: string;
  startTime: string; // HH:mm
  duration: number; // in minutes
  color?: string;
  isNew?: boolean;
}

const IST_TIMEZONE = 'Asia/Kolkata';
const START_SOUND_URL = 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg';
const END_SOUND_URL = 'https://actions.google.com/sounds/v1/alarms/alarm_clock_short.ogg';

const SessionTimer: React.FC<{ 
  id: string;
  duration: number; 
  type: string; 
  isCompleted: boolean;
  isActive: boolean;
  isMuted: boolean;
  onStart: () => void;
  onComplete: () => void;
}> = ({ id, duration, type, isCompleted, isActive, isMuted, onStart, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState(isCompleted ? 0 : duration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startAudioRef = useRef<HTMLAudioElement | null>(null);
  const endAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    startAudioRef.current = new Audio(START_SOUND_URL);
    endAudioRef.current = new Audio(END_SOUND_URL);
  }, []);

  const playNotification = (audio: HTMLAudioElement | null) => {
    if (!audio || isMuted) return;
    audio.currentTime = 0;
    audio.loop = true; // Loop to ensure it lasts 5 seconds
    audio.play().catch(e => console.log("Audio play failed", e));
    setTimeout(() => {
      audio.pause();
      audio.loop = false;
      audio.currentTime = 0;
    }, 5000);
  };

  // Sync isRunning with isActive for auto-play
  useEffect(() => {
    if (isActive && !isCompleted && !isRunning) {
      setIsRunning(true);
      playNotification(startAudioRef.current);
    } else if (!isActive && isRunning) {
      // If parent deactivates us, stop the timer
      setIsRunning(false);
    }
  }, [isActive, isCompleted]);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      
      if (timeLeft === 0 && isRunning && !isCompleted) {
        setIsRunning(false);
        playNotification(endAudioRef.current);
        onComplete();
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, timeLeft, isCompleted, isMuted, onComplete]);

  useEffect(() => {
    if (isCompleted) {
      setTimeLeft(0);
      setIsRunning(false);
    }
  }, [isCompleted]);

  const handleToggle = () => {
    if (!isRunning) {
      onStart(); // Tells parent to make this one the active session
      if (!isActive) {
        // If it wasn't already active (auto-play), play start sound now
        playNotification(startAudioRef.current);
      }
    } else {
      // Manual pause - should probably stop auto-play? 
      // We'll just stop this one and let the user decide
      setIsRunning(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const isBreak = ['break', 'wellness', 'lunch', 'hobby'].includes(type);

  if (isCompleted) {
    return (
      <div className={`flex items-center space-x-3 sm:space-x-4 ${isBreak ? 'ml-auto' : ''}`}>
        <div className="flex flex-col items-center justify-center px-3 py-1 sm:px-4 sm:py-2 rounded-2xl bg-green-50 text-green-600 border border-green-100 min-w-[70px] sm:min-w-[90px]">
          <CheckCircle2 size={16} className="mb-0.5" />
          <span className="text-[10px] font-black uppercase tracking-widest leading-none">Done</span>
        </div>
        <button 
          onClick={() => { setTimeLeft(duration * 60); onComplete(); }}
          className="p-2 sm:p-3 bg-white border border-gray-100 text-gray-400 rounded-full hover:bg-gray-50 transition-all active:scale-90 shadow-sm"
        >
          <RotateCcw size={14} className="sm:w-4 sm:h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-3 sm:space-x-4 ${isBreak ? 'ml-auto' : ''}`}>
      <div className={`flex flex-col items-center justify-center px-3 py-1 sm:px-4 sm:py-2 rounded-2xl ${
        isRunning ? 'bg-black text-white' : 'bg-gray-100 text-gray-500'
      } transition-colors min-w-[70px] sm:min-w-[90px]`}>
        <span className="text-[8px] font-bold uppercase tracking-widest mb-0.5 opacity-60">Timer</span>
        <span className="text-sm sm:text-lg font-black tabular-nums leading-none">
          {formatTime(timeLeft)}
        </span>
      </div>
      
      <div className="flex space-x-1 sm:space-x-2">
        <button 
          onClick={handleToggle}
          className={`p-2 sm:p-3 rounded-full transition-all active:scale-90 shadow-sm ${
            isRunning 
              ? 'bg-gray-800 text-white hover:bg-gray-700' 
              : 'bg-[#ED6A45] text-white hover:bg-[#d55e3c]'
          }`}
        >
          {isRunning ? <Pause size={14} className="sm:w-4 sm:h-4" /> : <Play size={14} className="sm:w-4 sm:h-4 ml-0.5" />}
        </button>
        <button 
          onClick={() => { setIsRunning(false); setTimeLeft(duration * 60); }}
          className="p-2 sm:p-3 bg-white border border-gray-100 text-gray-400 rounded-full hover:bg-gray-50 transition-all active:scale-90 shadow-sm"
        >
          <RotateCcw size={14} className="sm:w-4 sm:h-4" />
        </button>
      </div>
    </div>
  );
};

const DashboardView: React.FC<DashboardViewProps> = ({ 
  startTime, endTime, focusGoal, peakWindow, shortBreak, longBreak, isMuted, calendarEvents, onBack 
}) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [statsMode, setStatsMode] = useState<'daily' | 'weekly'>('daily');
  const [completedSessions, setCompletedSessions] = useState<Set<string>>(new Set());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  const [manualAdjustment, setManualAdjustment] = useState<Record<string, number>>({});
  const [newSessionIds, setNewSessionIds] = useState<Set<string>>(new Set());
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
      
      return {
        day: findPart('weekday'),
        date: findPart('day'),
        fullDateString: new Intl.DateTimeFormat('en-US', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }).format(date),
        yyyymmdd: `${findPart('year')}${findPart('month')}${findPart('day')}`
      };
    });
  }, []);

  const activeDay = days[selectedDayIndex];

  const generateSchedule = (targetDay: typeof days[0], overrideGoal?: number) => {
    const items: ScheduleItem[] = [];
    const toMinutes = (h: string, m: string, p: string) => {
      let hours = parseInt(h);
      if (p === 'PM' && hours !== 12) hours += 12;
      if (p === 'AM' && hours === 12) hours = 0;
      return hours * 60 + parseInt(m);
    };
    const formatTime = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const dayStartMins = toMinutes(startTime.hour, startTime.minute, startTime.period);
    const dayEndMins = toMinutes(endTime.hour, endTime.minute, endTime.period);

    const dayEvents = calendarEvents
      .filter(e => e.date === targetDay.yyyymmdd)
      .map(e => {
        const [h, m] = e.startTime.split(':');
        const [eh, em] = e.endTime.split(':');
        return { 
          ...e, 
          startMins: parseInt(h) * 60 + parseInt(m),
          endMins: parseInt(eh) * 60 + parseInt(em)
        };
      })
      .sort((a, b) => a.startMins - b.startMins);

    let currentTime = dayStartMins;
    const currentAdj = manualAdjustment[targetDay.yyyymmdd] || 0;
    const effectiveFocusGoal = overrideGoal !== undefined ? overrideGoal : (focusGoal + currentAdj);
    let focusRemaining = effectiveFocusGoal * 60;
    let lastType: string | null = null;
    let hasLongBreakAnchor = false;

    const peakRanges: Record<string, [number, number]> = {
      'Morning': [480, 720],
      'Afternoon': [840, 1020],
      'Evening': [1080, 1260],
      'Late Night': [1260, 1440]
    };
    const [peakStart, peakEnd] = peakRanges[peakWindow] || [840, 1020];
    const eventColors = ['bg-[#A9C5D3]', 'bg-[#FADCD5]', 'bg-[#D9CCE8]', 'bg-[#F5D5B8]'];
    let colorIdx = 0;

    const isBreakType = (t: string) => ['break', 'hobby', 'lunch', 'wellness'].includes(t);

    const addSession = (type: ScheduleItem['type'], label: string, duration: number, color?: string) => {
      if (duration <= 0) return;
      const id = `${targetDay.yyyymmdd}-${type}-${currentTime}`;
      items.push({
        id,
        type, label, duration, color: color || eventColors[colorIdx++ % eventColors.length],
        startTime: formatTime(currentTime),
        isNew: newSessionIds.has(id)
      });
      currentTime += duration;
      lastType = type;
    };

    while (currentTime < dayEndMins) {
      if (currentTime >= 780 && currentTime < 840 && !hasLongBreakAnchor) {
        if (!isBreakType(lastType || '')) {
          addSession('break', 'Lunch Break', longBreak);
          hasLongBreakAnchor = true;
          continue;
        }
      }

      const nextMeeting = dayEvents.find(e => e.startMins >= currentTime);
      if (nextMeeting && nextMeeting.startMins === currentTime) {
        addSession('meeting', nextMeeting.summary, nextMeeting.durationMinutes);
        dayEvents.shift();
        continue;
      }

      const gap = nextMeeting ? nextMeeting.startMins - currentTime : dayEndMins - currentTime;
      if (gap > 0) {
        if (lastType === 'focus' || lastType === 'meeting' || !lastType) {
          const breakDur = Math.min(gap >= 45 ? 45 : shortBreak, gap);
          addSession('break', breakDur >= 45 ? 'Wellness Break' : 'Short break', breakDur);
        } 
        else {
          const inPeak = currentTime >= peakStart && currentTime < peakEnd;
          let focusDur = gap;
          if (inPeak) {
             if (currentAdj > 0) {
               focusDur = Math.min(focusRemaining >= 60 && (focusGoal + currentAdj - focusGoal) < 1 ? 60 : 45, gap);
             } else {
               focusDur = Math.min(90, gap);
             }
          } else {
             focusDur = Math.min(45, gap);
          }
          
          if (focusRemaining > 0) {
            focusDur = Math.min(focusDur, focusRemaining);
            const isPeak = inPeak && focusDur >= 45;
            addSession('focus', isPeak ? 'Peak Focus Session' : 'Standard Focus', focusDur, isPeak ? 'bg-[#FADCD5]' : 'bg-white');
            focusRemaining -= focusDur;
          } else {
            addSession('hobby', 'Creative Hobby Block', Math.min(gap, 60), 'bg-[#E1EED9]');
          }
        }
      } else {
        if (nextMeeting) {
          currentTime = nextMeeting.endMins;
        } else {
          currentTime = dayEndMins;
        }
      }
    }
    return items;
  };

  const schedule = useMemo(() => generateSchedule(activeDay), [activeDay, startTime, endTime, focusGoal, peakWindow, shortBreak, longBreak, calendarEvents, manualAdjustment, newSessionIds]);

  const stats = useMemo(() => {
    const calcForSchedule = (s: ScheduleItem[]) => {
      let focusMins = 0;
      let breakMins = 0;
      s.forEach(item => {
        if (item.type === 'focus' || item.type === 'meeting') {
          focusMins += item.duration;
        } else {
          breakMins += item.duration;
        }
      });
      return { focusMins, breakMins };
    };

    if (statsMode === 'daily') {
      return calcForSchedule(schedule);
    } else {
      let totalFocus = 0;
      let totalBreak = 0;
      days.forEach(d => {
        const s = generateSchedule(d);
        const { focusMins, breakMins } = calcForSchedule(s);
        totalFocus += focusMins;
        totalBreak += breakMins;
      });
      return { focusMins: totalFocus, breakMins: totalBreak };
    }
  }, [statsMode, schedule, days, startTime, endTime, focusGoal, peakWindow, shortBreak, longBreak, calendarEvents, manualAdjustment]);

  const goalDiff = useMemo(() => {
    if (statsMode !== 'daily') return null;
    const currentMins = stats.focusMins;
    const goalMins = focusGoal * 60;
    const diff = currentMins - goalMins;
    
    if (Math.abs(diff) < 15) return 'match';
    return diff < 0 ? 'under' : 'over';
  }, [stats.focusMins, focusGoal, statsMode]);

  const handleAdjustGoal = (direction: 'add' | 'reduce') => {
    const currentMins = stats.focusMins;
    const goalMins = focusGoal * 60;
    const diffMins = Math.abs(currentMins - goalMins);
    const diffHours = diffMins / 60;
    
    if (direction === 'add') {
      const adjustment = diffMins < 60 ? 1 : Math.ceil(diffHours + 0.5);
      
      setManualAdjustment(prev => ({
        ...prev,
        [activeDay.yyyymmdd]: (prev[activeDay.yyyymmdd] || 0) + adjustment
      }));

      setTimeout(() => {
        const firstNew = schedule.find(item => !completedSessions.has(item.id) && item.type === 'focus');
        if (firstNew) {
           const id = firstNew.id;
           setNewSessionIds(prev => new Set(prev).add(id));
           itemRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);

    } else {
      const reduction = Math.ceil(diffHours);
      setManualAdjustment(prev => ({
        ...prev,
        [activeDay.yyyymmdd]: (prev[activeDay.yyyymmdd] || 0) - reduction
      }));
    }
  };

  const handleSessionStart = (id: string) => {
    setActiveSessionId(id);
  };

  const handleSessionComplete = (id: string) => {
    setCompletedSessions(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    // Auto-play logic: find the next session and set it as active
    const currentIndex = schedule.findIndex(item => item.id === id);
    if (currentIndex !== -1 && currentIndex < schedule.length - 1) {
      setActiveSessionId(schedule[currentIndex + 1].id);
    } else {
      setActiveSessionId(null);
    }
  };

  const formatHours = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="space-y-8 lg:space-y-12 animate-in fade-in duration-500 pb-20">
      {/* Date Selector */}
      <div className="flex justify-center -mt-10">
        <div className="flex items-center space-x-3 lg:space-x-4 overflow-x-auto no-scrollbar pt-14 pb-6 px-4 w-full justify-center">
          {days.map((d, i) => (
            <button
              key={i}
              onClick={() => {
                setSelectedDayIndex(i);
                setStatsMode('daily');
                setActiveSessionId(null); // Reset active session when changing day
              }}
              className={`flex flex-col items-center justify-center min-w-[70px] lg:min-w-[90px] h-[80px] lg:h-[100px] rounded-3xl lg:rounded-[2.5rem] transition-all shadow-sm shrink-0 ${
                selectedDayIndex === i 
                  ? 'bg-black text-white scale-105 z-10 shadow-xl' 
                  : 'bg-white text-gray-400 border border-gray-50'
              }`}
            >
              <span className="text-[8px] lg:text-[10px] font-bold mb-1 uppercase tracking-widest">{d.day}</span>
              <span className="text-xl lg:text-2xl font-black">{d.date}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Summary Section */}
      <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 lg:p-10 shadow-sm border border-gray-50 flex flex-col space-y-6 lg:space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 lg:p-3 bg-[#ED6A45]/10 rounded-2xl text-[#ED6A45]">
              <BarChart3 size={24} />
            </div>
            <h3 className="text-xl lg:text-2xl font-black text-gray-900 tracking-tight">Performance Summary</h3>
          </div>
          
          <div className="flex bg-gray-100 p-1.5 rounded-2xl w-full sm:w-auto">
            <button 
              onClick={() => setStatsMode('daily')}
              className={`flex-1 sm:px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${statsMode === 'daily' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
            >
              Daily
            </button>
            <button 
              onClick={() => setStatsMode('weekly')}
              className={`flex-1 sm:px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${statsMode === 'weekly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
            >
              Weekly
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8">
          <div className="bg-[#ED6A45]/5 rounded-3xl p-6 lg:p-8 border border-[#ED6A45]/10 flex items-center space-x-6">
            <div className="w-12 h-12 lg:w-16 lg:h-16 bg-white rounded-full flex items-center justify-center shadow-sm text-[#ED6A45]">
              <Zap size={24} className="lg:w-8 lg:h-8" />
            </div>
            <div>
              <p className="text-[10px] lg:text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Focus</p>
              <p className="text-2xl lg:text-4xl font-black text-gray-900 leading-none">{formatHours(stats.focusMins)}</p>
            </div>
          </div>
          <div className="bg-green-50 rounded-3xl p-6 lg:p-8 border border-green-100 flex items-center space-x-6">
            <div className="w-12 h-12 lg:w-16 lg:h-16 bg-white rounded-full flex items-center justify-center shadow-sm text-green-600">
              <Coffee size={24} className="lg:w-8 lg:h-8" />
            </div>
            <div>
              <p className="text-[10px] lg:text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Breaks</p>
              <p className="text-2xl lg:text-4xl font-black text-gray-900 leading-none">{formatHours(stats.breakMins)}</p>
            </div>
          </div>
        </div>

        {statsMode === 'daily' && goalDiff && goalDiff !== 'match' && (
          <div className={`rounded-3xl p-6 lg:p-8 border flex flex-col sm:flex-row items-center justify-between gap-6 transition-all animate-in fade-in slide-in-from-top-2 duration-300 ${
            goalDiff === 'under' ? 'bg-orange-50 border-orange-100 text-orange-800' : 'bg-blue-50 border-blue-100 text-blue-800'
          }`}>
            <div className="flex items-center space-x-4 text-center sm:text-left">
              <div className={`p-3 rounded-2xl bg-white shadow-sm flex-shrink-0 ${goalDiff === 'under' ? 'text-orange-500' : 'text-blue-500'}`}>
                <AlertCircle size={24} />
              </div>
              <div className="space-y-1">
                <p className="font-black uppercase tracking-widest text-[10px] opacity-60">Goal Alignment</p>
                <p className="text-sm lg:text-base font-bold leading-tight">
                  {goalDiff === 'under' 
                    ? `You are ${formatHours(Math.abs(stats.focusMins - focusGoal * 60))} short of your daily goal. Add focus session to your ${peakWindow} peak window?`
                    : `Your schedule exceeds your goal by ${formatHours(stats.focusMins - focusGoal * 60)}. Reduce some focus sessions from your daily timeline?`}
                </p>
              </div>
            </div>
            <button 
              onClick={() => handleAdjustGoal(goalDiff === 'under' ? 'add' : 'reduce')}
              className={`px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center space-x-2 whitespace-nowrap ${
                goalDiff === 'under' ? 'bg-[#ED6A45] text-white hover:bg-[#d55e3c]' : 'bg-black text-white hover:bg-gray-800'
              }`}
            >
              {goalDiff === 'under' ? <PlusCircle size={18} /> : <MinusCircle size={18} />}
              <span>{goalDiff === 'under' ? 'Add Focus' : 'Reduce Focus'}</span>
            </button>
          </div>
        )}
      </div>

      <div className="space-y-1 lg:space-y-2 text-center md:text-left">
        <p className="text-[#ED6A45] font-bold text-[10px] lg:text-sm uppercase tracking-[0.2em]">{activeDay.day} TIMELINE</p>
        <h2 className="text-2xl lg:text-4xl font-black text-gray-900 tracking-tight">{activeDay.fullDateString}</h2>
      </div>

      <div className="space-y-6 lg:space-y-8">
        {schedule.length > 0 ? schedule.map((item) => {
          const isDone = completedSessions.has(item.id);
          const isNewlyAdded = newSessionIds.has(item.id);
          const isActive = activeSessionId === item.id;
          return (
            <div 
              key={item.id} 
              ref={el => { itemRefs.current[item.id] = el; }}
              className={`flex flex-col md:flex-row items-stretch md:items-start space-y-2 md:space-y-0 md:space-x-6 lg:space-x-10 group transition-all duration-300 ${isDone ? 'opacity-50 grayscale-[0.2]' : ''} ${isNewlyAdded ? 'ring-4 ring-[#ED6A45]/20 rounded-3xl' : ''} ${isActive ? 'bg-[#ED6A45]/5 rounded-[2.5rem]' : ''}`}
            >
              <div className="w-full md:w-16 md:pt-6 flex-shrink-0">
                <span className={`text-gray-400 font-bold tabular-nums text-base lg:text-lg block text-center md:text-left ${isDone ? 'line-through' : ''}`}>{item.startTime}</span>
              </div>

              <div className="flex-1">
                {['break', 'wellness', 'lunch', 'hobby'].includes(item.type) ? (
                  <div className={`bg-white border-2 border-dashed border-[#ED6A45]/30 rounded-3xl lg:rounded-[2.5rem] p-5 sm:p-6 lg:p-8 flex items-center space-x-4 lg:space-x-6 hover:border-[#ED6A45]/60 transition-colors ${isDone ? 'scale-[0.98]' : ''}`}>
                    <div className="w-10 h-10 lg:w-14 lg:h-14 bg-[#ED6A45]/10 rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
                      <Coffee className="text-[#ED6A45]" size={20} />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className={`text-gray-900 text-lg sm:text-xl lg:text-2xl font-black tracking-tight truncate ${isDone ? 'line-through' : ''}`}>{item.label}</span>
                      <span className="text-gray-400 font-bold text-[10px] sm:text-xs lg:text-sm uppercase tracking-wider">{item.duration} min rest period</span>
                    </div>
                    <SessionTimer 
                      id={item.id}
                      duration={item.duration} 
                      type={item.type} 
                      isCompleted={isDone} 
                      isActive={isActive}
                      isMuted={isMuted} 
                      onStart={() => handleSessionStart(item.id)}
                      onComplete={() => handleSessionComplete(item.id)} 
                    />
                  </div>
                ) : (
                  <div className={`${item.color || 'bg-white'} rounded-3xl lg:rounded-[2.5rem] p-6 lg:p-10 flex flex-col justify-center shadow-sm border border-white/50 min-h-[120px] lg:min-h-[160px] transition-all hover:shadow-xl hover:-translate-y-1 ${isDone ? 'scale-[0.98]' : ''}`}>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between space-y-4 sm:space-y-0">
                      <div className="flex flex-col space-y-2 lg:space-y-4 flex-1">
                        <div className="flex items-center space-x-3">
                          <span className="text-[8px] lg:text-[10px] font-black text-gray-400 uppercase tracking-widest bg-white/60 px-3 lg:px-4 py-1 lg:py-2 rounded-full shadow-xs whitespace-nowrap">
                            {item.type}
                          </span>
                          <span className="text-gray-500 font-bold text-xs lg:text-sm">
                            {item.startTime} Start
                          </span>
                        </div>
                        <h3 className={`text-gray-900 text-xl lg:text-3xl font-black tracking-tight leading-tight max-w-2xl ${isDone ? 'line-through' : ''}`}>
                          {item.label}
                        </h3>
                      </div>
                      
                      <SessionTimer 
                        id={item.id}
                        duration={item.duration} 
                        type={item.type} 
                        isCompleted={isDone} 
                        isActive={isActive}
                        isMuted={isMuted} 
                        onStart={() => handleSessionStart(item.id)}
                        onComplete={() => handleSessionComplete(item.id)} 
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        }) : (
          <div className="text-center py-16 lg:py-32 bg-white rounded-3xl lg:rounded-[3rem] border border-dashed border-gray-100 flex flex-col items-center">
            <div className="p-4 lg:p-6 bg-gray-50 rounded-full mb-4 lg:mb-6 text-gray-200"><Calendar size={48} /></div>
            <p className="text-gray-300 font-bold text-lg lg:text-xl">No tasks generated for this window.</p>
            <p className="text-gray-400 text-[10px] lg:text-sm mt-2 font-medium uppercase tracking-widest">Adjust your settings in Home</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardView;
