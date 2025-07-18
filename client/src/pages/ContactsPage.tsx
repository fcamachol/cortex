import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Users, Heart, Star, Building2, Briefcase, Check, Phone, Mail } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CrmContact } from "@shared/schema";
import { ContactFormBlocks } from "@/components/contacts/ContactFormBlocks";
import { ContactModal } from "@/components/contacts/ContactModal";
import ContactDetailView from "@/components/contacts/ContactDetailView";
import CompanyDetailView from "@/components/contacts/CompanyDetailView";
import { CompanyForm } from "@/components/contacts/CompanyForm";

interface ContactsPageProps {
  userId: string;
  selectedSpace?: any;
}

export default function ContactsPage({ userId, selectedSpace }: ContactsPageProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [activeTab, setActiveTab] = React.useState("contacts");
  const [isAddContactOpen, setIsAddContactOpen] = React.useState(false);
  const [selectedContact, setSelectedContact] = React.useState<CrmContact | null>(null);
  const [showContactModal, setShowContactModal] = React.useState(false);
  const [editingContact, setEditingContact] = React.useState<CrmContact | null>(null);
  const [isCreatingMainContact, setIsCreatingMainContact] = React.useState(false);
  const [selectedCompany, setSelectedCompany] = React.useState<any | null>(null);
  const [showCompanyModal, setShowCompanyModal] = React.useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contactsList = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['/api/crm/contacts', userId],
    queryFn: () => fetch(`/api/crm/contacts?ownerUserId=${userId}`).then(res => res.json()),
    enabled: !!userId,
  });

  // Check if main contact exists and create if needed
  React.useEffect(() => {
    if (contactsList && contactsList.length >= 0 && userId && !contactsLoading) {
      const hasMainContact = contactsList.some((contact: any) => 
        contact.relationship === "Self" || contact.tags?.includes("Main")
      );
      
      if (!hasMainContact && !createMainContactMutation.isPending) {
        // Auto-create main contact
        handleCreateMainContact();
      }
    }
  }, [contactsList, userId, contactsLoading]);

  const { data: companiesList = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['/api/crm/companies', userId],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/crm/companies?spaceId=1`);
        if (!res.ok) {
          console.warn('Companies API failed, returning empty array');
          return [];
        }
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.warn('Companies API error, returning empty array:', error);
        return [];
      }
    },
    enabled: !!userId,
  });

  const { data: upcomingDates = [] } = useQuery({
    queryKey: ['/api/crm/contacts/upcoming-dates', userId],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/crm/contacts/upcoming-dates?ownerUserId=${userId}`);
        if (!response.ok) {
          console.warn('Upcoming dates API failed, returning empty array');
          return [];
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.warn('Error fetching upcoming dates:', error);
        return [];
      }
    },
    enabled: !!userId,
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: number) => {
      return await apiRequest('DELETE', `/api/crm/contacts/${contactId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts'] });
      setEditingContact(null);
      toast({
        title: "Success",
        description: "Contact deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete contact",
        variant: "destructive",
      });
    },
  });

  // Create main contact mutation
  const createMainContactMutation = useMutation({
    mutationFn: async (mainContactData: any) => {
      return apiRequest('POST', '/api/crm/contacts/complete', mainContactData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts'] });
      setIsCreatingMainContact(false);
      toast({
        title: "Success",
        description: "Main contact created successfully! You can now link other contacts to yourself.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create main contact",
        variant: "destructive",
      });
    },
  });

  const handleCreateMainContact = () => {
    const mainContactData = {
      ownerUserId: userId,
      fullName: "Me (Main Contact)", // Clear indication this is the main contact
      relationship: "Self",
      tags: ["Main", "Self"],
      notes: "This is my main contact record - the central hub for linking all my CRM relationships and personal information.",
      profession: "",
      company: "",
      phones: [
        {
          phoneNumber: "",
          label: "Mobile",
          isPrimary: true,
          hasWhatsApp: false
        }
      ],
      emails: [
        {
          emailAddress: "",
          label: "Personal",
          isPrimary: true
        }
      ],
      addresses: [],
      aliases: [],
      specialDates: [],
      interests: [],
      companies: [],
      groups: [],
      relationships: []
    };
    
    createMainContactMutation.mutate(mainContactData);
  };

  const getInitials = (name: string) => {
    if (!name) return 'XX';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getFilteredContacts = () => {
    if (!Array.isArray(contactsList)) return [];
    if (!searchTerm) return contactsList;
    return contactsList.filter((contact: CrmContact) =>
      contact.fullName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const handleContactClick = (contact: CrmContact) => {
    console.log('Contact clicked:', contact);
    setSelectedContact(contact);
    setShowContactModal(true);
  };

  const handleEditContact = (contact: CrmContact) => {
    setEditingContact(contact);
    setShowContactModal(false);
  };

  const handleCloseEdit = () => {
    setEditingContact(null);
  };

  const handleUpdateContact = () => {
    // Refetch contacts after update
    window.location.reload(); // Simple refresh for now
  };

  const handleCompanyClick = (company: any) => {
    console.log('Company clicked:', company);
    setSelectedCompany(company);
    setShowCompanyModal(true);
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Contacts</h2>
          <p className="text-muted-foreground">
            Manage your contacts, companies, and relationships
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Dialog open={isAddContactOpen} onOpenChange={setIsAddContactOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Contact</DialogTitle>
              </DialogHeader>
              <ContactFormBlocks 
                ownerUserId={userId} 
                spaceId={selectedSpace?.id}
                onSuccess={() => setIsAddContactOpen(false)}
              />
            </DialogContent>
          </Dialog>
          <CompanyForm />
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="contacts">All Contacts</TabsTrigger>
              <TabsTrigger value="family">Family</TabsTrigger>
              <TabsTrigger value="clients">Clients</TabsTrigger>
              <TabsTrigger value="friends">Friends</TabsTrigger>
              <TabsTrigger value="companies">Companies</TabsTrigger>
              <TabsTrigger value="groups">Groups</TabsTrigger>
            </TabsList>

            {/* All Contacts Tab */}
            <TabsContent value="contacts" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    All Contacts ({getFilteredContacts().length})
                  </CardTitle>
                  <CardDescription>
                    Your complete contact directory
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {contactsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    </div>
                  ) : getFilteredContacts().length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No contacts found. Start by adding your first contact.</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[600px]">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {getFilteredContacts().map((contact: CrmContact) => {
                          const isMainContact = contact.relationship === "Self" || contact.tags?.includes("Main");
                          return (
                            <Card 
                              key={contact.contactId} 
                              className={`cursor-pointer hover:shadow-md transition-shadow ${
                                isMainContact ? 'border-2 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20' : ''
                              }`}
                              onClick={() => handleContactClick(contact)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                  <Avatar className="w-12 h-12">
                                    <AvatarFallback className={`${
                                      isMainContact 
                                        ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-300' 
                                        : 'bg-blue-100 text-blue-600'
                                    }`}>
                                      {getInitials(contact.fullName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    {/* Name with Checkmark and Main badge */}
                                    <div className="flex items-center gap-2 mb-1">
                                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                                        {contact.fullName}
                                      </h3>
                                      {isMainContact && (
                                        <Badge variant="secondary" className="bg-yellow-200 text-yellow-800 text-xs border-yellow-300">
                                          <Star className="w-3 h-3 mr-1" />
                                          Main
                                        </Badge>
                                      )}
                                      {contact.isWhatsappLinked && (
                                        <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                                      )}
                                    </div>

                                  {/* Profession and Company */}
                                  {(contact.profession || contact.company) && (
                                    <div className="mb-2">
                                      <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                                        {contact.profession && contact.company ? (
                                          `${contact.profession} en ${contact.company}`
                                        ) : contact.profession ? (
                                          contact.profession
                                        ) : contact.company ? (
                                          contact.company
                                        ) : null}
                                      </p>
                                    </div>
                                  )}

                                  {/* Description/Notes */}
                                  {contact.notes && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                                      {contact.notes}
                                    </p>
                                  )}

                                  {/* Tags below description */}
                                  {((contact.tags && contact.tags.length > 0) || contact.relationship) && (
                                    <div className="flex items-center flex-wrap gap-1">
                                      {/* Display individual tags if available */}
                                      {contact.tags && contact.tags.length > 0 ? (
                                        contact.tags.map((tag: string, index: number) => (
                                          <Badge key={index} variant="secondary" className="text-xs">
                                            {tag}
                                          </Badge>
                                        ))
                                      ) : (
                                        /* Fallback to old relationship field */
                                        contact.relationship && (
                                          <Badge variant="secondary" className="text-xs">
                                            {contact.relationship}
                                          </Badge>
                                        )
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Family Tab */}
            <TabsContent value="family" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="w-5 h-5" />
                    Family ({Array.isArray(contactsList) ? contactsList.filter((c: CrmContact) => c.relationship === "Family").length : 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-3">
                      {(Array.isArray(contactsList) ? contactsList.filter((c: CrmContact) => c.relationship === "Family") : []).map((contact: CrmContact) => (
                        <div
                          key={contact.contactId}
                          className="flex items-center p-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                          onClick={() => handleContactClick(contact)}
                        >
                          <Avatar className="w-12 h-12 mr-4">
                            <AvatarFallback className="bg-red-100 text-red-600">
                              {getInitials(contact.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            {/* Name with Checkmark */}
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold">{contact.fullName}</h3>
                              {contact.isWhatsappLinked && (
                                <Check className="w-4 h-4 text-green-600" />
                              )}
                            </div>
                            
                            {/* Description/Notes */}
                            {contact.notes && (
                              <p className="text-sm text-gray-600 mb-2">{contact.notes}</p>
                            )}
                            
                            {/* Tags */}
                            {contact.tags && contact.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {contact.tags.map((tag: string, index: number) => (
                                  <Badge key={index} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Clients Tab */}
            <TabsContent value="clients" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5" />
                    Clients ({Array.isArray(contactsList) ? contactsList.filter((c: CrmContact) => c.relationship === "Client").length : 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-3">
                      {(Array.isArray(contactsList) ? contactsList.filter((c: CrmContact) => c.relationship === "Client") : []).map((contact: CrmContact) => (
                        <div
                          key={contact.contactId}
                          className="flex items-center p-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                          onClick={() => handleContactClick(contact)}
                        >
                          <Avatar className="w-12 h-12 mr-4">
                            <AvatarFallback className="bg-blue-100 text-blue-600">
                              {getInitials(contact.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            {/* Name with Checkmark */}
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold">{contact.fullName}</h3>
                              {contact.isWhatsappLinked && (
                                <Check className="w-4 h-4 text-green-600" />
                              )}
                            </div>
                            
                            {/* Description/Notes */}
                            {contact.notes && (
                              <p className="text-sm text-gray-600 mb-2">{contact.notes}</p>
                            )}
                            
                            {/* Tags */}
                            {contact.tags && contact.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {contact.tags.map((tag: string, index: number) => (
                                  <Badge key={index} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Friends Tab */}
            <TabsContent value="friends" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="w-5 h-5" />
                    Friends ({Array.isArray(contactsList) ? contactsList.filter((c: CrmContact) => c.relationship === "Friend").length : 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-3">
                      {(Array.isArray(contactsList) ? contactsList.filter((c: CrmContact) => c.relationship === "Friend") : []).map((contact: CrmContact) => (
                        <div
                          key={contact.contactId}
                          className="flex items-center p-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                          onClick={() => handleContactClick(contact)}
                        >
                          <Avatar className="w-12 h-12 mr-4">
                            <AvatarFallback className="bg-green-100 text-green-600">
                              {getInitials(contact.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <h3 className="font-semibold">{contact.fullName}</h3>
                            {contact.notes && <p className="text-sm text-gray-600">{contact.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Companies Tab */}
            <TabsContent value="companies" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="w-5 h-5" />
                        Companies ({companiesList.length})
                      </CardTitle>
                      <CardDescription>
                        Manage your business relationships and company contacts
                      </CardDescription>
                    </div>
                    <CompanyForm />
                  </div>
                </CardHeader>
                <CardContent>
                  {companiesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    </div>
                  ) : companiesList.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No companies found. Start by adding your first company.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {companiesList.map((company: any) => (
                        <Card key={company.id} className="cursor-pointer hover:shadow-md transition-shadow"
                              onClick={() => handleCompanyClick(company)}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <Avatar className="w-12 h-12">
                                <AvatarFallback className="bg-blue-100 text-blue-600">
                                  <Building2 className="w-6 h-6" />
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                                  {company.name}
                                </h3>
                                {company.business_type && (
                                  <Badge variant="secondary" className="mt-1 text-xs">
                                    {company.business_type}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Groups Tab */}
            <TabsContent value="groups" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Contact Groups
                      </CardTitle>
                      <CardDescription>
                        Organize your contacts into custom groups for better management
                      </CardDescription>
                    </div>
                    <Button onClick={() => console.log('Create group')}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Group
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">Contact Groups</p>
                    <p className="text-sm mb-4">Create custom groups to organize your contacts efficiently</p>
                    <Button onClick={() => console.log('Create first group')} variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Group
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upcoming Events */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="w-5 h-5" />
                Upcoming Events
              </CardTitle>
              <CardDescription>
                Special dates in the next 30 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!Array.isArray(upcomingDates) || upcomingDates.length === 0 ? (
                <p className="text-sm text-gray-500">No upcoming events</p>
              ) : (
                <div className="space-y-3">
                  {upcomingDates.slice(0, 5).map((event: any) => (
                    <div key={`${event.contactId}-${event.eventName}`} className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                          <Heart className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {event.contactName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {event.eventName} • {new Date(event.eventDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Network Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Total Contacts</span>
                <span className="font-semibold">{contactsList.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Family</span>
                <span className="font-semibold">
                  {Array.isArray(contactsList) ? contactsList.filter((c: CrmContact) => c.relationship === "Family").length : 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Clients</span>
                <span className="font-semibold">
                  {Array.isArray(contactsList) ? contactsList.filter((c: CrmContact) => c.relationship === "Client").length : 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Friends</span>
                <span className="font-semibold">
                  {Array.isArray(contactsList) ? contactsList.filter((c: CrmContact) => c.relationship === "Friend").length : 0}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Contact Groups */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Groups</CardTitle>
              <CardDescription>
                Organize your contacts into custom groups
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Contact Groups feature coming soon</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Contact Detail Modal */}
      {selectedContact && !editingContact && (
        <ContactDetailView
          contact={selectedContact}
          interests={[]} 
          onClose={() => {
            setShowContactModal(false);
            setSelectedContact(null);
          }}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts'] });
          }}
          onEdit={(contact) => {
            setSelectedContact(null);
            setShowContactModal(false);
            setEditingContact(contact);
          }}
        />
      )}

      {/* Contact Edit Modal */}
      {editingContact && (
        <Dialog open={true} onOpenChange={() => setEditingContact(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Contact</DialogTitle>
            </DialogHeader>
            <ContactFormBlocks
              ownerUserId={editingContact.ownerUserId}
              spaceId={1}
              isEditMode={true}
              contactId={editingContact.contactId}
              initialData={{
                fullName: editingContact.fullName,
                relationship: editingContact.relationship || "",
                tags: editingContact.tags || [],
                profilePictureUrl: editingContact.profilePictureUrl || "",
                notes: editingContact.notes || "",
              }}
              onSuccess={() => {
                setEditingContact(null);
                queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts'] });
              }}
              onDelete={() => {
                if (editingContact.contactId) {
                  deleteContactMutation.mutate(editingContact.contactId);
                }
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Company Detail Modal */}
      {selectedCompany && (
        <CompanyDetailView
          company={selectedCompany}
          isOpen={showCompanyModal}
          onClose={() => {
            setShowCompanyModal(false);
            setSelectedCompany(null);
          }}
          spaceId={selectedSpace?.id || "default"}
        />
      )}
    </div>
  );
}