import { lookupCredential } from '@/lib/credential-lookup'

export const dynamic = 'force-dynamic'

function institutionLabel(slug: string) {
  return decodeURIComponent(slug).replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ institution: string; certificateId: string }>
}) {
  const { institution, certificateId } = await params
  const result = await lookupCredential(institutionLabel(institution), decodeURIComponent(certificateId))
  const institutionName = result.institutionName || institutionLabel(institution)
  const isValid = result.found && result.status === 'valid'

  return (
    <main className="min-h-screen bg-[#f8f5ef] px-4 py-10 text-[#1a1a2e] sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center justify-between gap-4 border-b border-[#d6c49a] pb-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#9b6b20]">PAX verification</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Certificate verification</h1>
          </div>
          <span className="rounded-full border border-[#d6c49a] bg-white px-3 py-1.5 text-xs font-medium text-[#6b5331]">Public record</span>
        </header>

        {!result.found ? (
          <section className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">Not found</p>
            <h2 className="mt-3 text-xl font-semibold">This certificate could not be verified</h2>
            <p className="mt-3 leading-6 text-[#665d52]">{result.error || 'Check the certificate ID and institution, then try again.'}</p>
          </section>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-[#d6c49a] bg-white shadow-sm">
            <div className={`p-6 sm:p-8 ${isValid ? 'bg-[#f1f8ef]' : 'bg-[#fff2f0]'}`}>
              <p className={`text-xs font-bold uppercase tracking-[0.2em] ${isValid ? 'text-green-700' : 'text-red-700'}`}>{isValid ? 'Verified credential' : 'Credential revoked'}</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">{result.candidateName}</h2>
              <p className="mt-2 text-[#665d52]">{institutionName}</p>
            </div>
            <dl className="grid gap-px bg-[#eee8dc] sm:grid-cols-2">
              {[
                ['Programme', result.courseName],
                ['Classification', result.grade],
                ['Certificate ID', result.paxId],
                ['Issue date', result.issuedAt],
                ['Wallet address', result.studentAddress],
                ['Status', isValid ? 'Valid on blockchain' : 'Revoked'],
              ].map(([label, value]) => (
                <div key={label} className="bg-white p-5">
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9b6b20]">{label}</dt>
                  <dd className="mt-2 break-words text-sm leading-6 text-[#30291f]">{value || '—'}</dd>
                </div>
              ))}
            </dl>
            {!isValid && (result.revocationReason || result.revocationDate) && (
              <div className="border-t border-red-100 bg-red-50 px-6 py-4 text-sm text-red-900">
                {result.revocationReason && <p>Reason: {result.revocationReason}</p>}
                {result.revocationDate && <p className="mt-1">Revoked: {result.revocationDate}</p>}
              </div>
            )}
            <footer className="border-t border-[#eee8dc] px-6 py-4 text-xs leading-5 text-[#766b5d]">
              This record was checked against the PAX blockchain credential. It is not a replacement for the institution&apos;s official academic records.
            </footer>
          </section>
        )}
      </div>
    </main>
  )
}
