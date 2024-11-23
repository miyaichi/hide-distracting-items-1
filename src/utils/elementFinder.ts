// src/utils/elementFinder.ts
import { ElementIdentifier } from '../types/types';

export class ElementFinder {
  static getElementIdentifier(element: Element): ElementIdentifier {
    return {
      domPath: ElementFinder.getDomPath(element),
      tagName: element.tagName.toLowerCase(),
      classNames: Array.from(element.classList),
      id: element.id || undefined,
      textContent: element.textContent || undefined,
    };
  }

  private static getDomPath(element: Element): string {
    const path: string[] = [];
    let currentElement: Element | null = element;

    while (currentElement && currentElement !== document.body) {
      let selector = currentElement.nodeName.toLowerCase();
      if (currentElement.id) {
        selector += `#${currentElement.id}`;
      } else {
        const siblings = currentElement.parentNode?.children;
        if (siblings) {
          let index = Array.from(siblings).indexOf(currentElement) + 1;
          if (siblings.length > 1) {
            selector += `:nth-child(${index})`;
          }
        }
      }
      path.unshift(selector);
      currentElement = currentElement.parentElement;
    }

    return path.join(' > ');
  }
}
