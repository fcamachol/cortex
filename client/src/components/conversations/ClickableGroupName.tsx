import { useState } from 'react';
import { Check, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AddGroupFromWhatsAppModal } from '@/components/crm/AddGroupFromWhatsAppModal';

interface ClickableGroupNameProps {
  groupJid: string;
  displayName: string;
  instanceId: string;
  subject?: string;
  variant?: 'message' | 'header';
}

export function ClickableGroupName({ 
  groupJid, 
  displayName, 
  instanceId, 
  subject,
  variant = 'header'
}: ClickableGroupNameProps) {
  const [showModal, setShowModal] = useState(false);
  
  // Check if this WhatsApp group is already linked to a CRM group
  const { data: crmLinkStatus } = useQuery({
    queryKey: [`/api/crm/groups/whatsapp-link-status/${groupJid}`],
    enabled: !!groupJid && groupJid.includes('@g.us'),
  });

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
        {variant === 'header' && <Users className="h-4 w-4 mr-1" />}
        {displayName}
        {crmLinkStatus?.isLinked && (
          <Check className="h-3 w-3 text-green-500" />
        )}
      </button>
      
      <AddGroupFromWhatsAppModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        groupJid={groupJid}
        groupName={subject || displayName}
        instanceId={instanceId}
      />
    </>
  );
}