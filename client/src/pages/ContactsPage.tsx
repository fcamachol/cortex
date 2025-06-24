import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Users, Building2, Calendar, Heart, MapPin, Phone, Mail, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import ContactForm from "@/components/contacts/ContactForm";
import ContactDetailView from "@/components/contacts/ContactDetailView";
import ContactGroupsManager from "@/components/contacts/ContactGroupsManager";
import CompanyForm from "@/components/contacts/CompanyForm";
import CompanyDetailView from "@/components/contacts/CompanyDetailView";
import { apiRequest } from "@/lib/queryClient";
import type { CrmContact, ContactWithRelations } from "@shared/schema";

interface ContactsPageProps {
  userId: string;
}

export default function ContactsPage({ userId }: ContactsPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContact, setSelectedContact] = useState<ContactWithRelations | null>(null);
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);
  const [isCompanyFormOpen, setIsCompanyFormOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("all");
  
  const queryClient = useQueryClient();

  // Fetch all contacts
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['/api/crm/contacts', userId],
    queryFn: () => apiRequest('GET', `/api/crm/contacts?ownerUserId=${userId}`),
    staleTime: 30000,
  });

  // Ensure contacts is always an array
  const contactsList = Array.isArray(contacts) ? contacts : [];

  // Fetch companies
  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['/api/crm/companies', userId],
    queryFn: () => apiRequest('GET', `/api/crm/companies?spaceId=${userId}`),
    staleTime: 30000,
  });

  // Ensure companies is always an array
  const companiesList = Array.isArray(companies) ? companies : [];

  // Fetch upcoming special dates
  const { data: upcomingDates = [] } = useQuery({
    queryKey: ['/api/crm/contacts/upcoming-dates', userId],
    queryFn: () => apiRequest('GET', `/api/crm/contacts/upcoming-dates?ownerUserId=${userId}&days=30`),
    staleTime: 60000,
  });

  // Fetch interests
  const { data: interests = [] } = useQuery({
    queryKey: ['/api/crm/interests'],
    queryFn: () => apiRequest('GET', '/api/crm/interests'),
    staleTime: 300000, // 5 minutes
  });

  // Search contacts
  const { data: searchResults = [] } = useQuery({
    queryKey: ['/api/crm/contacts/search', userId, searchTerm],
    queryFn: () => apiRequest('GET', `/api/crm/contacts/search?ownerUserId=${userId}&q=${searchTerm}`),
    enabled: searchTerm.length >= 2,
    staleTime: 10000,
  });

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: (contactData: any) => apiRequest('POST', '/api/crm/contacts', contactData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts', userId] });
      setIsContactFormOpen(false);
    },
  });

  // Company mutations
  const createCompanyMutation = useMutation({
    mutationFn: (companyData: any) => apiRequest('POST', '/api/crm/companies', companyData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/companies', userId] });
      setIsCompanyFormOpen(false);
    },
  });

  const handleCompanyClick = async (company: any) => {
    try {
      const fullCompany = await apiRequest('GET', `/api/crm/companies/${company.companyId}`);
      setSelectedCompany(fullCompany);
    } catch (error) {
      console.error('Error fetching company details:', error);
    }
  };

  // Filter contacts based on active tab
  const getFilteredContacts = () => {
    const dataToFilter = searchTerm.length >= 2 ? searchResults : contactsList;
    
    // Ensure we have an array
    if (!Array.isArray(dataToFilter)) {
      return [];
    }
    
    switch (activeTab) {
      case "family":
        return dataToFilter.filter((c: CrmContact) => c.relationship === "Family");
      case "clients":
        return dataToFilter.filter((c: CrmContact) => c.relationship === "Client");
      case "friends":
        return dataToFilter.filter((c: CrmContact) => c.relationship === "Friend");
      default:
        return dataToFilter;
    }
  };

  const handleContactClick = async (contact: CrmContact) => {
    try {
      const fullContact = await apiRequest('GET', `/api/crm/contacts/${contact.contactId}/details`);
      setSelectedContact(fullContact);
    } catch (error) {
      console.error('Error fetching contact details:', error);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRelationshipColor = (relationship: string) => {
    switch (relationship) {
      case "Family": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "Client": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "Friend": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Contacts</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your network with 360-degree intelligence
          </p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={isContactFormOpen} onOpenChange={setIsContactFormOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Contact</DialogTitle>
                <DialogDescription>
                  Create a comprehensive contact profile with full details
                </DialogDescription>
              </DialogHeader>
              <ContactForm
                userId={userId}
                interests={interests}
                onSubmit={(data) => createContactMutation.mutate({ ...data, ownerUserId: userId })}
                onCancel={() => setIsContactFormOpen(false)}
                isLoading={createContactMutation.isPending}
              />
            </DialogContent>
          </Dialog>
          
          <Button variant="outline" onClick={() => setIsCompanyFormOpen(true)}>
            <Building2 className="w-4 h-4 mr-2" />
            Add Company
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Search contacts by name or nickname..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="space-y-6">
        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-6 w-full max-w-2xl">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="family">Family</TabsTrigger>
            <TabsTrigger value="clients">Clients</TabsTrigger>
            <TabsTrigger value="friends">Friends</TabsTrigger>
            <TabsTrigger value="companies">Companies</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
          </TabsList>

          {/* Contacts Tab Content */}
          <TabsContent value="all" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  All Contacts ({contactsList.length})
                </CardTitle>
              </CardHeader>
            
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading contacts...</div>
              ) : getFilteredContacts().length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm ? "No contacts found" : "No contacts yet"}
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-3">
                    {getFilteredContacts().map((contact: CrmContact) => (
                      <div
                        key={contact.contactId}
                        className="flex items-center p-4 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                        onClick={() => handleContactClick(contact)}
                      >
                        <Avatar className="w-12 h-12 mr-4">
                          <AvatarImage src={contact.profilePictureUrl || ""} />
                          <AvatarFallback className="bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                            {getInitials(contact.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {contact.fullName}
                            </h3>
                            {contact.relationship && (
                              <Badge variant="secondary" className={getRelationshipColor(contact.relationship)}>
                                {contact.relationship}
                              </Badge>
                            )}
                          </div>
                          {contact.notes && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 truncate mt-1">
                              {contact.notes}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            Added {new Date(contact.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2 text-gray-400">
                          <Phone className="w-4 h-4" />
                          <Mail className="w-4 h-4" />
                          <MapPin className="w-4 h-4" />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upcoming Events */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Upcoming Events
              </CardTitle>
              <CardDescription>
                Special dates in the next 30 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingDates.length === 0 ? (
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
                  {contactsList.filter((c: CrmContact) => c.relationship === "Family").length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Clients</span>
                <span className="font-semibold">
                  {contactsList.filter((c: CrmContact) => c.relationship === "Client").length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Friends</span>
                <span className="font-semibold">
                  {contactsList.filter((c: CrmContact) => c.relationship === "Friend").length}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Contact Groups */}
          <ContactGroupsManager userId={userId} />
        </div>
      </div>

      {/* Contact Detail Modal */}
      {selectedContact && (
        <ContactDetailView
          contact={selectedContact}
          interests={interests}
          onClose={() => setSelectedContact(null)}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts', userId] });
            setSelectedContact(null);
          }}
        />
      )}

      <CompanyForm
        isOpen={isCompanyFormOpen}
        onClose={() => setIsCompanyFormOpen(false)}
        spaceId={userId}
      />

      <CompanyDetailView
        company={selectedCompany}
        isOpen={!!selectedCompany}
        onClose={() => setSelectedCompany(null)}
        spaceId={userId}
      />
    </div>
  );
}