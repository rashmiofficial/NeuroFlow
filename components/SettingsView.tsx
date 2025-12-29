
import React from 'react';
import { Coffee, Moon, Volume2, VolumeX, LogOut, Save, ShieldCheck } from 'lucide-react';

interface SettingsViewProps {
  shortBreak: number;
  setShortBreak: (v: number) => void;
  longBreak: number;
  setLongBreak: (v: number) => void;
  isMuted: boolean;
  setIsMuted: (v: boolean) => void;
  isDirty: boolean;
  onSave: () => void;
  onLogout: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({
  shortBreak, setShortBreak,
  longBreak, setLongBreak,
  isMuted, setIsMuted,
  isDirty, onSave, onLogout
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 lg:space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl lg:text-3xl font-black text-gray-900 tracking-tight">System Settings</h2>
        <button 
          onClick={onSave}
          disabled={!isDirty}
          className={`flex items-center space-x-2 px-8 py-4 rounded-2xl font-bold transition-all shadow-lg active:scale-95 ${
            isDirty 
              ? 'bg-black text-white hover:bg-gray-800' 
              : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
          }`}
        >
          <Save size={20} />
          <span>Save Changes</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
        {/* Short Break Setting */}
        <section className="bg-white rounded-[2.5rem] p-8 lg:p-10 shadow-sm border border-gray-50 space-y-6">
          <div className="flex items-center space-x-3 text-[#ED6A45]">
            <Coffee size={24} />
            <h3 className="text-lg font-black uppercase tracking-widest">Short Break</h3>
          </div>
          <p className="text-sm text-gray-400 font-medium">Interval duration for quick recovery sessions between focus blocks.</p>
          <div className="bg-[#FDF8F5] rounded-3xl p-6 flex flex-col space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Duration</span>
              <span className="text-3xl font-black text-gray-900">{shortBreak}<span className="text-sm ml-1 text-gray-400">min</span></span>
            </div>
            <input 
              type="range" min="5" max="10" step="1" value={shortBreak}
              onChange={(e) => setShortBreak(parseInt(e.target.value))}
              className="w-full accent-[#ED6A45] h-2 bg-gray-200 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-bold text-gray-300 uppercase tracking-widest">
              <span>5 min</span>
              <span>10 min</span>
            </div>
          </div>
        </section>

        {/* Long Break Setting */}
        <section className="bg-white rounded-[2.5rem] p-8 lg:p-10 shadow-sm border border-gray-50 space-y-6">
          <div className="flex items-center space-x-3 text-[#ED6A45]">
            <Moon size={24} />
            <h3 className="text-lg font-black uppercase tracking-widest">Long Break</h3>
          </div>
          <p className="text-sm text-gray-400 font-medium">Extended recovery period, typically used for lunch or deep decompression.</p>
          <div className="bg-[#FDF8F5] rounded-3xl p-6 flex flex-col space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Duration</span>
              <span className="text-3xl font-black text-gray-900">{longBreak}<span className="text-sm ml-1 text-gray-400">min</span></span>
            </div>
            <input 
              type="range" min="30" max="60" step="5" value={longBreak}
              onChange={(e) => setLongBreak(parseInt(e.target.value))}
              className="w-full accent-[#ED6A45] h-2 bg-gray-200 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-bold text-gray-300 uppercase tracking-widest">
              <span>30 min</span>
              <span>60 min</span>
            </div>
          </div>
        </section>

        {/* Notification Setting */}
        <section className="bg-white rounded-[2.5rem] p-8 lg:p-10 shadow-sm border border-gray-50 space-y-6">
          <div className="flex items-center space-x-3 text-[#ED6A45]">
            {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            <h3 className="text-lg font-black uppercase tracking-widest">Alerts</h3>
          </div>
          <p className="text-sm text-gray-400 font-medium">Control the sound notification when a session timer reaches zero.</p>
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`w-full flex items-center justify-between p-6 rounded-3xl transition-all border-2 ${
              isMuted 
                ? 'bg-gray-50 border-gray-100' 
                : 'bg-[#ED6A45]/5 border-[#ED6A45]/20'
            }`}
          >
            <div className="flex flex-col items-start">
              <span className={`text-base font-black ${isMuted ? 'text-gray-400' : 'text-[#ED6A45]'}`}>
                {isMuted ? 'Notifications Muted' : 'Sound Alerts Enabled'}
              </span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                Toggle System Audio
              </span>
            </div>
            <div className={`w-14 h-8 rounded-full relative transition-all ${isMuted ? 'bg-gray-200' : 'bg-[#ED6A45]'}`}>
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all ${isMuted ? 'left-1' : 'left-7'}`}></div>
            </div>
          </button>
        </section>

        {/* Account Setting */}
        <section className="bg-white rounded-[2.5rem] p-8 lg:p-10 shadow-sm border border-gray-50 space-y-6">
          <div className="flex items-center space-x-3 text-gray-900">
            <ShieldCheck size={24} />
            <h3 className="text-lg font-black uppercase tracking-widest">Security</h3>
          </div>
          <p className="text-sm text-gray-400 font-medium">Manage your session and local storage data synchronization.</p>
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center space-x-3 p-6 rounded-3xl bg-red-50 text-red-500 font-black border-2 border-red-100 hover:bg-red-100 transition-all active:scale-95 group"
          >
            <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="uppercase tracking-widest text-sm">Log out from device</span>
          </button>
        </section>
      </div>
    </div>
  );
};

export default SettingsView;
