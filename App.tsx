
import React, { useState, useRef, useEffect } from 'react';
import { 
  Home, BarChart2, MessageSquare, User, CreditCard, Calendar, Settings, LogOut, 
  Search, Sliders, ChevronDown, Bell 
} from 'lucide-react';
import HomeView from './components/HomeView';
import DashboardView from './components/DashboardView';
import SettingsView from './components/SettingsView';

export interface CalendarEvent {
  summary: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  durationMinutes: number;
  date: string;      // YYYYMMDD
}

const DB_NAME = 'FocusPlannerDB';
const STORE_NAME = 'calendars';
const USER_KEY = 'default_user';
const SETTINGS_KEY = 'user_settings';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveCalendarToDB = async (events: CalendarEvent[]) => {
  const db = await initDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  transaction.objectStore(STORE_NAME).put(events, USER_KEY);
};

const loadCalendarFromDB = async (): Promise<CalendarEvent[] | null> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(USER_KEY);
    request.onsuccess = () => resolve(request.result || null);
  });
};

const saveSettingsToDB = async (settings: any) => {
  const db = await initDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  transaction.objectStore(STORE_NAME).put(settings, SETTINGS_KEY);
};

const loadSettingsFromDB = async (): Promise<any | null> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(SETTINGS_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
};

const deleteCalendarFromDB = async () => {
  const db = await initDB();
  db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(USER_KEY);
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'dashboard' | 'statistics' | 'messages' | 'billings' | 'settings'>('home');
  
  const [startTime, setStartTime] = useState({ hour: '08', minute: '00', period: 'AM' });
  const [endTime, setEndTime] = useState({ hour: '06', minute: '00', period: 'PM' });
  const [focusGoal, setFocusGoal] = useState(7);
  const [peakWindow, setPeakWindow] = useState('Morning');
  
  // New Settings
  const [shortBreak, setShortBreak] = useState(5);
  const [longBreak, setLongBreak] = useState(30);
  const [isMuted, setIsMuted] = useState(false);

  const [allEvents, setAllEvents] = useState<CalendarEvent[] | null>(null);
  const [lastSaved, setLastSaved] = useState<any>(null);
  const [isCalendarDirty, setIsCalendarDirty] = useState(false);

  useEffect(() => {
    loadCalendarFromDB().then(stored => { 
      if (stored) setAllEvents(stored); 
    });
    const fetchSettings = async () => {
      const stored = await loadSettingsFromDB();
      if (stored) {
        setStartTime(stored.startTime || { hour: '08', minute: '00', period: 'AM' });
        setEndTime(stored.endTime || { hour: '06', minute: '00', period: 'PM' });
        setFocusGoal(stored.focusGoal || 7);
        setPeakWindow(stored.peakWindow || 'Morning');
        setShortBreak(stored.shortBreak || 5);
        setLongBreak(stored.longBreak || 30);
        setIsMuted(stored.isMuted || false);
        setLastSaved(stored);
      } else {
        const initial = { startTime, endTime, focusGoal, peakWindow, shortBreak, longBreak, isMuted };
        setLastSaved(initial);
      }
    };
    fetchSettings();
  }, []);

  const isSettingsDirty = lastSaved ? (
    JSON.stringify(lastSaved.startTime) !== JSON.stringify(startTime) ||
    JSON.stringify(lastSaved.endTime) !== JSON.stringify(endTime) ||
    lastSaved.focusGoal !== focusGoal ||
    lastSaved.peakWindow !== peakWindow ||
    lastSaved.shortBreak !== shortBreak ||
    lastSaved.longBreak !== longBreak ||
    lastSaved.isMuted !== isMuted ||
    isCalendarDirty
  ) : false;

  const handleSaveAll = async () => {
    const settings = { startTime, endTime, focusGoal, peakWindow, shortBreak, longBreak, isMuted };
    await saveSettingsToDB(settings);
    if (allEvents) {
      await saveCalendarToDB(allEvents);
    } else {
      await deleteCalendarFromDB();
    }
    setLastSaved(settings);
    setIsCalendarDirty(false);
  };

  const handleLogout = () => {
    // Simple reset for demo
    window.location.reload();
  };

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'billings', label: 'Billings', icon: CreditCard },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleEventsParsed = (events: CalendarEvent[]) => {
    setAllEvents(events);
    setIsCalendarDirty(true);
  };

  const handleClearCalendar = () => {
    setAllEvents(null);
    setIsCalendarDirty(true);
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-white overflow-x-hidden">
      {/* Navigation Bar */}
      <aside className="fixed bottom-0 left-0 w-full lg:static lg:w-64 border-t lg:border-t-0 lg:border-r border-gray-100 bg-white lg:bg-transparent flex flex-row lg:flex-col p-2 lg:p-8 items-center lg:items-stretch z-50 overflow-x-auto no-scrollbar lg:overflow-visible">
        <div className="hidden lg:flex items-center space-x-2 px-2 lg:mb-12">
          <div className="grid grid-cols-2 gap-1 flex-shrink-0">
            <div className="w-3 h-3 bg-black rounded-sm"></div>
            <div className="w-3 h-3 bg-black rounded-sm"></div>
            <div className="w-3 h-3 bg-black rounded-sm"></div>
            <div className="w-3 h-3 bg-black rounded-sm"></div>
          </div>
        </div>

        <nav className="flex flex-row lg:flex-col flex-1 space-x-1 lg:space-x-0 lg:space-y-2 justify-around lg:justify-start w-full lg:w-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`flex flex-col lg:flex-row items-center lg:space-x-4 px-3 py-2 lg:px-4 lg:py-3 rounded-xl transition-all whitespace-nowrap ${
                  isActive ? 'text-[#ED6A45] font-semibold bg-[#ED6A45]/5 lg:bg-transparent' : 'text-gray-400 hover:bg-gray-50'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-[#ED6A45]' : 'text-gray-400'} />
                <span className="text-[10px] lg:text-base lg:inline mt-1 lg:mt-0">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <button 
          onClick={handleLogout}
          className="hidden lg:flex items-center space-x-4 px-4 py-3 text-gray-400 hover:text-red-500 transition-colors mt-auto whitespace-nowrap"
        >
          <LogOut size={20} />
          <span className="hidden lg:inline">Log out</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-[#FDF8F5] m-2 lg:m-4 rounded-2xl lg:rounded-[3rem] p-4 sm:p-6 lg:p-10 mb-20 lg:mb-4 overflow-y-auto no-scrollbar relative">
        <header className="flex flex-col md:flex-row items-center justify-between mb-6 lg:mb-10 space-y-4 md:space-y-0">
          <div className="space-y-1 text-center md:text-left">
            <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Good Morning, Harvey!</h2>
          </div>

          <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4 lg:space-x-8 w-full md:w-auto">
            <div className="relative w-full sm:w-64 lg:w-96 group order-2 sm:order-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#ED6A45] transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search here" 
                className="w-full bg-white rounded-full py-3 pl-12 pr-12 border-none shadow-sm focus:ring-2 focus:ring-[#ED6A45]/20 outline-none text-sm"
              />
              <Sliders className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            </div>

            <div className="flex items-center space-x-4 order-1 sm:order-2">
              <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-[#ED6A45] overflow-hidden border-2 border-white shadow-sm">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Harvey" alt="User Avatar" />
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-gray-900 text-sm lg:text-base">Harvey Specter</span>
                <ChevronDown size={16} className="text-gray-400" />
              </div>
            </div>
          </div>
        </header>

        <div className="w-full">
          {activeTab === 'home' && (
            <HomeView 
              startTime={startTime} setStartTime={setStartTime}
              endTime={endTime} setEndTime={setEndTime}
              focusGoal={focusGoal} setFocusGoal={setFocusGoal}
              peakWindow={peakWindow} setPeakWindow={setPeakWindow}
              allEvents={allEvents} onEventsParsed={handleEventsParsed}
              onClearSync={handleClearCalendar}
              onDashboard={() => setActiveTab('dashboard')}
              onSaveSettings={handleSaveAll}
              isDirty={isSettingsDirty}
            />
          )}

          {activeTab === 'dashboard' && (
            <DashboardView 
              startTime={startTime}
              endTime={endTime}
              focusGoal={focusGoal}
              peakWindow={peakWindow}
              shortBreak={shortBreak}
              longBreak={longBreak}
              isMuted={isMuted}
              calendarEvents={allEvents || []}
              onBack={() => setActiveTab('home')}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView 
              shortBreak={shortBreak} setShortBreak={setShortBreak}
              longBreak={longBreak} setLongBreak={setLongBreak}
              isMuted={isMuted} setIsMuted={setIsMuted}
              isDirty={isSettingsDirty}
              onSave={handleSaveAll}
              onLogout={handleLogout}
            />
          )}

          {activeTab !== 'home' && activeTab !== 'dashboard' && activeTab !== 'settings' && (
            <div className="flex flex-col items-center justify-center h-[50vh] text-gray-300">
              <BarChart2 size={64} className="opacity-20 mb-4" />
              <p className="text-lg lg:text-xl font-bold">Content under development</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
