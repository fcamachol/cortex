import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, MessageCircle, Star, MoreVertical, Phone, Mail, MapPin } from "lucide-react";
import ContactForm from "@/components/forms/contact-form";

export default function ContactModule() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Mock user ID - in real app this would come from auth context
  const userId = "7804247f-3ae8-4eb2-8c6d-2c44f967ad42";

  const { data: contacts = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/contacts/${userId}`, searchQuery],
  });

  const filteredContacts = contacts.filter((contact: any) => {
    const matchesSearch = contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         contact.phone?.includes(searchQuery);
    
    if (filterType === "all") return matchesSearch;
    // Add more filter logic here based on contact properties
    return matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center text-gray-500 dark:text-gray-400">
            Loading contacts...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Contacts</h1>
          <Button 
            className="bg-green-500 hover:bg-green-600 text-white"
            onClick={() => setIsFormOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center space-x-4 mb-6">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search contacts..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Contacts</SelectItem>
              <SelectItem value="favorites">Favorites</SelectItem>
              <SelectItem value="business">Business</SelectItem>
              <SelectItem value="personal">Personal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Contacts Grid */}
        {filteredContacts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No contacts found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {searchQuery ? "No contacts match your search" : "Add your first contact to get started"}
            </p>
            <Button 
              className="bg-green-500 hover:bg-green-600 text-white"
              onClick={() => setIsFormOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Contact
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredContacts.map((contact: any) => (
              <div key={contact.id} className="contact-card">
                <div className="flex items-center justify-between mb-4">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={contact.avatar} />
                    <AvatarFallback className="text-xl">
                      {contact.name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="sm">
                      <Star className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="text-center mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    {contact.name || 'Unknown Contact'}
                  </h3>
                  {contact.jobTitle && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {contact.jobTitle}
                    </p>
                  )}
                  {contact.company && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {contact.company}
                    </p>
                  )}
                </div>
                
                <div className="space-y-2 mb-4">
                  {contact.phone && (
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
                        {contact.phone}
                      </span>
                    </div>
                  )}
                  {contact.email && (
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
                        {contact.email}
                      </span>
                    </div>
                  )}
                  {contact.address && (
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
                        {contact.address}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button className="flex-1 bg-green-500 hover:bg-green-600 text-white" size="sm">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Chat
                  </Button>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <ContactForm
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          userId={userId}
        />
      </div>
    </div>
  );
}
