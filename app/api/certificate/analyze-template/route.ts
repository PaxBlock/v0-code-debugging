import { anthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { z } from 'zod'

const templateSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  palette: z.array(z.string()).min(3).max(6),
  typography: z.object({ heading: z.string(), body: z.string() }),
  layout: z.object({ orientation: z.enum(['portrait', 'landscape']), sections: z.array(z.string()) }),
  fields: z.array(z.object({ key: z.string(), label: z.string(), placement: z.string() })),
  notes: z.array(z.string()),
})

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'Certificate design AI is not configured yet.' }, { status: 503 })
  }

  const body = await request.json().catch(() => null) as { imageDataUrl?: string; institutionName?: string } | null
  if (!body?.imageDataUrl?.startsWith('data:image/')) {
    return Response.json({ error: 'Upload a certificate sample image first.' }, { status: 400 })
  }

  const result = await generateObject({
    model: anthropic('claude-sonnet-4-5'),
    schema: templateSchema,
    system: 'You analyze academic certificate samples for an institution. Describe an editable certificate template, not a finished certificate. Never invent official facts, signatures, seals, or credentials. Keep recommendations practical for a branded issuance editor.',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: `Analyze this certificate sample for ${body.institutionName || 'the institution'}. Identify its visual system, layout, and editable data field placements. Return a clean template specification that a reviewer can approve and edit. Do not reproduce private personal data from the sample.` },
        { type: 'file', data: body.imageDataUrl, mediaType: body.imageDataUrl.slice(5, body.imageDataUrl.indexOf(';')) || 'image/png', filename: 'certificate-sample' },
      ],
    }],
  })

  return Response.json({ template: result.object, approvalStatus: 'draft' })
}
