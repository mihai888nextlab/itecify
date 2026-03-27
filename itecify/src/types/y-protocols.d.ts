declare module 'y-protocols/awareness' {
  export class Awareness {
    constructor(ydoc: any);
    clientID: number;
    getLocalState(): any;
    setLocalState(state: any): void;
    setLocalStateField(field: string, value: any): void;
    getStates(): Map<number, any>;
    on(event: string, callback: (args: any) => void): void;
    off(event: string, callback: (args: any) => void): void;
    destroy(): void;
  }
}
