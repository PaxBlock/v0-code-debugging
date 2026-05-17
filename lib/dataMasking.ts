/**
 * GDPR-compliant data masking for debug logs
 * Masks sensitive personally identifiable information while keeping logs useful
 */

export const maskEmail = (email: string): string => {
  if (!email || typeof email !== 'string') return '***';
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return '***@***';
  const maskedLocal = localPart[0] + '*'.repeat(Math.max(1, localPart.length - 2)) + (localPart.length > 1 ? localPart[localPart.length - 1] : '');
  return `${maskedLocal}@${domain}`;
};

export const maskName = (name: string): string => {
  if (!name || typeof name !== 'string') return '***';
  if (name.length <= 2) return '*'.repeat(name.length);
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
};

export const maskWalletAddress = (address: string): string => {
  if (!address || typeof address !== 'string' || address.length < 12) return '***';
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
};

export const maskPaxId = (paxId: string): string => {
  if (!paxId || typeof paxId !== 'string') return '***';
  if (paxId.length <= 4) return '*'.repeat(paxId.length);
  return paxId.slice(0, 2) + '*'.repeat(paxId.length - 4) + paxId.slice(-2);
};

/**
 * Mask all sensitive fields in an object for GDPR-compliant logging
 */
export const maskLogData = (data: any): any => {
  if (!data || typeof data !== 'object') return data;
  
  const masked = { ...data };
  
  // Mask common sensitive fields
  if (masked.name) masked.name = maskName(masked.name);
  if (masked.email) masked.email = maskEmail(masked.email);
  if (masked.studentEmail) masked.studentEmail = maskEmail(masked.studentEmail);
  if (masked.student) masked.student = maskWalletAddress(masked.student);
  if (masked.studentAddress) masked.studentAddress = maskWalletAddress(masked.studentAddress);
  if (masked.walletAddress) masked.walletAddress = maskWalletAddress(masked.walletAddress);
  if (masked.paxId) masked.paxId = maskPaxId(masked.paxId);
  if (masked.course) masked.course = `${masked.course.substring(0, 3)}***`;
  
  return masked;
};

export const logGDPRCompliant = (label: string, data: any): void => {
  console.log(`[v0] ${label}:`, maskLogData(data));
};
