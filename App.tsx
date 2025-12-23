
import React, { useState, useRef, useEffect } from 'react';
import { LogIn, LogOut, Clock, Zap, Calendar, ArrowRight, RefreshCw, Trash2, Bell, ChevronLeft } from 'lucide-react';
import TimePicker from './components/TimePicker';
import EnergyWindow from './components/EnergyWindow';
import DashboardView from './components/DashboardView';

export interface CalendarEvent {
  summary: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  durationMinutes: number;
  date: string;      // YYYYMMDD
}

// Timezone Utility for New Delhi (IST: UTC+5:30)
const IST_TIMEZONE = 'Asia/Kolkata';

const getISTDateParts = (date: Date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(date);
  const findPart = (type: string) => parts.find(p => p.type === type)?.value || '';
  
  return {
    year: findPart('year'),
    month: findPart('month'),
    day: findPart('day'),
    hour: findPart('hour'),
    minute: findPart('minute'),
    yyyymmdd: `${findPart('year')}${findPart('month')}${findPart('day')}`
  };
};

// IndexedDB Utility
const DB_NAME = 'FocusPlannerDB';
const STORE_NAME = 'calendars';
const USER_KEY = 'default_user';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveCalendar = async (events: CalendarEvent[]) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(events, USER_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const loadCalendar = async (): Promise<CalendarEvent[] | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(USER_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

const deleteCalendarFromDB = async () => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(USER_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const formatTo12h = (time24: string) => {
  const [h, m] = time24.split(':');
  let hours = parseInt(h);
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, '0')}:${m} ${period}`;
};

const App: React.FC = () => {
  const [view, setView] = useState<'setup' | 'dashboard'>('setup');
  const [startTime, setStartTime] = useState({ hour: '08', minute: '00', period: 'AM' });
  const [endTime, setEndTime] = useState({ hour: '06', minute: '00', period: 'PM' });
  const [focusGoal, setFocusGoal] = useState(7);
  const [peakWindow, setPeakWindow] = useState('Morning');
  const [allEvents, setAllEvents] = useState<CalendarEvent[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const hydrate = async () => {
      const stored = await loadCalendar();
      if (stored) {
        setAllEvents(stored);
      }
    };
    hydrate();
  }, []);

  const parseICS = (data: string) => {
    const events: CalendarEvent[] = [];
    const unfoldedData = data.replace(/\r?\n[ \t]/g, '');
    const lines = unfoldedData.split(/\r?\n/);
    
    let currentEvent: any = null;

    for (let line of lines) {
      if (!line.trim()) continue;

      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const keyPart = line.substring(0, colonIndex);
      const value = line.substring(colonIndex + 1).trim();
      const baseKey = keyPart.split(';')[0].toUpperCase();

      if (baseKey === 'BEGIN' && value === 'VEVENT') {
        currentEvent = { summary: 'Unnamed Event', dtStart: '', dtEnd: '' };
      } else if (baseKey === 'END' && value === 'VEVENT') {
        if (currentEvent && currentEvent.dtStart) {
          const parseToISTDate = (val: string) => {
            const match = val.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
            if (!match) return null;
            
            const [_, y, mo, d, h, m, s, isUTC] = match;
            let dateObj: Date;
            
            if (h) {
              if (isUTC) {
                dateObj = new Date(Date.UTC(parseInt(y), parseInt(mo) - 1, parseInt(d), parseInt(h), parseInt(m), parseInt(s)));
              } else {
                dateObj = new Date(parseInt(y), parseInt(mo) - 1, parseInt(d), parseInt(h), parseInt(m), parseInt(s));
              }
            } else {
              dateObj = new Date(parseInt(y), parseInt(mo) - 1, parseInt(d));
            }
            
            return getISTDateParts(dateObj);
          };

          const startParts = parseToISTDate(currentEvent.dtStart);
          const endParts = currentEvent.dtEnd ? parseToISTDate(currentEvent.dtEnd) : null;

          if (startParts) {
            const startH = startParts.hour;
            const startM = startParts.minute;
            
            let endH = "23", endM = "59";
            if (endParts) {
              endH = endParts.hour;
              endM = endParts.minute;
            } else {
              const h = (parseInt(startH) + 1) % 24;
              endH = String(h).padStart(2, '0');
              endM = startM;
            }

            const startTotal = parseInt(startH) * 60 + parseInt(startM);
            let endTotal = parseInt(endH) * 60 + parseInt(endM);
            
            if (endParts && endParts.yyyymmdd !== startParts.yyyymmdd) {
              endTotal += 1440;
            }

            events.push({
              summary: currentEvent.summary,
              startTime: `${startH}:${startM}`,
              endTime: `${endH}:${endM}`,
              durationMinutes: Math.max(0, endTotal - startTotal) || 60,
              date: startParts.yyyymmdd
            });
          }
        }
        currentEvent = null;
      } else if (currentEvent) {
        if (baseKey === 'SUMMARY') {
          currentEvent.summary = value;
        } else if (baseKey === 'DTSTART') {
          currentEvent.dtStart = value;
        } else if (baseKey === 'DTEND') {
          currentEvent.dtEnd = value;
        }
      }
    }
    return events;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const parsedEvents = parseICS(content);
      setAllEvents(parsedEvents);
      await saveCalendar(parsedEvents);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClearCalendar = async () => {
    await deleteCalendarFromDB();
    setAllEvents(null);
  };

  const todayIST = getISTDateParts();
  const todaysEvents = allEvents?.filter(e => e.date === todayIST.yyyymmdd) || [];

  if (view === 'dashboard') {
    return (
      <DashboardView 
        startTime={startTime}
        endTime={endTime}
        focusGoal={focusGoal}
        peakWindow={peakWindow}
        calendarEvents={allEvents || []}
        onBack={() => setView('setup')}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-transparent space-y-8 py-10">
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".ics" className="hidden" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-[#ED6A45] font-semibold text-sm tracking-wide">
              <LogIn size={18} />
              <span>DAILY START</span>
            </div>
            <TimePicker value={startTime} onChange={setStartTime} />
          </div>
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-[#ED6A45] font-semibold text-sm tracking-wide">
              <LogOut size={18} />
              <span>DAILY END</span>
            </div>
            <TimePicker value={endTime} onChange={setEndTime} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-[#ED6A45] font-semibold text-sm tracking-wide">
            <Clock size={18} />
            <span>DAILY FOCUS GOAL</span>
          </div>
          <div className="bg-white rounded-3xl p-6 shadow-sm flex items-center space-x-6 border border-gray-50">
            <div className="flex-1 px-2">
              <input 
                type="range" min="1" max="12" value={focusGoal}
                onChange={(e) => setFocusGoal(parseInt(e.target.value))}
                className="w-full accent-[#ED6A45] appearance-none bg-transparent cursor-pointer"
              />
            </div>
            <span className="text-3xl font-medium text-gray-700 w-12 text-right">{focusGoal}h</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-[#ED6A45] font-semibold text-sm tracking-wide">
            <Zap size={18} />
            <span>PEAK ENERGY WINDOW</span>
          </div>
          <EnergyWindow selected={peakWindow} onSelect={setPeakWindow} />
        </div>

        {allEvents !== null && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-[#ED6A45] font-semibold text-sm tracking-wide">
                  <Calendar size={18} />
                  <span>PREVIEWING TODAY'S EVENTS (IST)</span>
                </div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter bg-gray-100 px-2 py-1 rounded-md">New Delhi Timezone</span>
              </div>
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-50 space-y-3 max-h-[350px] overflow-y-auto no-scrollbar">
                {todaysEvents.length > 0 ? (
                  todaysEvents.sort((a,b) => a.startTime.localeCompare(b.startTime)).map((event, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-[#FDF8F5] rounded-2xl border border-[#FADCD5]/30 group hover:border-[#ED6A45]/20 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-bold text-[#8E6043] group-hover:text-[#ED6A45] transition-colors">{event.summary}</span>
                        <span className="text-[10px] text-gray-400 font-medium">{event.durationMinutes} minutes</span>
                      </div>
                      <span className="text-xs font-bold text-[#ED6A45] bg-[#ED6A45]/10 px-4 py-1.5 rounded-full tabular-nums whitespace-nowrap">
                        {formatTo12h(event.startTime)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-gray-400 italic flex flex-col items-center gap-2">
                    <Calendar size={32} className="opacity-20" />
                    <span>No synced events for today (IST)</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-white border border-[#FADCD5] rounded-2xl py-5 flex items-center justify-center space-x-2 text-[#8E6043] font-bold hover:bg-gray-50 transition-all shadow-sm active:scale-[0.98]">
                <RefreshCw size={18} className="text-[#ED6A45]" />
                <span>Re-sync calendar</span>
              </button>
              <button onClick={handleClearCalendar} className="flex-1 bg-white border border-red-100 rounded-2xl py-5 flex items-center justify-center space-x-2 text-red-500 font-bold hover:bg-red-50 transition-all shadow-sm active:scale-[0.98]">
                <Trash2 size={18} />
                <span>Clear storage</span>
              </button>
            </div>
          </div>
        )}

        {allEvents === null && (
          <button onClick={() => fileInputRef.current?.click()} className="w-full bg-white border-2 border-dashed border-[#FADCD5] rounded-3xl p-10 flex flex-col items-center justify-center space-y-4 hover:bg-[#FEF8F6] transition-all group">
            <div className="p-4 bg-[#FEF1EE] border border-[#FADCD5] rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
              <Calendar className="text-[#ED6A45]" size={32} />
            </div>
            <div className="text-center">
              <span className="text-[#8E6043] font-bold text-xl block">Import your calendar</span>
              <span className="text-gray-400 text-sm">One-time sync for persistent multi-day planning</span>
            </div>
          </button>
        )}

        <button 
          onClick={() => setView('dashboard')}
          className="w-full bg-[#8E6043] text-white rounded-[2rem] py-8 flex items-center justify-center space-x-3 hover:opacity-90 transition-all shadow-2xl active:scale-[0.99] group mt-4"
        >
          <span className="text-2xl font-black tracking-tight uppercase">Unlock My Day</span>
          <ArrowRight className="group-hover:translate-x-2 transition-transform" size={32} />
        </button>
      </div>
    </div>
  );
};

export default App;
