
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Coffee, ChevronLeft, Calendar, Play, Pause, RotateCcw, Timer as TimerIcon, CheckCircle2 } from 'lucide-react';
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
  type: 'focus' | 'meeting' | 'break' | 'wellness' | 'lunch' | 'hobby';
  label: string;
  startTime: string; // HH:mm
  duration: number; // in minutes
  color?: string;
}

const IST_TIMEZONE = 'Asia/Kolkata';
const ALARM_SOUND_URL = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg';

const SessionTimer: React.FC<{ 
  duration: number; 
  type: string; 
  isCompleted: boolean;
  onComplete: () => void;
}> = ({ duration, type, isCompleted, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState(isCompleted ? 0 : duration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(ALARM_SOUND_URL);
  }, []);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      
      // Natural finish
      if (timeLeft === 0 && isRunning && !isCompleted) {
        setIsRunning(false);
        if (audioRef.current) {
          audioRef.current.play().catch(e => console.log("Audio play failed", e));
        }
        onComplete();
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, timeLeft, isCompleted, onComplete]);

  // Sync state if external completion happens
  useEffect(() => {
    if (isCompleted) {
      setTimeLeft(0);
      setIsRunning(false);
    }
  }, [isCompleted]);

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
          onClick={() => { setTimeLeft(duration * 60); onComplete(); /* This toggle logic in parent handles unstriking */ }}
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
          onClick={() => setIsRunning(!isRunning)}
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
  startTime, endTime, focusGoal, peakWindow, calendarEvents, onBack 
}) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [completedSessions, setCompletedSessions] = useState<Set<string>>(new Set());

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

  const handleSessionComplete = (id: string) => {
    setCompletedSessions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const schedule = useMemo(() => {
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
      .filter(e => e.date === activeDay.yyyymmdd)
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
    let focusRemaining = focusGoal * 60;
    let lastType: string | null = null;
    let hasLongBreakAnchor = false;

    const peakRanges: Record<string, [number, number]> = {
      'Morning': [480, 720], 'Afternoon': [720, 1020], 'Evening': [1020, 1260], 'Late Night': [1260, 1440]
    };
    const [peakStart, peakEnd] = peakRanges[peakWindow] || [480, 720];
    const eventColors = ['bg-[#A9C5D3]', 'bg-[#FADCD5]', 'bg-[#D9CCE8]', 'bg-[#F5D5B8]'];
    let colorIdx = 0;

    const isBreakType = (t: string) => ['break', 'hobby', 'lunch', 'wellness'].includes(t);

    const addSession = (type: ScheduleItem['type'], label: string, duration: number, color?: string) => {
      if (duration <= 0) return;
      items.push({
        id: `${activeDay.yyyymmdd}-${type}-${currentTime}`, // Unique per day and time
        type, label, duration, color: color || eventColors[colorIdx++ % eventColors.length],
        startTime: formatTime(currentTime)
      });
      currentTime += duration;
      lastType = type;
    };

    while (currentTime < dayEndMins) {
      if (currentTime >= 780 && currentTime < 840 && !hasLongBreakAnchor) {
        if (!isBreakType(lastType || '')) {
          addSession('break', 'Lunch Break', 60);
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
          const breakDur = Math.min(gap >= 45 ? 45 : 15, gap);
          addSession('break', breakDur >= 45 ? 'Wellness Break' : 'Short break', breakDur);
        } 
        else {
          const inPeak = currentTime >= peakStart && currentTime < peakEnd;
          let focusDur = Math.min(inPeak ? 90 : 45, gap);
          
          if (focusRemaining > 0) {
            focusDur = Math.min(focusDur, focusRemaining);
            addSession('focus', inPeak ? 'Peak Focus Session' : 'Standard Focus', focusDur, 'bg-white');
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
  }, [startTime, endTime, focusGoal, peakWindow, calendarEvents, activeDay]);

  return (
    <div className="space-y-8 lg:space-y-12">
      {/* Date Selector */}
      <div className="flex justify-center -mt-8">
        <div className="flex items-center space-x-3 lg:space-x-4 overflow-x-auto no-scrollbar pt-10 pb-4 px-4 w-full justify-center">
          {days.map((d, i) => (
            <button
              key={i}
              onClick={() => setSelectedDayIndex(i)}
              className={`flex flex-col items-center justify-center min-w-[70px] lg:min-w-[90px] h-[80px] lg:h-[100px] rounded-3xl lg:rounded-[2.5rem] transition-all shadow-sm ${
                selectedDayIndex === i 
                  ? 'bg-black text-white scale-105 z-10' 
                  : 'bg-white text-gray-400 border border-gray-50'
              }`}
            >
              <span className="text-[8px] lg:text-[10px] font-bold mb-1 uppercase tracking-widest">{d.day}</span>
              <span className="text-xl lg:text-2xl font-black">{d.date}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="space-y-1 lg:space-y-2 text-center md:text-left">
        <p className="text-[#ED6A45] font-bold text-[10px] lg:text-sm uppercase tracking-[0.2em]">{activeDay.day} SUMMARY</p>
        <h2 className="text-2xl lg:text-4xl font-black text-gray-900 tracking-tight">{activeDay.fullDateString}</h2>
      </div>

      {/* Timeline List */}
      <div className="space-y-6 lg:space-y-8">
        {schedule.length > 0 ? schedule.map((item) => {
          const isDone = completedSessions.has(item.id);
          return (
            <div key={item.id} className={`flex flex-col md:flex-row items-stretch md:items-start space-y-2 md:space-y-0 md:space-x-6 lg:space-x-10 group transition-all duration-300 ${isDone ? 'opacity-50 grayscale-[0.2]' : ''}`}>
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
                    <SessionTimer duration={item.duration} type={item.type} isCompleted={isDone} onComplete={() => handleSessionComplete(item.id)} />
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
                      
                      <SessionTimer duration={item.duration} type={item.type} isCompleted={isDone} onComplete={() => handleSessionComplete(item.id)} />
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
