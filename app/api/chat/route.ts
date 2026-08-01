import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  UIMessage,
} from 'ai';

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

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

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
