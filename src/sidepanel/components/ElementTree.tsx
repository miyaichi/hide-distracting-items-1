// src/sidepanel/components/ElementTree.tsx
import React from 'react';
import { ElementIdentifier } from '../../types/types';

interface ElementTreeProps {
  elements: ElementIdentifier[];
  onRemoveElement: (element: ElementIdentifier) => void;
}

export const ElementTree: React.FC<ElementTreeProps> = ({ elements, onRemoveElement }) => {
  if (elements.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-center">
        No elements hidden yet. Use selection mode to hide elements.
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">Hidden Elements</h2>
      <div className="space-y-2">
        {elements.map((element, index) => (
          <div
            key={`${element.domPath}-${index}`}
            className="flex items-center justify-between p-2 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200"
          >
            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm truncate" title={element.domPath}>
                {element.domPath}
              </div>
              <div className="text-xs text-gray-500">
                {element.tagName}
                {element.id && ` #${element.id}`}
                {element.classNames.length > 0 && ` .${element.classNames.join('.')}`}
              </div>
            </div>
            <button
              onClick={() => onRemoveElement(element)}
              className="ml-2 p-1 text-red-500 hover:bg-red-100 rounded"
              title="Remove element"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
