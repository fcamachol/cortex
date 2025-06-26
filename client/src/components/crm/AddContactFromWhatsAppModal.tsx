import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { User, Phone, MessageSquare } from 'lucide-react';

interface AddContactFromWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  senderJid: string;
  pushName?: string;
  instanceId: string;
}

export function AddContactFromWhatsAppModal({
  isOpen,
  onClose,
  senderJid,
  pushName,
  instanceId
}: AddContactFromWhatsAppModalProps) {
  const [fullName, setFullName] = useState(pushName || '');
  const [relationship, setRelationship] = useState('');
  const [notes, setNotes] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Extract phone number for display
  const phoneNumber = senderJid.replace('@s.whatsapp.net', '').replace('@g.us', '');

  const createContactMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/crm/contacts/from-whatsapp', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json'
        }
      });
    },
    onSuccess: (result) => {
      toast({
        title: "Contact Added",
        description: result.action === 'created_new' 
          ? `${fullName} has been added to your CRM contacts.`
          : `${fullName} has been linked to your existing CRM contact.`,
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts'] });
      queryClient.invalidateQueries({ queryKey: [`/api/crm/contacts/whatsapp-link-status/${senderJid}`] });
      
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add contact to CRM. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for the contact.",
        variant: "destructive",
      });
      return;
    }

    createContactMutation.mutate({
      senderJid,
      pushName: fullName,
      instanceId,
      relationship: relationship || null,
      notes: notes || `Added from WhatsApp chat`
    });
  };

  const handleClose = () => {
    setFullName(pushName || '');
    setRelationship('');
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Add to CRM Contacts
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* WhatsApp Info Display */}
          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-2">
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm font-medium">WhatsApp Contact</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <Phone className="h-3 w-3" />
              <span>{phoneNumber}</span>
            </div>
          </div>

          {/* Contact Name */}
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name *</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter contact name"
              required
            />
          </div>

          {/* Relationship */}
          <div className="space-y-2">
            <Label htmlFor="relationship">Relationship</Label>
            <Input
              id="relationship"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              placeholder="e.g., Client, Friend, Family"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this contact"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createContactMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {createContactMutation.isPending ? 'Adding...' : 'Add to CRM'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}