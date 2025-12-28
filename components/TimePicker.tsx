
import React from 'react';

interface TimeValue {
  hour: string;
  minute: string;
  period: string;
}

interface TimePickerProps {
  value: TimeValue;
  onChange: (value: TimeValue) => void;
}

const TimePicker: React.FC<TimePickerProps> = ({ value, onChange }) => {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center space-x-3">
        {/* Hour Input */}
        <input 
          type="text" 
          value={value.hour}
          onChange={(e) => onChange({ ...value, hour: e.target.value })}
          className="w-12 h-12 lg:w-16 lg:h-16 bg-white rounded-2xl text-center text-lg lg:text-xl font-medium text-gray-600 shadow-sm outline-none focus:ring-2 focus:ring-[#ED6A45]/20"
        />
        
        <span className="text-gray-300 font-bold">:</span>

        {/* Minute Input */}
        <input 
          type="text" 
          value={value.minute}
          onChange={(e) => onChange({ ...value, minute: e.target.value })}
          className="w-12 h-12 lg:w-16 lg:h-16 bg-white rounded-2xl text-center text-lg lg:text-xl font-medium text-gray-600 shadow-sm outline-none focus:ring-2 focus:ring-[#ED6A45]/20"
        />
      </div>

      <div className="flex space-x-1">
        {['AM', 'PM'].map((p) => (
          <button
            key={p}
            onClick={() => onChange({ ...value, period: p })}
            className={`w-10 h-10 lg:w-14 lg:h-14 rounded-full flex items-center justify-center text-xs lg:text-sm font-semibold transition-all duration-200 ${
              value.period === p 
                ? 'bg-[#ED6A45] text-white shadow-md' 
                : 'bg-white text-blue-200/50 hover:bg-gray-50'
            }`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TimePicker;
