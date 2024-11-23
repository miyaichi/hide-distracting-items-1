// src/sidepanel/components/Controls.tsx
import React from 'react';

interface ControlsProps {
  isSelectionMode: boolean;
  onToggleSelectionMode: (enabled: boolean) => void;
  onClearAll: () => void;
}

export const Controls: React.FC<ControlsProps> = ({
  isSelectionMode,
  onToggleSelectionMode,
  onClearAll,
}) => {
  return (
    <div className="p-4 border-b">
      <div className="flex items-center justify-between mb-4">
        <button
          className={`px-4 py-2 rounded transition-colors duration-200 ${
            isSelectionMode
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-gray-200 hover:bg-gray-300'
          }`}
          onClick={() => onToggleSelectionMode(!isSelectionMode)}
        >
          {isSelectionMode ? 'Exit Selection Mode' : 'Start Selection Mode'}
        </button>
        <button
          className="px-4 py-2 bg-red-100 text-red-500 rounded hover:bg-red-200 transition-colors duration-200"
          onClick={onClearAll}
        >
          Clear All
        </button>
      </div>
    </div>
  );
};
