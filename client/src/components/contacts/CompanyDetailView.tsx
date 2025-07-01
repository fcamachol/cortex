import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, X, Phone, Mail, MapPin, Building2, Globe, Users, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CompanyFormBlocks from "./CompanyFormBlocks";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CompanyDetailViewProps {
  company: any;
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
}

export default function CompanyDetailView({ company, isOpen, onClose, spaceId }: CompanyDetailViewProps) {
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [relationshipType, setRelationshipType] = useState('works_for');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const { toast } = useToast();

  // Available relationship types based on the database enum
  const relationshipTypes = [
    { value: 'works_for', label: 'Employee', description: 'Person works for the company' },
    { value: 'owns', label: 'Owner', description: 'Person owns the company' },
    { value: 'manages', label: 'Manager', description: 'Person manages part of the company' },
    { value: 'client_of', label: 'Client', description: 'Person is a client of the company' },
    { value: 'vendor_of', label: 'Vendor', description: 'Person provides services to the company' },
    { value: 'collaborates_with', label: 'Collaborator', description: 'Person collaborates with the company' },
    { value: 'reports_to', label: 'Reports To', description: 'Person reports to the company' }
  ];
  const queryClient = useQueryClient();

  // Fetch company employees/contacts with enhanced relationship data
  const { data: companyContacts = [] } = useQuery({
    queryKey: ["/api/crm/company-contacts-enhanced", company?.id],
    enabled: !!company?.id,
  });

  // Fetch all available contacts for association
  const { data: availableContacts = [] } = useQuery({
    queryKey: ["/api/crm/contacts"],
    enabled: isAddContactOpen,
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/crm/companies/${company.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/companies"] });
      toast({
        title: "Company Deleted",
        description: `${company.name} has been deleted successfully.`,
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete company",
        variant: "destructive",
      });
    },
  });

  const associateContactMutation = useMutation({
    mutationFn: async (data: { contactId: string; relationshipType: string; metadata: any }) => {
      return await apiRequest("POST", `/api/crm/companies/${company.id}/contacts`, data);
    },
    onSuccess: () => {
      // Force refresh the company contacts
      queryClient.invalidateQueries({ queryKey: ["/api/crm/company-contacts-enhanced", company.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/companies"] });
      queryClient.refetchQueries({ queryKey: ["/api/crm/company-contacts-enhanced", company.id] });
      setSelectedContact(null);
      setRelationshipType('works_for');
      setJobTitle('');
      setDepartment('');
      toast({
        title: "Contact Associated",
        description: "Contact has been successfully associated with the company.",
      });
      setIsAddContactOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to associate contact",
        variant: "destructive",
      });
    },
  });

  // Handle contact association with form data
  const handleAssociateContact = () => {
    if (!selectedContact) return;
    
    associateContactMutation.mutate({
      contactId: selectedContact.contactId || selectedContact.id,
      relationshipType,
      metadata: {
        title: jobTitle,
        department: department,
        start_date: new Date().toISOString().split('T')[0],
        is_primary: false
      }
    });
  };

  if (!company) return null;

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${company.name}?`)) {
      deleteCompanyMutation.mutate();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarFallback className="bg-blue-100 text-blue-600">
                    <Building2 className="w-6 h-6" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-semibold">{company.name}</h2>
                  {company.industry && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">{company.industry}</p>
                  )}
                </div>
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditFormOpen(true)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 px-1">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="contacts">
                  Contacts ({companyContacts.length})
                </TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                {/* Basic Info */}
                <Card>
                  <CardHeader>
                    <CardTitle>Company Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {company.description && (
                      <div>
                        <h4 className="font-medium mb-2">Description</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {company.description}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {company.business_type && (
                        <div>
                          <h4 className="font-medium mb-1">Business Type</h4>
                          <Badge variant="secondary">{company.business_type}</Badge>
                        </div>
                      )}

                      {company.tax_id && (
                        <div>
                          <h4 className="font-medium mb-1">Tax ID</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {company.tax_id}
                          </p>
                        </div>
                      )}
                    </div>

                    {company.website_url && (
                      <div>
                        <h4 className="font-medium mb-1">Website</h4>
                        <a
                          href={company.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
                        >
                          <Globe className="w-4 h-4" />
                          {company.website_url}
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Contact Information */}
                {(company.phoneNumbers?.length > 0 || company.emails?.length > 0) && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {company.phoneNumbers?.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2 flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            Phone Numbers
                          </h4>
                          <div className="space-y-1">
                            {company.phoneNumbers.map((phone: any, index: number) => (
                              <div key={index} className="flex items-center justify-between text-sm">
                                <span>{phone.phoneNumber}</span>
                                {phone.label && (
                                  <Badge variant="outline" className="text-xs">
                                    {phone.label}
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {company.emails?.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2 flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            Email Addresses
                          </h4>
                          <div className="space-y-1">
                            {company.emails.map((email: any, index: number) => (
                              <div key={index} className="flex items-center justify-between text-sm">
                                <a
                                  href={`mailto:${email.emailAddress}`}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  {email.emailAddress}
                                </a>
                                {email.label && (
                                  <Badge variant="outline" className="text-xs">
                                    {email.label}
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Addresses */}
                {company.addresses?.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Addresses
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {company.addresses.map((address: any, index: number) => (
                          <div key={index} className="border rounded-lg p-3">
                            {address.label && (
                              <Badge variant="outline" className="mb-2 text-xs">
                                {address.label}
                              </Badge>
                            )}
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {address.street && <div>{address.street}</div>}
                              <div>
                                {[address.city, address.state, address.postalCode]
                                  .filter(Boolean)
                                  .join(", ")}
                              </div>
                              {address.country && <div>{address.country}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="contacts" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Company Contacts</CardTitle>
                        <CardDescription>
                          People associated with {company.companyName}
                        </CardDescription>
                      </div>
                      <Button size="sm" onClick={() => setIsAddContactOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Contact
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {companyContacts.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No contacts associated with this company yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {companyContacts.map((contact: any) => (
                          <div key={contact.contact_id} className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <Avatar className="w-10 h-10">
                              <AvatarFallback>
                                {contact.full_name?.charAt(0) || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{contact.full_name}</h4>
                                {contact.is_primary && (
                                  <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                                    Primary
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                {contact.title && (
                                  <span className="font-medium">{contact.title}</span>
                                )}
                                {contact.title && contact.department && (
                                  <span>•</span>
                                )}
                                {contact.department && (
                                  <span>{contact.department}</span>
                                )}
                              </div>

                              {(contact.phone || contact.email) && (
                                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                  {contact.phone && (
                                    <div className="flex items-center gap-1">
                                      <Phone className="w-3 h-3" />
                                      <span>{contact.phone}</span>
                                    </div>
                                  )}
                                  {contact.email && (
                                    <div className="flex items-center gap-1">
                                      <Mail className="w-3 h-3" />
                                      <span>{contact.email}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {contact.start_date && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Started: {new Date(contact.start_date).toLocaleDateString()}
                                  {contact.end_date && (
                                    <span> - {new Date(contact.end_date).toLocaleDateString()}</span>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex flex-col items-end gap-2">
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${
                                  contact.relationship_type === 'works_for' ? 'border-blue-200 text-blue-700' :
                                  contact.relationship_type === 'owns' ? 'border-gold-200 text-yellow-700' :
                                  contact.relationship_type === 'contractor' ? 'border-purple-200 text-purple-700' :
                                  contact.relationship_type === 'client_of' ? 'border-green-200 text-green-700' :
                                  contact.relationship_type === 'vendor_of' ? 'border-orange-200 text-orange-700' :
                                  'border-gray-200 text-gray-700'
                                }`}
                              >
                                {contact.relationship_type}
                              </Badge>
                              
                              <div className="flex items-center gap-1 text-xs text-gray-400">
                                <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                                <span>Weight: {contact.weight}</span>
                              </div>
                              
                              <Badge 
                                variant={contact.status === 'active' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {contact.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="details" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Additional Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Created:</span>
                        <span className="ml-2 text-gray-600 dark:text-gray-400">
                          {new Date(company.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Last Updated:</span>
                        <span className="ml-2 text-gray-600 dark:text-gray-400">
                          {new Date(company.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-red-600">Danger Zone</CardTitle>
                    <CardDescription>
                      These actions cannot be undone. Please be certain.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={deleteCompanyMutation.isPending}
                    >
                      {deleteCompanyMutation.isPending ? "Deleting..." : "Delete Company"}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditFormOpen} onOpenChange={setIsEditFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
          <CompanyFormBlocks
            isEditMode={true}
            companyId={company.id}
            ownerUserId="7804247f-3ae8-4eb2-8c6d-2c44f967ad42"
            spaceId={spaceId}
            onSuccess={() => {
              setIsEditFormOpen(false);
              queryClient.invalidateQueries({ queryKey: ["/api/crm/companies"] });
            }}
            onDelete={handleDelete}
            initialData={{
              name: company.name,
              description: company.description,
              tags: company.tags || []
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Add Contact Dialog */}
      <Dialog open={isAddContactOpen} onOpenChange={setIsAddContactOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Associate Contact with {company.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Contact Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Select Contact</Label>
              <Select 
                value={selectedContact?.contactId || selectedContact?.id || ''}
                onValueChange={(value) => {
                  const contact = availableContacts.find((c: any) => 
                    (c.contactId || c.id) === value
                  );
                  setSelectedContact(contact);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a contact to associate..." />
                </SelectTrigger>
                <SelectContent>
                  {availableContacts
                    .filter((contact: any) => 
                      !companyContacts.some((cc: any) => cc.contact_id === contact.contactId)
                    )
                    .map((contact: any) => (
                      <SelectItem key={contact.contactId || contact.id} value={contact.contactId || contact.id}>
                        {contact.fullName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Relationship Type Selection */}
            {selectedContact && (
              <>
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Relationship Type</Label>
                  <Select value={relationshipType} onValueChange={setRelationshipType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {relationshipTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex flex-col">
                            <span className="font-medium">{type.label}</span>
                            <span className="text-xs text-gray-500">{type.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Job Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Job Title</Label>
                    <Input
                      placeholder="e.g., Manager, Developer"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Department</Label>
                    <Input
                      placeholder="e.g., Sales, Engineering"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    />
                  </div>
                </div>

                {/* Association Button */}
                <div className="flex justify-end gap-3 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSelectedContact(null);
                      setRelationshipType('works_for');
                      setJobTitle('');
                      setDepartment('');
                    }}
                  >
                    Clear
                  </Button>
                  <Button 
                    onClick={handleAssociateContact}
                    disabled={associateContactMutation.isPending}
                  >
                    {associateContactMutation.isPending ? 'Associating...' : 'Associate Contact'}
                  </Button>
                </div>
              </>
            )}

            {/* No Available Contacts Message */}
            {availableContacts.filter((contact: any) => 
              !companyContacts.some((cc: any) => cc.contact_id === contact.contactId)
            ).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No available contacts to associate.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}