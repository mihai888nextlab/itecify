'use client';

import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { EditorView } from '@codemirror/view';

export type AICopilotStatus = 'idle' | 'thinking' | 'suggesting' | 'done';

export interface Position {
  line: number;
  ch: number;
}

export interface Suggestion {
  id: string;
  code: string;
  from: number;
  to: number;
  type: 'refactor' | 'optimize' | 'fix' | 'explain';
  intent: string;
}

export interface AICopilotState {
  isEnabled: boolean;
  status: AICopilotStatus;
  intent: string;
  suggestion: Suggestion | null;
  cursorPosition: Position | null;
  isTyping: boolean;
  projectId: string | null;
}

type AICopilotAction =
  | { type: 'ENABLE'; projectId: string }
  | { type: 'DISABLE' }
  | { type: 'SET_STATUS'; status: AICopilotStatus }
  | { type: 'SET_INTENT'; intent: string }
  | { type: 'SET_SUGGESTION'; suggestion: Suggestion | null }
  | { type: 'SET_CURSOR_POSITION'; position: Position | null }
  | { type: 'SET_TYPING'; isTyping: boolean }
  | { type: 'RESET' };

const initialState: AICopilotState = {
  isEnabled: false,
  status: 'idle',
  intent: '',
  suggestion: null,
  cursorPosition: null,
  isTyping: false,
  projectId: null,
};

function aICopilotReducer(state: AICopilotState, action: AICopilotAction): AICopilotState {
  switch (action.type) {
    case 'ENABLE':
      return { ...state, isEnabled: true, projectId: action.projectId, status: 'idle', intent: '', suggestion: null };
    case 'DISABLE':
      return { ...state, isEnabled: false, status: 'idle', intent: '', suggestion: null, cursorPosition: null };
    case 'SET_STATUS':
      return { ...state, status: action.status };
    case 'SET_INTENT':
      return { ...state, intent: action.intent };
    case 'SET_SUGGESTION':
      return { ...state, suggestion: action.suggestion, status: action.suggestion ? 'suggesting' : 'idle' };
    case 'SET_CURSOR_POSITION':
      return { ...state, cursorPosition: action.position };
    case 'SET_TYPING':
      return { ...state, isTyping: action.isTyping };
    case 'RESET':
      return { ...initialState, isEnabled: state.isEnabled, projectId: state.projectId };
    default:
      return state;
  }
}

interface AICopilotContextValue {
  state: AICopilotState;
  enable: (projectId: string) => void;
  disable: () => void;
  setTyping: (isTyping: boolean) => void;
  setIntent: (intent: string) => void;
  setSuggestion: (suggestion: Suggestion | null) => void;
  setCursorPosition: (position: Position | null) => void;
  acceptSuggestion: () => void;
  rejectSuggestion: () => void;
  modifySuggestion: (code: string) => void;
  registerEditorView: (view: EditorView | null) => void;
  triggerSuggest: () => Promise<void>;
  onAccept: (callback: () => void) => void;
  onReject: (callback: () => void) => void;
}

const AICopilotContext = createContext<AICopilotContextValue | null>(null);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function AICopilotProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(aICopilotReducer, initialState);
  const editorViewRef = useRef<EditorView | null>(null);
  const acceptCallbackRef = useRef<(() => void) | null>(null);
  const rejectCallbackRef = useRef<(() => void) | null>(null);
  const lastKeystrokeRef = useRef<number>(0);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const enable = useCallback((projectId: string) => {
    dispatch({ type: 'ENABLE', projectId });
  }, []);

  const disable = useCallback(() => {
    dispatch({ type: 'DISABLE' });
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
  }, []);

  const setTyping = useCallback((isTyping: boolean) => {
    dispatch({ type: 'SET_TYPING', isTyping });
    lastKeystrokeRef.current = Date.now();
  }, []);

  const setIntent = useCallback((intent: string) => {
    dispatch({ type: 'SET_INTENT', intent });
  }, []);

  const setSuggestion = useCallback((suggestion: Suggestion | null) => {
    dispatch({ type: 'SET_SUGGESTION', suggestion });
  }, []);

  const setCursorPosition = useCallback((position: Position | null) => {
    dispatch({ type: 'SET_CURSOR_POSITION', position });
  }, []);

  const acceptSuggestion = useCallback(() => {
    if (state.suggestion) {
      if (acceptCallbackRef.current) {
        acceptCallbackRef.current();
      }
      dispatch({ type: 'SET_SUGGESTION', suggestion: null });
      dispatch({ type: 'SET_INTENT', intent: '' });
    }
  }, [state.suggestion]);

  const rejectSuggestion = useCallback(() => {
    if (state.suggestion) {
      if (rejectCallbackRef.current) {
        rejectCallbackRef.current();
      }
      dispatch({ type: 'SET_SUGGESTION', suggestion: null });
      dispatch({ type: 'SET_INTENT', intent: '' });
    }
  }, [state.suggestion]);

  const modifySuggestion = useCallback((code: string) => {
    if (state.suggestion) {
      dispatch({
        type: 'SET_SUGGESTION',
        suggestion: { ...state.suggestion, code },
      });
    }
  }, [state.suggestion]);

  const registerEditorView = useCallback((view: EditorView | null) => {
    editorViewRef.current = view;
  }, []);

  const onAccept = useCallback((callback: () => void) => {
    acceptCallbackRef.current = callback;
  }, []);

  const onReject = useCallback((callback: () => void) => {
    rejectCallbackRef.current = callback;
  }, []);

  const triggerSuggest = useCallback(async () => {
    if (!state.isEnabled || !state.projectId || !editorViewRef.current) return;

    const view = editorViewRef.current;
    const doc = view.state.doc.toString();
    const cursor = view.state.selection.main.head;
    const line = doc.slice(0, cursor).split('\n').length;
    const ch = cursor - doc.slice(0, cursor).lastIndexOf('\n') - 1;

    dispatch({ type: 'SET_STATUS', status: 'thinking' });
    dispatch({ type: 'SET_INTENT', intent: 'Analyzing code...' });
    dispatch({ type: 'SET_CURSOR_POSITION', position: { line, ch } });

    try {
      const res = await fetch(`${API_URL}/api/ai/copilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: state.projectId,
          code: doc,
          cursorPosition: { line, ch },
          language: 'javascript',
        }),
      });

      if (!res.ok) throw new Error('AI request failed');

      const data = await res.json();

      if (data.suggestion) {
        dispatch({
          type: 'SET_SUGGESTION',
          suggestion: {
            id: `suggestion-${Date.now()}`,
            code: data.suggestion.code,
            from: data.suggestion.from || cursor,
            to: data.suggestion.to || cursor,
            type: data.suggestion.type || 'refactor',
            intent: data.intent || 'Suggested improvement',
          },
        });
        dispatch({ type: 'SET_INTENT', intent: data.intent || 'Suggestion ready' });
      } else {
        dispatch({ type: 'SET_STATUS', status: 'idle' });
        dispatch({ type: 'SET_INTENT', intent: '' });
      }
    } catch (error) {
      console.error('[AI Copilot] Suggestion error:', error);
      dispatch({ type: 'SET_STATUS', status: 'idle' });
      dispatch({ type: 'SET_INTENT', intent: '' });
    }
  }, [state.isEnabled, state.projectId]);

  useEffect(() => {
    if (!state.isEnabled || state.status !== 'idle') return;

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      const timeSinceLastKeystroke = Date.now() - lastKeystrokeRef.current;
      if (timeSinceLastKeystroke >= 1500) {
        triggerSuggest();
      }
    }, 1500);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [state.isEnabled, state.status, triggerSuggest]);

  const value: AICopilotContextValue = {
    state,
    enable,
    disable,
    setTyping,
    setIntent,
    setSuggestion,
    setCursorPosition,
    acceptSuggestion,
    rejectSuggestion,
    modifySuggestion,
    registerEditorView,
    triggerSuggest,
    onAccept,
    onReject,
  };

  return (
    <AICopilotContext.Provider value={value}>
      {children}
    </AICopilotContext.Provider>
  );
}

export function useAICopilot() {
  const context = useContext(AICopilotContext);
  if (!context) {
    throw new Error('useAICopilot must be used within AICopilotProvider');
  }
  return context;
}
