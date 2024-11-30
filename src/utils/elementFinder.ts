import { ElementIdentifier } from '../types/types';

export class ElementFinder {
  static getElementIdentifier(
    element: Element,
    includeChildren: boolean = true
  ): ElementIdentifier {
    const parentElement = element.parentElement;
    const parentPath = parentElement ? ElementFinder.getDomPath(parentElement) : undefined;

    const identifier: ElementIdentifier = {
      domPath: ElementFinder.getDomPath(element),
      tagName: element.tagName.toLowerCase(),
      classNames: Array.from(element.classList),
      id: element.id || undefined,
      textContent: element.textContent?.trim() || undefined,
      parentPath,
    };

    // if includeChildren is true, get children elements
    if (includeChildren) {
      const children = Array.from(element.children).map((child) =>
        // recursion prevention by passing false when getting child elements
        ElementFinder.getElementIdentifier(child, false)
      );

      if (children.length > 0) {
        identifier.children = children;
      }
    }

    return identifier;
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

  static findElementByIdentifier(identifier: ElementIdentifier): Element | null {
    try {
      const element = document.querySelector(identifier.domPath);
      if (element) {
        return element;
      }
    } catch (e) {
      console.debug('Failed to find element by domPath:', e);
    }

    // If not found by domPath, search by tagName, classNames, and ID
    const elements = document.getElementsByTagName(identifier.tagName);
    for (const el of Array.from(elements)) {
      if (
        identifier.classNames.every((className) => el.classList.contains(className)) &&
        (!identifier.id || el.id === identifier.id)
      ) {
        return el;
      }
    }

    return null;
  }
}
