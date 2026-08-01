import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  streamText,
  toUIMessageStream,
  UIMessage,
} from 'ai';
import { findFallbackAnswer, FALLBACK_GREETING } from '@/lib/chat-fallback';

export const maxDuration = 30;

const SYSTEM_PROMPT = `You are a helpful assistant for the PAX Certificate System, a blockchain-based academic credential platform.

You help admins and users with:
- How to issue single and bulk certificates
- CSV format requirements for bulk issuance
- Faculty registration and dean signature setup
- Certificate revocation process
- Verification process for credentials
- Troubleshooting common issues (dean signatures not showing, logo not appearing, gas limits, etc.)
- Understanding the platform's architecture (Ethereum, Base L2, smart contracts)
- Wallet connection and role management (Admin, Issuer, Verifier)

Key platform details:
- Built on Ethereum (Sepolia testnet, planned migration to Base L2)
- Uses smart contracts for credential anchoring
- Supports bulk CSV issuance with faculty matching
- Certificates include dean, registrar, and VC signatures
- Verification is public and works for all institutions (including deactivated ones)
- Uses PaxID format like "PHY/2022/054" for certificate lookup
- No traditional backend database - all records on-chain

Be concise, accurate, and helpful. If you don't know something, say so rather than guessing.`;

// Cache the AI Gateway health status in module scope so we don't pay a health-check
// round-trip on every message. We re-check on every request while it's failing so the
// assistant recovers as soon as billing is activated; once healthy, we trust it for 5 minutes.
let gatewayHealthyUntil = 0;
const HEALTHY_TTL_MS = 5 * 60 * 1000;

async function isGatewayHealthy(): Promise<boolean> {
  if (Date.now() < gatewayHealthyUntil) return true;
  try {
    await generateText({
      model: 'anthropic/claude-sonnet-4.5',
      prompt: 'ping',
      maxOutputTokens: 1,
    });
    gatewayHealthyUntil = Date.now() + HEALTHY_TTL_MS;
    return true;
  } catch (error) {
    console.log(
      '[v0] AI Gateway health check failed, using fallback:',
      error instanceof Error ? error.message : String(error)
    );
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
      // Chunk the answer into small deltas for a natural streaming feel.
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

  // If the AI Gateway isn't available (billing verification pending), answer from the
  // built-in knowledge base so admins still get help.
  const healthy = await isGatewayHealthy();
  if (!healthy) {
    const question = getLatestUserText(messages);
    const answer = findFallbackAnswer(question);
    const text = answer
      ? `${answer}\n\n---\n*Note: I'm in offline mode (AI service not yet activated on this account), so this answer comes from the built-in help library.*`
      : `${FALLBACK_GREETING}`;
    return fallbackResponse(text);
  }

  const result = streamText({
    model: 'anthropic/claude-sonnet-4.5',
    instructions: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onError: (error) => {
        // Surface the real cause to the client instead of a generic "An error occurred."
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('credit card')) {
          return 'The AI service is not activated on this Vercel account yet. A credit card must be added on the Vercel team (AI Gateway free credits) before the assistant can reply.';
        }
        return `Assistant error: ${message}`;
      },
    }),
  });
}
