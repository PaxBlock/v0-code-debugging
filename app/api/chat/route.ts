import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
  tool,
  UIMessage,
} from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { findFallbackAnswer, FALLBACK_GREETING } from '@/lib/chat-fallback';
import { PLATFORM_KNOWLEDGE } from '@/lib/platform-knowledge';
import { lookupCredential } from '@/lib/credential-lookup';

export const maxDuration = 60;

// AgentRouter exposes an OpenAI-compatible API. The model can be changed with
// AGENTROUTER_MODEL without changing application code.
const MODEL = process.env.AGENTROUTER_MODEL || 'claude-opus-4-8';
const agentRouter = createOpenAI({
  apiKey: process.env.AGENTROUTER_API_KEY,
  baseURL: 'https://agentrouter.org/v1',
});

async function agentRouterIsAvailable(): Promise<boolean> {
  if (!process.env.AGENTROUTER_API_KEY) return false;
  try {
    const response = await fetch('https://agentrouter.org/v1/models', {
      headers: { Authorization: `Bearer ${process.env.AGENTROUTER_API_KEY}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.includes('application/json')) return false;
    const payload = (await response.json()) as { data?: unknown };
    return Array.isArray(payload.data) && payload.data.length > 0;
  } catch (error) {
    console.log('[v0] AgentRouter unavailable; using Claude fallback:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Extract the latest user message text from the UIMessage array.
function getLatestUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'user') continue;
    const text = msg.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join(' ');
    if (text.trim()) return text;
  }
  return '';
}

// Stream a fallback answer as a proper UI message so the client renders it like any reply.
function fallbackResponse(answer: string) {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const id = 'fallback-text';
      writer.write({ type: 'text-start', id });
      const words = answer.split(' ');
      let buffer = '';
      for (const word of words) {
        buffer += (buffer ? ' ' : '') + word;
        if (buffer.length >= 24) {
          writer.write({ type: 'text-delta', id, delta: buffer + ' ' });
          buffer = '';
        }
      }
      if (buffer) {
        writer.write({ type: 'text-delta', id, delta: buffer });
      }
      writer.write({ type: 'text-end', id });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

export async function POST(req: Request) {
  const { messages, model: requestedModel }: { messages: UIMessage[]; model?: string } = await req.json();
  const allowedModels = new Set(['claude-opus-4-8', 'claude-sonnet-4-5', 'gpt-5.6']);
  const selectedModel = requestedModel && allowedModels.has(requestedModel) ? requestedModel : MODEL;

  // Prefer AgentRouter, but do not leave users with a blank chat if its API domain
  // is blocked by an upstream WAF. Direct Claude remains the reliable fallback.
  const agentRouterAvailable = await agentRouterIsAvailable();
  const claudeAvailable = Boolean(process.env.ANTHROPIC_API_KEY);
  if (!agentRouterAvailable && !claudeAvailable) {
    const question = getLatestUserText(messages);
    const answer = findFallbackAnswer(question);
    const text = answer
      ? `${answer}\n\n---\n*Note: I'm in offline mode (AI key not yet configured), so this answer comes from the built-in help library. For credential lookups and richer answers, the AI key is needed.*`
      : `${FALLBACK_GREETING}`;
    return fallbackResponse(text);
  }

  const result = streamText({
    model: agentRouterAvailable ? agentRouter(selectedModel) : anthropic('claude-sonnet-4-5'),
    instructions: PLATFORM_KNOWLEDGE,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools: {
      lookupCredential: tool({
        description:
          'Look up the live status of an academic credential on the PAX blockchain. Use this whenever a user wants to verify or check a specific certificate. Requires the institution/programme name (or contract address) and a student identifier (PaxID / Matric No. like "PHY/2022/054", or a wallet address 0x...).',
        inputSchema: z.object({
          institution: z
            .string()
            .describe('The institution or programme name (e.g. "University of Lagos"), or its contract address.'),
          identifier: z
            .string()
            .describe('The student PaxID / Matric No. (e.g. "PHY/2022/054") or wallet address (0x...).'),
        }),
        execute: async ({ institution, identifier }) => {
          return await lookupCredential(institution, identifier);
        },
      }),
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onError: (error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.log('[v0] AgentRouter chat error:', message);
        if (message.includes('credit') || message.includes('billing') || message.includes('balance')) {
          return 'The AI service hit a billing issue. Please check your AgentRouter account balance and API key.';
        }
        if (message.includes('API key') || message.includes('authentication') || message.includes('401')) {
          return 'The AgentRouter API key appears to be invalid or missing. Please check the AGENTROUTER_API_KEY configuration.';
        }
        return `Assistant error: ${message}`;
      },
    }),
  });
}
