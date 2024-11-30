import { ArrowDown, ArrowUp, Eye, EyeOff, RotateCcw } from 'lucide-react';
import React, { useState } from 'react';
import { ElementIdentifier } from '../../types/types';
import { Tooltip } from './Tooltip';

interface HiddenElementListProps {
  elements: ElementIdentifier[];
  onRemoveElement: (element: ElementIdentifier) => void;
  onNavigateToParent?: (element: ElementIdentifier) => void;
  onNavigateToChild?: (element: ElementIdentifier, childIndex: number) => void;
  onHighlightElement?: (element: ElementIdentifier | null) => void;
  onToggleHideElement?: (element: ElementIdentifier) => void;
}

export const HiddenElementList: React.FC<HiddenElementListProps> = ({
  elements,
  onRemoveElement,
  onNavigateToParent,
  onNavigateToChild,
  onHighlightElement,
  onToggleHideElement,
}) => {
  const [selectedElement, setSelectedElement] = useState<ElementIdentifier | null>(null);

  const handleElementClick = (element: ElementIdentifier) => {
    const isSelected = selectedElement?.domPath === element.domPath;
    const newSelection = isSelected ? null : element;
    setSelectedElement(newSelection);
    if (onHighlightElement) {
      onHighlightElement(newSelection);
    }
  };

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
      <div className="text-center text-gray-500 p-2">
        No elements hidden yet. Use selection mode to hide elements.
      </div>
    );
  }

  return (
    <div className="px-2">
      <h2 className="text-lg font-semibold mb-2 px-1">Hidden Elements</h2>
      <div className="space-y-1">
        {elements.map((element, index) => {
          const isSelected = selectedElement?.domPath === element.domPath;
          return (
            <div
              key={`${element.domPath}-${index}`}
              className={`p-2 bg-gray-50 rounded-lg border transition-colors duration-200 cursor-pointer
                ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
              onClick={() => handleElementClick(element)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm truncate" title={element.domPath}>
                    {element.domPath}
                  </div>
                  <div className="text-xs text-gray-500">{formatElementInfo(element)}</div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Tooltip content={isSelected ? 'Hide element' : 'Show element'}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleHideElement && onToggleHideElement(element);
                      }}
                      className={`p-1 rounded transition-colors duration-200 
                        ${isSelected ? 'text-blue-600 hover:bg-blue-100' : 'text-gray-500 hover:bg-gray-200'}`}
                    >
                      {isSelected ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </Tooltip>
                  <Tooltip content="Navigate to parent">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToParent && onNavigateToParent(element);
                      }}
                      className={`p-1 rounded transition-colors duration-200 
                        ${isSelected ? 'text-blue-600 hover:bg-blue-100' : 'text-gray-500 hover:bg-gray-200'}`}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                  </Tooltip>
                  {element.children && element.children.length > 0 && (
                    <Tooltip content="Navigate to children">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToChild && onNavigateToChild(element, 0);
                        }}
                        className={`p-1 rounded transition-colors duration-200 
                          ${isSelected ? 'text-blue-600 hover:bg-blue-100' : 'text-gray-500 hover:bg-gray-200'}`}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </Tooltip>
                  )}
                  <Tooltip content="Unhide element">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveElement(element);
                      }}
                      className="p-1 text-blue-500 hover:bg-blue-50 rounded transition-colors duration-200"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
