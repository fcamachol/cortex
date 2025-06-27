import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Building2, Plus, X, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TagInput } from "./TagInput";

interface SimpleContactFormProps {
  onSuccess?: () => void;
  ownerUserId: string;
  spaceId?: number;
  isEditMode?: boolean;
  contactId?: number;
  onDelete?: () => void;
  initialData?: {
    fullName?: string;
    relationship?: string;
    tags?: string[];
    profilePictureUrl?: string;
    notes?: string;
  };
}

export function SimpleContactForm({ 
  onSuccess, 
  ownerUserId, 
  spaceId, 
  isEditMode = false, 
  contactId, 
  onDelete, 
  initialData 
}: SimpleContactFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [showCreateCompanyModal, setShowCreateCompanyModal] = useState(false);
  
  // Form fields
  const [contactName, setContactName] = useState(initialData?.fullName || '');
  const [profession, setProfession] = useState('');
  const [company, setCompany] = useState('');
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [description, setDescription] = useState(initialData?.notes || '');
  
  // Company creation
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyType, setNewCompanyType] = useState('');

  // Fetch companies for dropdown
  const { data: companies = [] } = useQuery({
    queryKey: ['/api/crm/companies'],
    enabled: true,
  });

  // Fetch contact details in edit mode
  const { data: contactDetails } = useQuery({
    queryKey: ['/api/crm/contacts', contactId, 'details'],
    enabled: isEditMode && !!contactId,
  });

  // Load initial data when in edit mode
  useEffect(() => {
    if (contactDetails) {
      setContactName(contactDetails.fullName || '');
      setDescription(contactDetails.notes || '');
      setTags(contactDetails.tags || []);
      
      // Extract profession and company from existing data if available
      if (contactDetails.companies && contactDetails.companies.length > 0) {
        const firstCompany = contactDetails.companies[0];
        setCompany(firstCompany.companyName || '');
        setProfession(firstCompany.role || '');
      }
    }
  }, [contactDetails]);

  // Create company mutation
  const createCompanyMutation = useMutation({
    mutationFn: async (companyData: { companyName: string; businessType: string; ownerUserId: string; spaceId?: number }) => {
      return await apiRequest('/api/crm/companies', {
        method: 'POST',
        body: companyData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/companies'] });
      setShowCreateCompanyModal(false);
      setNewCompanyName('');
      setNewCompanyType('');
      toast({
        title: "Success",
        description: "Company created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create company",
        variant: "destructive",
      });
    },
  });

  // Save contact mutation
  const saveContactMutation = useMutation({
    mutationFn: async (contactData: any) => {
      const url = isEditMode && contactId 
        ? `/api/crm/contacts/${contactId}` 
        : '/api/crm/contacts';
      const method = isEditMode ? 'PUT' : 'POST';
      
      return await apiRequest(url, {
        method,
        body: contactData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts'] });
      toast({
        title: "Success",
        description: isEditMode ? "Contact updated successfully" : "Contact created successfully",
      });
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save contact",
        variant: "destructive",
      });
    },
  });

  const handleCreateCompany = () => {
    if (newCompanyName.trim()) {
      createCompanyMutation.mutate({
        companyName: newCompanyName.trim(),
        businessType: newCompanyType || 'Other',
        ownerUserId,
        spaceId,
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!contactName.trim()) {
      toast({
        title: "Error",
        description: "Contact name is required",
        variant: "destructive",
      });
      return;
    }

    const contactData = {
      fullName: contactName.trim(),
      notes: description.trim(),
      tags: tags,
      ownerUserId,
      spaceId,
    };

    saveContactMutation.mutate(contactData);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header with Delete Button */}
        {isEditMode && onDelete && (
          <div className="flex justify-end mb-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteAlert(true)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Contact
            </Button>
          </div>
        )}

        {/* Contact Name */}
        <div className="space-y-2">
          <Label htmlFor="contactName" className="text-sm font-medium">
            Contact Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="contactName"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Miguel Selvas"
            className="text-lg"
            required
          />
        </div>

        {/* Profession and Company Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="profession" className="text-sm font-medium">Profession</Label>
            <Input
              id="profession"
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              placeholder="e.g., Cardiologist"
              className="text-base"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="company" className="text-sm font-medium">Company</Label>
            <div className="flex gap-2">
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g., Hospital Angeles"
                className="text-base flex-1"
              />
              
              <Dialog open={showCreateCompanyModal} onOpenChange={setShowCreateCompanyModal}>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New Company</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label htmlFor="companyName">Company Name</Label>
                      <Input
                        id="companyName"
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        placeholder="Enter company name"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="businessType">Business Type</Label>
                      <Select value={newCompanyType} onValueChange={setNewCompanyType}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select business type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Healthcare">Healthcare</SelectItem>
                          <SelectItem value="Technology">Technology</SelectItem>
                          <SelectItem value="Finance">Finance</SelectItem>
                          <SelectItem value="Education">Education</SelectItem>
                          <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                          <SelectItem value="Retail">Retail</SelectItem>
                          <SelectItem value="Services">Services</SelectItem>
                          <SelectItem value="Non-profit">Non-profit</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowCreateCompanyModal(false)}
                        disabled={createCompanyMutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={handleCreateCompany}
                        disabled={createCompanyMutation.isPending}
                      >
                        {createCompanyMutation.isPending ? 'Creating...' : 'Create Company'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Tags</Label>
          <TagInput
            tags={tags}
            onTagsChange={setTags}
            placeholder="Add tags like Client, Friend, etc."
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-medium">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Es un abogado que trabajo conmigo en Excel. Se dedica al outsourcing."
            className="min-h-[80px] text-base"
            rows={3}
          />
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-4">
          <Button
            type="submit"
            disabled={saveContactMutation.isPending}
            className="bg-green-600 hover:bg-green-700 text-white px-8"
          >
            {saveContactMutation.isPending 
              ? (isEditMode ? 'Updating...' : 'Creating...') 
              : (isEditMode ? 'Update Contact' : 'Create Contact')
            }
          </Button>
        </div>
      </form>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this contact? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (onDelete) {
                  onDelete();
                }
                setShowDeleteAlert(false);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default SimpleContactForm;