import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { maybeLinkApprovedMember } from "@/app/actions/auth-routing";

const handler = toNextJsHandler(auth);

export async function POST(request: Request) {
  const response = await handler.POST(request);
  if (request.url.includes('/sign-up/email') && response.ok) {
    try {
      const body = await request.clone().json();
      await maybeLinkApprovedMember(String(body.email || ''));
    } catch {}
  }
  return response;
}

export const GET = handler.GET;
