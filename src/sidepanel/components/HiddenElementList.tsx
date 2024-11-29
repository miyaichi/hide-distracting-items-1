// src/sidepanel/components/HiddenElementList.tsx
import React from 'react';
import { ElementIdentifier } from '../../types/types';

interface HiddenElementListProps {
  elements: ElementIdentifier[];
  onRemoveElement: (element: ElementIdentifier) => void;
}

export const HiddenElementList: React.FC<HiddenElementListProps> = ({
  elements,
  onRemoveElement,
}) => {
  const formatElementInfo = (element: ElementIdentifier) => {
    const parts = [];
    parts.push(element.tagName);
    if (element.id) parts.push(`#${element.id}`);
    if (element.classNames.length > 0) {
      parts.push(element.classNames.map((cn) => `.${cn}`).join(''));
    }
    return parts.join('');
  };

  if (elements.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No elements hidden yet. Use selection mode to hide elements.
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Hidden Elements</h2>
      <div className="space-y-2">
        {elements.map((element, index) => (
          <div
            key={`${element.domPath}-${index}`}
            className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-500 transition-colors duration-200"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm truncate" title={element.domPath}>
                  {element.domPath}
                </div>
                <div className="text-xs text-gray-500 mt-1">{formatElementInfo(element)}</div>
              </div>
              <button
                onClick={() => onRemoveElement(element)}
                className="ml-2 p-1.5 text-red-500 hover:bg-red-50 rounded-full transition-colors duration-200"
                title="Remove element"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
