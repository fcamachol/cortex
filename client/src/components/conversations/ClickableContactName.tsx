import { useState } from 'react';
import { Check } from 'lucide-react';
import { useWhatsAppCrmLink } from '@/hooks/useWhatsAppCrmLink';
import { AddContactFromWhatsAppModal } from '@/components/crm/AddContactFromWhatsAppModal';

interface ClickableContactNameProps {
  senderJid: string;
  displayName: string;
  instanceId: string;
  pushName?: string;
}

export function ClickableContactName({ 
  senderJid, 
  displayName, 
  instanceId, 
  pushName 
}: ClickableContactNameProps) {
  const [showModal, setShowModal] = useState(false);
  const { data: crmLinkStatus } = useWhatsAppCrmLink(senderJid);

  const handleClick = () => {
    setShowModal(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1 hover:underline inline-flex items-center gap-1 cursor-pointer"
      >
        {displayName}
        {crmLinkStatus?.isLinked && (
          <Check className="h-3 w-3 text-green-500" />
        )}
      </button>
      
      <AddContactFromWhatsAppModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        senderJid={senderJid}
        pushName={pushName || displayName}
        instanceId={instanceId}
      />
    </>
  );
}