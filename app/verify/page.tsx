import type { Metadata } from 'next'
import { PublicVerificationForm } from '@/components/public-verification-form'

export const metadata: Metadata = {
  title: 'Verify a Certificate | PAX',
  description: 'Publicly verify a PAX academic certificate without an account or wallet.',
}

export default function VerifyPage() {
  return <PublicVerificationForm />
}
