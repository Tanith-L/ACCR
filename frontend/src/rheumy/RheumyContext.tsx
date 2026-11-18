// The Rheumy conversation, shared by the floating button and the chat sheet. It lives in
// memory only: closing the sheet keeps it, closing the app (or "Clear chat") ends it.
// Nothing is written to the device.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import { askRheumy, RheumyError, type ChatTurn, type RheumyAnswer, type VoiceId } from './client';

export interface RheumyMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  answer?: RheumyAnswer;
  error?: boolean;
}

interface RheumyState {
  open: boolean;
  setOpen: (open: boolean) => void;
  messages: RheumyMessage[];
  busy: boolean;
  voice: VoiceId;
  setVoice: (voice: VoiceId) => void;
  send: (text: string) => void;
  clear: () => void;
  /** Height of the tab bar on screen (0 when there is none), so the button sits above it. */
  tabBarHeight: number;
  setTabBarHeight: (height: number) => void;
}

const RheumyContext = createContext<RheumyState | null>(null);

export function useRheumy(): RheumyState {
  const state = useContext(RheumyContext);
  if (!state) throw new Error('useRheumy must be used inside RheumyProvider');
  return state;
}

export function RheumyProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<RheumyMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [voice, setVoice] = useState<VoiceId>('ava');
  const [tabBarHeight, setTabBarHeight] = useState(0);
  const nextId = useRef(1);
  // Bumped by "Clear chat" so an answer still on its way isn't added to the new conversation.
  const generation = useRef(0);

  const send = useCallback(
    (text: string) => {
      const question = text.trim();
      if (!question || busy) return;
      const userMsg: RheumyMessage = { id: nextId.current++, role: 'user', text: question };
      const history: ChatTurn[] = [...messages, userMsg]
        .filter((m) => !m.error)
        .map((m) => ({ role: m.role, content: m.text }));
      const gen = generation.current;
      setMessages((prev) => [...prev, userMsg]);
      setBusy(true);
      askRheumy(history)
        .then((answer) => {
          if (gen !== generation.current) return;
          setMessages((prev) => [...prev, { id: nextId.current++, role: 'assistant', text: answer.answer, answer }]);
        })
        .catch((e: unknown) => {
          if (gen !== generation.current) return;
          const msg = e instanceof RheumyError ? e.message : 'Something went wrong. Please try again.';
          setMessages((prev) => [...prev, { id: nextId.current++, role: 'assistant', text: msg, error: true }]);
        })
        .finally(() => {
          if (gen === generation.current) setBusy(false);
        });
    },
    [busy, messages],
  );

  const clear = useCallback(() => {
    generation.current += 1;
    setMessages([]);
    setBusy(false);
  }, []);

  const value = useMemo(
    () => ({ open, setOpen, messages, busy, voice, setVoice, send, clear, tabBarHeight, setTabBarHeight }),
    [open, messages, busy, voice, send, clear, tabBarHeight],
  );
  return <RheumyContext.Provider value={value}>{children}</RheumyContext.Provider>;
}
