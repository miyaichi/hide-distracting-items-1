// src/types/types.ts
export interface ElementIdentifier {
  domPath: string;
  tagName: string;
  classNames: string[];
  id?: string;
  textContent?: string;
}

export interface DomainSettings {
  hiddenElements: ElementIdentifier[];
  enabled: boolean;
}
