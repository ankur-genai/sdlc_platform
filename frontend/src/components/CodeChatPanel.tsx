import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, Loader2, Sparkles, AlertTriangle, Monitor, Server } from 'lucide-react';
import { apiRequest } from '../lib/api';

type ChatTarget = 'frontend' | 'backend';

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant' | 'error';
  text: string;
  target?: ChatTarget;
  changedFiles?: string[];
}

interface ModifyResponse {
  target: ChatTarget;
  summary: string;
  changed_files: string[];
  file_count: number;
}

interface CodeChatPanelProps {
  projectId: string;
  hasFrontend: boolean;
  hasBackend: boolean;
  /** Called after a successful modification so the parent can reload artifacts/preview. */
  onCodeChanged: () => void | Promise<void>;
}

/**
 * Chat panel for the Development Studio. Lets the user change the generated
 * code through natural-language queries — each message is applied by the
 * backend (`POST /projects/{id}/code/modify`) to the frontend (`react_code`)
 * or backend (`backend_code`) artifact, and the parent reloads so the file
 * tree and live preview reflect the change.
 */
export function CodeChatPanel({ projectId, hasFrontend, hasBackend, onCodeChanged }: CodeChatPanelProps) {
  const [target, setTarget] = useState<ChatTarget>(hasFrontend ? 'frontend' : 'backend');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const idRef = useRef(0);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // If only one target has code, keep the toggle on it.
    if (!hasFrontend && hasBackend) setTarget('backend');
    else if (hasFrontend && !hasBackend) setTarget('frontend');
  }, [hasFrontend, hasBackend]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  const nextId = () => { idRef.current += 1; return idRef.current; };

  const send = useCallback(async () => {
    const instruction = input.trim();
    if (!instruction || sending) return;

    setMessages((prev) => [...prev, { id: nextId(), role: 'user', text: instruction, target }]);
    setInput('');
    setSending(true);
    try {
      const res = await apiRequest<ModifyResponse>(`/projects/${projectId}/code/modify`, {
        method: 'POST',
        body: { target, instruction },
      });
      setMessages((prev) => [...prev, {
        id: nextId(),
        role: 'assistant',
        text: res.summary || 'Applied the requested changes.',
        target: res.target,
        changedFiles: res.changed_files || [],
      }]);
      await onCodeChanged();
    } catch (e) {
      setMessages((prev) => [...prev, {
        id: nextId(),
        role: 'error',
        text: e instanceof Error ? e.message : 'Failed to apply the change.',
      }]);
    } finally {
      setSending(false);
    }
  }, [input, sending, target, projectId, onCodeChanged]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const noCode = !hasFrontend && !hasBackend;

  return (
    <div className="flex flex-col h-[420px]">
      {/* Target toggle */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setTarget('frontend')}
          disabled={!hasFrontend}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            target === 'frontend' ? 'border-ey-yellow bg-ey-yellow/10 text-ey-yellow' : 'border-dark-border text-text-secondary hover:border-dark-border-light'
          }`}
        >
          <Monitor className="h-3.5 w-3.5" /> Frontend
        </button>
        <button
          onClick={() => setTarget('backend')}
          disabled={!hasBackend}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            target === 'backend' ? 'border-ey-yellow bg-ey-yellow/10 text-ey-yellow' : 'border-dark-border text-text-secondary hover:border-dark-border-light'
          }`}
        >
          <Server className="h-3.5 w-3.5" /> Backend
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto rounded-lg border border-dark-border bg-dark-bg p-3 space-y-3">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <MessageSquare className="h-8 w-8 text-dark-border-light mb-2" />
            <p className="text-xs text-text-muted">
              {noCode
                ? 'Generate code with the Frontend/Backend agents first, then ask for changes here.'
                : 'Ask for a change — e.g. "Add a dark mode toggle to the header" or "Add an email field to the login form".'}
            </p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                  m.role === 'user'
                    ? 'bg-ey-yellow/10 text-text-primary border border-ey-yellow/30'
                    : m.role === 'error'
                    ? 'bg-status-error/5 text-status-error border border-status-error/20'
                    : 'bg-dark-card text-text-secondary border border-dark-border'
                }`}
              >
                {m.role === 'assistant' && (
                  <div className="flex items-center gap-1.5 mb-1 text-status-success">
                    <Sparkles className="h-3 w-3" />
                    <span className="text-[10px] font-medium uppercase tracking-wide">{m.target} updated</span>
                  </div>
                )}
                {m.role === 'error' && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="h-3 w-3" />
                    <span className="text-[10px] font-medium uppercase tracking-wide">Failed</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                {m.changedFiles && m.changedFiles.length > 0 && (
                  <div className="mt-2 space-y-0.5 border-t border-dark-border pt-2">
                    {m.changedFiles.map((f) => (
                      <p key={f} className="font-mono text-[10px] text-text-muted truncate">{f}</p>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-lg bg-dark-card border border-dark-border px-3 py-2 text-xs text-text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-ey-yellow" />
              Applying change to {target}…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={noCode || sending}
          rows={2}
          placeholder={noCode ? 'No generated code yet…' : `Describe a change to the ${target} code…`}
          className="flex-1 resize-none rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-ey-yellow/50 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={noCode || sending || !input.trim()}
          className="btn-primary text-sm h-9 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Send (Enter)"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
