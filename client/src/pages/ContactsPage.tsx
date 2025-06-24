import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Users, Heart, Star, Building2, Briefcase } from "lucide-react";
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
import { CompanyForm } from "@/components/contacts/CompanyForm";

interface ContactsPageProps {
  userId: string;
  selectedSpace?: any;
}

export default function ContactsPage({ userId, selectedSpace }: ContactsPageProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [activeTab, setActiveTab] = React.useState("contacts");
  const [isAddContactOpen, setIsAddContactOpen] = React.useState(false);

  const { data: contactsList = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['/api/crm/contacts', userId],
    queryFn: () => fetch(`/api/crm/contacts?ownerUserId=${userId}`).then(res => res.json()),
    enabled: !!userId,
  });

  const { data: companiesList = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['/api/crm/companies', userId],
    queryFn: () => fetch(`/api/crm/companies?spaceId=1`).then(res => res.json()),
    enabled: !!userId,
  });

  const { data: upcomingDates = [] } = useQuery({
    queryKey: ['/api/crm/contacts/upcoming-dates', userId],
    queryFn: () => fetch(`/api/crm/contacts/upcoming-dates?ownerUserId=${userId}`).then(res => res.json()),
    enabled: !!userId,
  });

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getFilteredContacts = () => {
    if (!searchTerm) return contactsList;
    return contactsList.filter((contact: CrmContact) =>
      contact.fullName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const handleContactClick = (contact: CrmContact) => {
    console.log('Contact clicked:', contact);
    // TODO: Implement contact detail view
  };

  const handleCompanyClick = (company: any) => {
    console.log('Company clicked:', company);
    // TODO: Implement company detail view
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
                        {getFilteredContacts().map((contact: CrmContact) => (
                          <Card key={contact.contactId} className="cursor-pointer hover:shadow-md transition-shadow"
                                onClick={() => handleContactClick(contact)}>
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <Avatar className="w-12 h-12">
                                  <AvatarFallback className="bg-blue-100 text-blue-600">
                                    {getInitials(contact.fullName)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                                    {contact.fullName}
                                  </h3>
                                  {contact.relationship && (
                                    <Badge variant="secondary" className="mt-1 text-xs">
                                      {contact.relationship}
                                    </Badge>
                                  )}
                                  {contact.notes && (
                                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                      {contact.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
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
                    Family ({contactsList.filter((c: CrmContact) => c.relationship === "Family").length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-3">
                      {contactsList.filter((c: CrmContact) => c.relationship === "Family").map((contact: CrmContact) => (
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

            {/* Clients Tab */}
            <TabsContent value="clients" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5" />
                    Clients ({contactsList.filter((c: CrmContact) => c.relationship === "Client").length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-3">
                      {contactsList.filter((c: CrmContact) => c.relationship === "Client").map((contact: CrmContact) => (
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

            {/* Friends Tab */}
            <TabsContent value="friends" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="w-5 h-5" />
                    Friends ({contactsList.filter((c: CrmContact) => c.relationship === "Friend").length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-3">
                      {contactsList.filter((c: CrmContact) => c.relationship === "Friend").map((contact: CrmContact) => (
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
                        <Card key={company.companyId} className="cursor-pointer hover:shadow-md transition-shadow"
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
                                  {company.companyName}
                                </h3>
                                {company.businessType && (
                                  <Badge variant="secondary" className="mt-1 text-xs">
                                    {company.businessType}
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
    </div>
  );
}