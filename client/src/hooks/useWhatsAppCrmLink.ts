import { useQuery } from '@tanstack/react-query';

export function useWhatsAppCrmLink(senderJid: string | null) {
  return useQuery({
    queryKey: [`/api/crm/contacts/whatsapp-link-status/${senderJid}`],
    enabled: !!senderJid && senderJid !== 'undefined',
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false
  });
}