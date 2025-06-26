import { useState } from 'react';
import { Check } from 'lucide-react';
import { useWhatsAppCrmLink } from '@/hooks/useWhatsAppCrmLink';
import { AddContactFromWhatsAppModal } from '@/components/crm/AddContactFromWhatsAppModal';

interface ClickableContactNameProps {
  senderJid: string;
  displayName: string;
  instanceId: string;
  pushName?: string;
  variant?: 'message' | 'header';
}

export function ClickableContactName({ 
  senderJid, 
  displayName, 
  instanceId, 
  pushName,
  variant = 'message'
}: ClickableContactNameProps) {
  const [showModal, setShowModal] = useState(false);
  const { data: crmLinkStatus } = useWhatsAppCrmLink(senderJid);

  const handleClick = () => {
    setShowModal(true);
  };

  const baseClasses = "hover:underline inline-flex items-center gap-1 cursor-pointer";
  const variantClasses = variant === 'header' 
    ? "font-semibold text-gray-900 dark:text-gray-100 text-base" 
    : "text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1";

  return (
    <>
      <button
        onClick={handleClick}
        className={`${baseClasses} ${variantClasses}`}
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