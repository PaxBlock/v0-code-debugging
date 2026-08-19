'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

const STORAGE_KEY = 'pax-chat-messages';
const MODEL_STORAGE_KEY = 'pax-chat-model';
const MODEL_OPTIONS = [
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  { id: 'gpt-5.6', label: 'GPT 5.6' },
];

// Load persisted messages from localStorage (client-side only, no database).
// This lets a user reload the page — or leave and come back on their phone —
// and still see their previous conversation with the assistant.
function loadPersistedMessages(): UIMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [model, setModel] = useState('claude-opus-4-8');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedModel = window.localStorage.getItem(MODEL_STORAGE_KEY);
    if (savedModel && MODEL_OPTIONS.some((option) => option.id === savedModel)) setModel(savedModel);
  }, []);

  const { messages, sendMessage, status, stop, error, regenerate, setMessages } = useChat({
    id: 'pax-assistant',
    messages: loadPersistedMessages(),
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest: ({ messages }) => ({
        body: { messages, model },
      }),
    }),
  });

  // Persist the conversation whenever it changes so it survives page reloads.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (messages.length > 0) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      }
    } catch {
      // Storage full or unavailable — the chat still works, just won't persist.
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && status === 'ready') {
      sendMessage({ text: input });
      setInput('');
    }
  };

  const handleModelChange = (nextModel: string) => {
    setModel(nextModel);
    window.localStorage.setItem(MODEL_STORAGE_KEY, nextModel);
  };

  const handleClearChat = () => {
    setMessages([]);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-pax-600 hover:bg-pax-700 text-black shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
        aria-label="Open chatbot"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-8rem)] bg-white border border-gray-200 rounded-lg shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-white px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-black font-semibold">PAX Assistant</h3>
              <p className="text-gray-700 text-xs">Ask me anything about the platform</p>
              <label className="mt-2 flex items-center gap-2 text-[11px] text-gray-700">
                <span>Model</span>
                <select
                  value={model}
                  onChange={(event) => handleModelChange(event.target.value)}
                  className="rounded border border-gray-300 bg-white px-1.5 py-1 text-[11px] text-black"
                  aria-label="Choose AI model"
                >
                  {MODEL_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
            </div>
            <div className="flex items-center gap-3">
              {messages.length > 0 && (
                <button
                  onClick={handleClearChat}
                  className="text-gray-700 hover:text-black transition-colors text-xs"
                  title="Clear conversation"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-700 hover:text-black transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-700 mt-8">
                <p className="text-sm">Hi! I&apos;m your PAX Assistant.</p>
                <p className="text-xs mt-2">Ask me about issuing certificates, bulk uploads, verification, or troubleshooting.</p>
              </div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2 overflow-hidden ${
                    message.role === 'user'
                      ? 'bg-pax-600 text-black'
                      : 'bg-gray-100 text-black'
                  }`}
                >
                  {message.parts.map((part, index) => {
                    if (part.type !== 'text') return null;
                    // break-words + break-all ensures long unbroken strings (wallet
                    // addresses, PaxIDs) wrap inside the bubble instead of overflowing.
                    if (message.role === 'user') {
                      return (
                        <span key={index} className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                          {part.text}
                        </span>
                      );
                    }
                    return (
                      <div key={index} className="text-sm break-words [overflow-wrap:anywhere] chat-markdown">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                            strong: ({ children }) => <strong className="font-semibold text-black">{children}</strong>,
                            ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                            a: ({ href, children }) => (
                              <a href={href} target="_blank" rel="noopener noreferrer" className="text-pax-600 underline hover:text-pax-700">
                                {children}
                              </a>
                            ),
                            code: ({ children }) => (
                              <code className="bg-white text-pax-600 rounded px-1 py-0.5 text-xs [overflow-wrap:anywhere]">{children}</code>
                            ),
                          }}
                        >
                          {part.text}
                        </ReactMarkdown>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {(status === 'submitted' || status === 'streaming') && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-black rounded-lg px-4 py-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-pax-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-pax-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-pax-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="flex justify-start">
                <div className="max-w-[90%] bg-red-900/40 border border-red-700 text-red-200 rounded-lg px-4 py-3">
                  <p className="text-sm font-medium">Something went wrong</p>
                  <p className="text-xs mt-1 text-red-300 break-words [overflow-wrap:anywhere]">{error.message}</p>
                  <button
                    onClick={() => regenerate()}
                    className="mt-2 text-xs bg-red-700 hover:bg-red-600 text-black rounded px-3 py-1 transition-colors"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your question..."
                disabled={status !== 'ready'}
                className="flex-1 min-w-0 bg-white text-black rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pax-500 disabled:opacity-50"
              />
              {status === 'streaming' || status === 'submitted' ? (
                <button
                  type="button"
                  onClick={stop}
                  className="bg-red-600 hover:bg-red-700 text-black rounded-lg px-4 py-2 text-sm transition-colors"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() || status !== 'ready'}
                  className="bg-pax-600 hover:bg-pax-700 text-black rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </>
  );
}
