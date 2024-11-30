import React, { useEffect, useRef, useState } from 'react';

interface TooltipProps {
  /** The content to be displayed inside the tooltip */
  content: string;
  /** The children elements that will trigger the tooltip on hover */
  children: React.ReactNode;
  /** Optional classes to apply to the tooltip container */
  className?: string;
}

/**
 * Tooltip component that displays a tooltip with the given content when the user hovers over the children elements
 * @param content - The content to be displayed inside the tooltip
 * @param children - The children elements that will trigger the tooltip on hover
 * @param className - Optional classes to apply to the tooltip container
 * @returns A React element representing the tooltip
 */
export const Tooltip = ({ content, children, className = '' }: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updatePosition = () => {
      if (tooltipRef.current && targetRef.current) {
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const targetRect = targetRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;

        // Calc position
        let left = targetRect.left;
        let top = targetRect.bottom + 5;

        // Check and adjust position
        if (left + tooltipRect.width > viewportWidth - 10) {
          left = viewportWidth - tooltipRect.width - 10;
        }
        if (left < 10) {
          left = 10;
        }

        tooltipRef.current.style.left = `${left}px`;
        tooltipRef.current.style.top = `${top}px`;
      }
    };

    if (isVisible) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      return () => window.removeEventListener('resize', updatePosition);
    }
  }, [isVisible]);

  return (
    <div
      ref={targetRef}
      className={`inline-block ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className="fixed z-50 px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg pointer-events-none
            whitespace-nowrap transition-opacity duration-150 opacity-90"
        >
          {content}
        </div>
      )}
    </div>
  );
};
