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
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { findFallbackAnswer, FALLBACK_GREETING } from '@/lib/chat-fallback';
import { PLATFORM_KNOWLEDGE } from '@/lib/platform-knowledge';
import { lookupCredential } from '@/lib/credential-lookup';

export const maxDuration = 60;

// Claude Sonnet 5 via the direct Anthropic provider (reads ANTHROPIC_API_KEY from env).
const MODEL = 'claude-sonnet-5';

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
  const { messages }: { messages: UIMessage[] } = await req.json();

  // If the Anthropic API key isn't configured yet, answer from the built-in knowledge
  // base so admins still get help. Once the key is added, Claude takes over automatically.
  if (!process.env.ANTHROPIC_API_KEY) {
    const question = getLatestUserText(messages);
    const answer = findFallbackAnswer(question);
    const text = answer
      ? `${answer}\n\n---\n*Note: I'm in offline mode (AI key not yet configured), so this answer comes from the built-in help library. For credential lookups and richer answers, the AI key is needed.*`
      : `${FALLBACK_GREETING}`;
    return fallbackResponse(text);
  }

  const result = streamText({
    model: anthropic(MODEL),
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
        console.log('[v0] Claude chat error:', message);
        if (message.includes('credit') || message.includes('billing')) {
          return 'The AI service hit a billing issue. Please check the Anthropic API key and account balance.';
        }
        if (message.includes('API key') || message.includes('authentication') || message.includes('401')) {
          return 'The AI API key appears to be invalid or missing. Please check the ANTHROPIC_API_KEY configuration.';
        }
        return `Assistant error: ${message}`;
      },
    }),
  });
}
