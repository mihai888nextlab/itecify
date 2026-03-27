declare module 'y-codemirror' {
  import { Extension } from '@codemirror/state';
  import { Awareness } from 'y-protocols/awareness';

  export function yCollab(ydoc: any, awareness: Awareness): Extension;
}
