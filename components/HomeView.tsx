import React, { useRef, useMemo } from 'react';
import { LogIn, LogOut, Clock, Zap, Calendar, ArrowRight, RefreshCw, Trash2, ArrowUpRight, Save } from 'lucide-react';
import TimePicker from './TimePicker';
import EnergyWindow from './EnergyWindow';
import { CalendarEvent } from '../App';

interface HomeViewProps {
  startTime: any; setStartTime: any;
  endTime: any; setEndTime: any;
  focusGoal: number; setFocusGoal: any;
  peakWindow: string; setPeakWindow: any;
  allEvents: CalendarEvent[] | null;
  onEventsParsed: (events: CalendarEvent[]) => void;
  onClearSync: () => void;
  onDashboard: () => void;
  onSaveSettings: () => void;
  isDirty: boolean;
}

const HomeView: React.FC<HomeViewProps> = ({
  startTime, setStartTime, endTime, setEndTime,
  focusGoal, setFocusGoal, peakWindow, setPeakWindow,
  allEvents, onEventsParsed, onClearSync, onDashboard,
  onSaveSettings, isDirty
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    if (!allEvents) return { total: 0, pending: 0, completed: 0, priority: 0 };
    return {
      total: allEvents.length,
      pending: Math.floor(allEvents.length * 0.7),
      completed: Math.floor(allEvents.length * 0.3),
      priority: Math.floor(allEvents.length * 0.2)
    };
  }, [allEvents]);

  // Calendar Logic
  const calendarData = useMemo(() => {
    const now = new Date();
    const month = now.toLocaleString('default', { month: 'long' });
    const year = now.getFullYear();
    const today = now.getDate();
    const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate();
    const firstDay = new Date(year, now.getMonth(), 1).getDay();
    // Adjust for Monday start: 0=Mon, 1=Tue... 6=Sun
    const padding = firstDay === 0 ? 6 : firstDay - 1;
    
    return { month, year, today, daysInMonth, padding };
  }, []);

  const parseICS = (icsData: string): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    const lines = icsData.split(/\r?\n/);
    let currentEvent: any = null;

    const parseDate = (val: string): Date => {
      const cleanVal = val.includes(':') ? val.split(':')[1] : val;
      const year = parseInt(cleanVal.substring(0, 4));
      const month = parseInt(cleanVal.substring(4, 6)) - 1;
      const day = parseInt(cleanVal.substring(6, 8));
      const hour = parseInt(cleanVal.substring(9, 11)) || 0;
      const min = parseInt(cleanVal.substring(11, 13)) || 0;
      const sec = parseInt(cleanVal.substring(13, 15)) || 0;
      
      if (cleanVal.endsWith('Z')) {
        return new Date(Date.UTC(year, month, day, hour, min, sec));
      }
      return new Date(year, month, day, hour, min, sec);
    };

    const formatDateStr = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    };

    const formatTimeStr = (d: Date) => {
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${hours}:${mins}`;
    };

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      while (i + 1 < lines.length && (lines[i+1].startsWith(' ') || lines[i+1].startsWith('\t'))) {
        line += lines[++i].substring(1);
      }

      if (line === 'BEGIN:VEVENT') {
        currentEvent = {};
      } else if (line === 'END:VEVENT') {
        if (currentEvent.dtstart) {
          const start = parseDate(currentEvent.dtstart);
          const end = currentEvent.dtend ? parseDate(currentEvent.dtend) : new Date(start.getTime() + 30 * 60000);
          const duration = (end.getTime() - start.getTime()) / (1000 * 60);
          const summary = currentEvent.summary || 'Untitled Event';
          
          if (currentEvent.rrule) {
            const rrule = currentEvent.rrule;
            const freqMatch = rrule.match(/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/);
            if (freqMatch) {
              const freq = freqMatch[1];
              for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
                const occurrenceStart = new Date(start.getTime() + dayOffset * 24 * 60 * 60 * 1000);
                const occurrenceEnd = new Date(end.getTime() + dayOffset * 24 * 60 * 60 * 1000);
                
                let shouldAdd = false;
                if (freq === 'DAILY') {
                  shouldAdd = true;
                } else if (freq === 'WEEKLY') {
                  if (occurrenceStart.getDay() === start.getDay()) shouldAdd = true;
                }
                
                if (shouldAdd) {
                  events.push({
                    summary,
                    startTime: formatTimeStr(occurrenceStart),
                    endTime: formatTimeStr(occurrenceEnd),
                    durationMinutes: duration,
                    date: formatDateStr(occurrenceStart)
                  });
                }
              }
            }
          } else {
            events.push({
              summary,
              startTime: formatTimeStr(start),
              endTime: formatTimeStr(end),
              durationMinutes: duration,
              date: formatDateStr(start)
            });
          }
        }
        currentEvent = null;
      } else if (currentEvent) {
        if (line.startsWith('SUMMARY:')) currentEvent.summary = line.substring(8);
        else if (line.startsWith('DTSTART')) currentEvent.dtstart = line;
        else if (line.startsWith('DTEND')) currentEvent.dtend = line;
        else if (line.startsWith('RRULE:')) currentEvent.rrule = line.substring(6);
      }
    }
    return events;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsedEvents = parseICS(content);
      if (parsedEvents.length > 0) {
        onEventsParsed(parsedEvents);
      } else {
        console.error("No events found in .ics file");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
      {/* Left Column: My Tasks & Setup */}
      <div className="col-span-1 lg:col-span-8 space-y-6 lg:space-y-8">
        <section>
          <div className="flex justify-between items-center mb-4 lg:mb-6">
            <h3 className="text-lg lg:text-xl font-bold text-gray-900">My Tasks</h3>
            <button className="text-xs lg:text-sm font-semibold text-gray-400 flex items-center space-x-1">
              <span>{calendarData.month}</span>
              <ArrowRight size={14} className="rotate-90" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
            <div className="bg-[#FADCD5] rounded-3xl lg:rounded-[2.5rem] p-6 lg:p-8 relative overflow-hidden group hover:shadow-xl transition-all border border-white/40 min-h-[140px]">
              <ArrowUpRight className="absolute top-6 right-6 lg:top-8 lg:right-8 text-black" size={24} />
              <div className="mt-6 lg:mt-8 space-y-2">
                <h4 className="text-xl lg:text-2xl font-bold text-gray-900">Priority Tasks</h4>
                <p className="text-sm lg:text-base text-gray-600 font-medium">{stats.priority}/37 Completed</p>
              </div>
            </div>
            <div className="bg-[#F2F2F2] rounded-3xl lg:rounded-[2.5rem] p-6 lg:p-8 relative group hover:shadow-xl transition-all border border-white/40 min-h-[140px]">
              <ArrowUpRight className="absolute top-6 right-6 lg:top-8 lg:right-8 text-black" size={24} />
              <div className="mt-6 lg:mt-8 space-y-2">
                <h4 className="text-xl lg:text-2xl font-bold text-gray-900">Upcoming Tasks</h4>
                <p className="text-sm lg:text-base text-gray-600 font-medium">{stats.total}/48 Completed</p>
              </div>
            </div>
            <div className="bg-[#F2F2F2] rounded-3xl lg:rounded-[2.5rem] p-6 lg:p-8 relative group hover:shadow-xl transition-all border border-white/40 min-h-[140px]">
              <ArrowUpRight className="absolute top-6 right-6 lg:top-8 lg:right-8 text-black" size={24} />
              <div className="mt-6 lg:mt-8 space-y-2">
                <h4 className="text-xl lg:text-2xl font-bold text-gray-900">Overdue Tasks</h4>
                <p className="text-sm lg:text-base text-gray-600 font-medium">11/19 Completed</p>
              </div>
            </div>
            <div className="bg-[#FADCD5] rounded-3xl lg:rounded-[2.5rem] p-6 lg:p-8 relative group hover:shadow-xl transition-all border border-white/40 min-h-[140px]">
              <ArrowUpRight className="absolute top-6 right-6 lg:top-8 lg:right-8 text-black" size={24} />
              <div className="mt-6 lg:mt-8 space-y-2">
                <h4 className="text-xl lg:text-2xl font-bold text-gray-900">Pending Tasks</h4>
                <p className="text-sm lg:text-base text-gray-600 font-medium">{stats.pending}/28 Completed</p>
              </div>
            </div>
          </div>
        </section>

        {/* Setup Controls */}
        <section className="bg-white rounded-3xl lg:rounded-[3rem] p-6 lg:p-10 shadow-sm border border-gray-50 space-y-8 lg:space-y-10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
            <h3 className="text-base lg:text-lg font-black text-gray-900 uppercase tracking-widest">Setup Controls</h3>
            <button 
              onClick={onSaveSettings}
              disabled={!isDirty}
              className={`flex items-center space-x-2 px-6 py-3 rounded-2xl font-bold transition-all shadow-sm w-full sm:w-auto justify-center ${
                isDirty 
                  ? 'bg-black text-white hover:bg-gray-800' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Save size={18} />
              <span>Save Settings</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-[#ED6A45] font-bold text-xs uppercase tracking-widest">
                <LogIn size={16} /> <span>Daily Start</span>
              </div>
              <TimePicker value={startTime} onChange={setStartTime} />
            </div>
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-[#ED6A45] font-bold text-xs uppercase tracking-widest">
                <LogOut size={16} /> <span>Daily End</span>
              </div>
              <TimePicker value={endTime} onChange={setEndTime} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-[#ED6A45] font-bold text-xs uppercase tracking-widest">
              <Clock size={16} /> <span>Daily Focus Goal</span>
            </div>
            <div className="bg-[#FDF8F5] rounded-3xl p-4 lg:p-6 flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-8">
              <input 
                type="range" min="1" max="12" value={focusGoal}
                onChange={(e) => setFocusGoal(parseInt(e.target.value))}
                className="w-full sm:flex-1 accent-[#ED6A45]"
              />
              <span className="text-2xl lg:text-3xl font-bold text-gray-800">{focusGoal}h</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-[#ED6A45] font-bold text-xs uppercase tracking-widest">
              <Zap size={16} /> <span>Peak Energy Window</span>
            </div>
            <EnergyWindow selected={peakWindow} onSelect={setPeakWindow} />
          </div>

          <div className="pt-4 space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <input 
                type="file" ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".ics" className="hidden" 
              />
              {allEvents ? (
                <>
                  <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-white border border-[#FADCD5] rounded-2xl py-4 flex items-center justify-center space-x-2 text-[#8E6043] font-bold hover:bg-gray-50 transition-all shadow-sm">
                    <RefreshCw size={18} className="text-[#ED6A45]" />
                    <span>Update Calendar</span>
                  </button>
                  <button onClick={onClearSync} className="flex-1 bg-white border border-red-100 rounded-2xl py-4 flex items-center justify-center space-x-2 text-red-500 font-bold hover:bg-red-50 transition-all shadow-sm">
                    <Trash2 size={18} />
                    <span>Clear Storage</span>
                  </button>
                </>
              ) : (
                <button onClick={() => fileInputRef.current?.click()} className="w-full bg-[#ED6A45]/5 border-2 border-dashed border-[#ED6A45]/20 rounded-2xl py-8 flex items-center justify-center space-x-3 text-[#ED6A45] font-bold hover:bg-[#ED6A45]/10 transition-all">
                  <Calendar size={20} />
                  <span>Sync your calendar</span>
                </button>
              )}
            </div>

            {/* Repositioned Open Dashboard CTA */}
            <button 
              onClick={onDashboard}
              disabled={isDirty}
              className={`w-full rounded-3xl lg:rounded-[2rem] py-6 lg:py-8 flex items-center justify-center space-x-3 transition-all shadow-xl active:scale-[0.99] group ${
                !isDirty 
                  ? 'bg-black text-white hover:opacity-90' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
              }`}
            >
              <span className="text-lg lg:text-xl font-bold tracking-tight uppercase">Open Dashboard</span>
              {!isDirty && <ArrowRight className="group-hover:translate-x-2 transition-transform" size={24} />}
            </button>
          </div>
        </section>

        {/* Task Progress Placeholder */}
        <section>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg lg:text-xl font-bold text-gray-900">Tasks Progress</h3>
            <button className="text-sm font-semibold text-gray-400 flex items-center space-x-1">
              <span>{calendarData.month}</span>
              <ArrowRight size={14} className="rotate-90" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
            <div className="bg-white p-6 lg:p-8 rounded-3xl lg:rounded-[2.5rem] shadow-sm border border-gray-50 space-y-4">
              <h4 className="font-bold text-base lg:text-lg text-gray-800">Web Development</h4>
              <p className="text-[10px] lg:text-xs text-gray-400 font-medium">Deadline: 3rd September, {calendarData.year}</p>
              <div className="space-y-2 pt-2">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#ED6A45] w-[34%]"></div>
                </div>
                <div className="flex justify-end"><span className="text-[10px] font-bold text-gray-400">34% Completed</span></div>
              </div>
            </div>
            <div className="bg-white p-6 lg:p-8 rounded-3xl lg:rounded-[2.5rem] shadow-sm border border-gray-50 space-y-4">
              <h4 className="font-bold text-base lg:text-lg text-gray-800">Mobile App Design</h4>
              <p className="text-[10px] lg:text-xs text-gray-400 font-medium">Deadline: 29th August, {calendarData.year}</p>
              <div className="space-y-2 pt-2">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gray-800 w-[55%]"></div>
                </div>
                <div className="flex justify-end"><span className="text-[10px] font-bold text-gray-400">55% Completed</span></div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Right Column: Messages, Calendar */}
      <div className="col-span-1 lg:col-span-4 space-y-6 lg:space-y-8">
        <section className="bg-white rounded-3xl lg:rounded-[3rem] p-6 lg:p-10 shadow-sm border border-gray-50 h-fit">
          <h3 className="text-lg lg:text-xl font-bold text-gray-900 mb-6 lg:mb-8 text-center sm:text-left">Client Messages</h3>
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-blue-100 overflow-hidden flex-shrink-0">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Donna" alt="Donna" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-sm lg:text-base text-gray-800 truncate">Donna Paulsen</span>
                  <span className="text-[10px] text-gray-400 ml-2 whitespace-nowrap">02:48 pm</span>
                </div>
                <p className="text-xs text-gray-400 truncate">Project meeting scheduled for tomorrow...</p>
              </div>
            </div>
            <div className="flex items-center space-x-4 bg-black p-4 rounded-3xl -mx-4 shadow-xl">
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-pink-100 overflow-hidden flex-shrink-0">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Jessica" alt="Jessica" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-sm lg:text-base text-white truncate">Jessica Pearson</span>
                  <span className="text-[10px] text-gray-500 ml-2 whitespace-nowrap">11:14 am</span>
                </div>
                <p className="text-xs text-gray-400 truncate">Great news! The development phase...</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-green-100 overflow-hidden flex-shrink-0">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Mike" alt="Mike" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-sm lg:text-base text-gray-800 truncate">Mike Ross</span>
                  <span className="text-[10px] text-gray-400 ml-2 whitespace-nowrap">30th Aug</span>
                </div>
                <p className="text-xs text-gray-400 truncate">Client feedback incorporated...</p>
              </div>
            </div>
          </div>
        </section>

        {/* Small Calendar Widget - Dynamic */}
        <section className="bg-[#ED6A45] rounded-3xl lg:rounded-[3rem] p-6 lg:p-8 text-white shadow-xl shadow-[#ED6A45]/20">
          <div className="flex justify-between items-center mb-6 px-2">
            <h3 className="font-bold text-base lg:text-lg">Calendar</h3>
            <span className="text-xs font-medium opacity-80">{calendarData.month}, {calendarData.year}</span>
          </div>
          <div className="grid grid-cols-7 gap-y-2 lg:gap-y-4 text-center">
            {['M','T','W','T','F','S','S'].map(d => <span key={d} className="text-[10px] font-bold opacity-60">{d}</span>)}
            {/* Empty slots for month start padding */}
            {Array.from({length: calendarData.padding}).map((_, i) => (
              <div key={`pad-${i}`} className="h-8 lg:h-10"></div>
            ))}
            {/* Real days */}
            {Array.from({length: calendarData.daysInMonth}, (_, i) => {
              const d = i + 1;
              const isToday = d === calendarData.today;
              // Keep some aesthetic "planned" indicators similar to original design
              const isPlanned = d === 22 || d === 19 || d === 5;
              return (
                <div key={d} className="flex items-center justify-center h-8 lg:h-10">
                  <span className={`text-[10px] lg:text-xs font-bold w-6 h-6 lg:w-8 lg:h-8 flex items-center justify-center rounded-full transition-all cursor-pointer ${
                    isToday ? 'bg-black text-white' : 
                    isPlanned ? 'bg-blue-100/20 text-blue-100' :
                    ''
                  }`}>
                    {d}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

export default HomeView;