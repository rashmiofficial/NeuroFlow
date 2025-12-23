
import React from 'react';

interface EnergyWindowProps {
  selected: string;
  onSelect: (window: string) => void;
}

const windows = ['Morning', 'Afternoon', 'Evening', 'Late Night'];

const EnergyWindow: React.FC<EnergyWindowProps> = ({ selected, onSelect }) => {
  return (
    <div className="flex flex-wrap gap-4">
      {windows.map((window) => (
        <button
          key={window}
          onClick={() => onSelect(window)}
          className={`px-6 py-4 rounded-full text-base font-medium transition-all duration-200 shadow-sm ${
            selected === window
              ? 'bg-[#ED6A45] text-white shadow-[#ED6A45]/30 shadow-lg scale-105'
              : 'bg-white text-[#ED6A45] border border-gray-50 hover:bg-gray-50'
          }`}
        >
          {window}
        </button>
      ))}
    </div>
  );
};

export default EnergyWindow;
