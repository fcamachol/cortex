import { parsePhoneNumber } from 'libphonenumber-js';

/**
 * Formats a WhatsApp JID or phone number for display
 * @param jid - The WhatsApp JID (e.g., "5215579188699@s.whatsapp.net") or raw phone number
 * @returns Formatted phone number or original string if parsing fails
 */
export function formatPhoneNumber(jid: string): string {
  if (!jid) return '';

  try {
    // Extract the number part from JID if it contains '@'
    const numberPart = jid.includes('@') ? jid.split('@')[0] : jid;
    
    // Skip group JIDs (they end with @g.us)
    if (jid.includes('@g.us')) {
      return jid; // Return as-is for group chats
    }

    // Parse with international format (add + prefix)
    const phoneNumber = parsePhoneNumber('+' + numberPart);

    if (phoneNumber && phoneNumber.isValid()) {
      return phoneNumber.formatInternational();
    }
  } catch (error) {
    // If parsing fails, return original string
    console.warn('Could not parse phone number:', jid, error);
  }

  // Fallback: return original string
  return jid;
}

/**
 * Gets the country code from a phone number
 * @param jid - The WhatsApp JID or phone number
 * @returns Country code (e.g., 'MX', 'US') or undefined
 */
export function getCountryCode(jid: string): string | undefined {
  if (!jid) return undefined;

  try {
    const numberPart = jid.includes('@') ? jid.split('@')[0] : jid;
    
    if (jid.includes('@g.us')) {
      return undefined; // Groups don't have country codes
    }

    const phoneNumber = parsePhoneNumber('+' + numberPart);
    return phoneNumber?.country;
  } catch (error) {
    return undefined;
  }
}

/**
 * Gets the calling code from a phone number
 * @param jid - The WhatsApp JID or phone number
 * @returns Calling code (e.g., '52', '1') or undefined
 */
export function getCallingCode(jid: string): string | undefined {
  if (!jid) return undefined;

  try {
    const numberPart = jid.includes('@') ? jid.split('@')[0] : jid;
    
    if (jid.includes('@g.us')) {
      return undefined;
    }

    const phoneNumber = parsePhoneNumber('+' + numberPart);
    return phoneNumber?.countryCallingCode;
  } catch (error) {
    return undefined;
  }
}

/**
 * Formats a phone number in national format
 * @param jid - The WhatsApp JID or phone number
 * @returns National format phone number or original string
 */
export function formatPhoneNumberNational(jid: string): string {
  if (!jid) return '';

  try {
    const numberPart = jid.includes('@') ? jid.split('@')[0] : jid;
    
    if (jid.includes('@g.us')) {
      return jid;
    }

    const phoneNumber = parsePhoneNumber('+' + numberPart);

    if (phoneNumber && phoneNumber.isValid()) {
      return phoneNumber.formatNational();
    }
  } catch (error) {
    console.warn('Could not parse phone number:', jid, error);
  }

  return jid;
}