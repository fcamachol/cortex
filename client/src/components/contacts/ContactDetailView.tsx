import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { X, Edit, Phone, Mail, MapPin, Calendar, Building2, Users, Heart, Tag, Plus, ArrowRight, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import ContactForm from "./ContactForm";
import { apiRequest } from "@/lib/queryClient";
import type { ContactWithRelations } from "@shared/schema";

// Relationship form schema
const relationshipFormSchema = z.object({
  contactBId: z.number().min(1, "Contact is required"),
  relationshipAToB: z.string().min(1, "Relationship type is required"),
  relationshipBToA: z.string().optional(),
});

type RelationshipFormData = z.infer<typeof relationshipFormSchema>;

interface ContactDetailViewProps {
  contact: ContactWithRelations;
  interests: any[];
  onClose: () => void;
  onUpdate: () => void;
}

export default function ContactDetailView({ contact, interests, onClose, onUpdate }: ContactDetailViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: (data: any) => apiRequest('PUT', `/api/crm/contacts/${contact.contactId}`, data),
    onSuccess: () => {
      setIsEditing(false);
      onUpdate();
    },
  });

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: () => apiRequest('DELETE', `/api/crm/contacts/${contact.contactId}`),
    onSuccess: () => {
      onUpdate();
      onClose();
    },
  });

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleUpdate = (data: any) => {
    updateContactMutation.mutate(data);
  };

  if (isEditing) {
    return (
      <Dialog open={true} onOpenChange={() => setIsEditing(false)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          <ContactForm
            userId={contact.ownerUserId}
            interests={interests}
            initialData={{
              fullName: contact.fullName,
              relationship: contact.relationship || "",
              profilePictureUrl: contact.profilePictureUrl || "",
              notes: contact.notes || "",
              phones: contact.phones || [],
              emails: contact.emails || [],
              addresses: contact.addresses || [],
              aliases: contact.aliases || [],
              specialDates: contact.specialDates?.map(d => ({
                ...d,
                eventDate: new Date(d.eventDate).toISOString().split('T')[0]
              })) || [],
              interestIds: contact.interests?.map(i => i.interestId) || [],
            }}
            onSubmit={handleUpdate}
            onCancel={() => setIsEditing(false)}
            isLoading={updateContactMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">Contact Details</DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleEdit}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={contact.profilePictureUrl || ""} />
                  <AvatarFallback className="bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 text-lg">
                    {getInitials(contact.fullName)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {contact.fullName}
                    </h2>
                    {contact.relationship && (
                      <Badge className={getRelationshipColor(contact.relationship)}>
                        {contact.relationship}
                      </Badge>
                    )}
                  </div>
                  
                  {contact.aliases && contact.aliases.length > 0 && (
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Also known as: {contact.aliases.map(a => a.alias).join(', ')}
                      </span>
                    </div>
                  )}
                  
                  {contact.notes && (
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                      {contact.notes}
                    </p>
                  )}
                  
                  <p className="text-sm text-gray-500 mt-2">
                    Added {formatDate(contact.createdAt)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="contact" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="contact">Contact Info</TabsTrigger>
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="companies">Companies</TabsTrigger>
              <TabsTrigger value="groups">Groups</TabsTrigger>
              <TabsTrigger value="relationships">Relationships</TabsTrigger>
            </TabsList>

            {/* Contact Information Tab */}
            <TabsContent value="contact" className="space-y-4">
              {/* Phone Numbers */}
              {contact.phones && contact.phones.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Phone Numbers
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {contact.phones.map((phone, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{phone.phoneNumber}</span>
                              {phone.isPrimary && (
                                <Badge variant="secondary" className="text-xs">Primary</Badge>
                              )}
                              {phone.isWhatsappLinked && (
                                <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                                  WhatsApp
                                </Badge>
                              )}
                            </div>
                            {phone.label && (
                              <span className="text-sm text-gray-500">{phone.label}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Email Addresses */}
              {contact.emails && contact.emails.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email Addresses
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {contact.emails.map((email, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{email.emailAddress}</span>
                              {email.isPrimary && (
                                <Badge variant="secondary" className="text-xs">Primary</Badge>
                              )}
                            </div>
                            {email.label && (
                              <span className="text-sm text-gray-500">{email.label}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Addresses */}
              {contact.addresses && contact.addresses.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Addresses
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {contact.addresses.map((address, index) => (
                        <div key={index} className="space-y-1">
                          <div className="flex items-center gap-2">
                            {address.label && (
                              <Badge variant="outline">{address.label}</Badge>
                            )}
                            {address.isPrimary && (
                              <Badge variant="secondary" className="text-xs">Primary</Badge>
                            )}
                          </div>
                          <div className="text-sm">
                            {address.street && <div>{address.street}</div>}
                            <div>
                              {[address.city, address.state, address.postalCode]
                                .filter(Boolean)
                                .join(', ')}
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

            {/* Personal Information Tab */}
            <TabsContent value="personal" className="space-y-4">
              {/* Special Dates */}
              {contact.specialDates && contact.specialDates.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Special Dates
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {contact.specialDates.map((date, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                              <Heart className="w-4 h-4 text-red-600 dark:text-red-400" />
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{date.eventName}</div>
                            <div className="text-sm text-gray-500">
                              {formatDate(date.eventDate)}
                              {date.reminderDaysBefore > 0 && (
                                <span className="ml-2">
                                  (Reminder: {date.reminderDaysBefore} days before)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Interests */}
              {contact.interests && contact.interests.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Interests & Hobbies</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {contact.interests.map((interest, index) => (
                        <Badge key={index} variant="secondary">
                          {interest.interest.name}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Companies Tab */}
            <TabsContent value="companies" className="space-y-4">
              {contact.companyMemberships && contact.companyMemberships.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Company Affiliations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {contact.companyMemberships.map((membership, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                          <Building2 className="w-5 h-5 text-blue-600 mt-1" />
                          <div className="flex-1">
                            <div className="font-medium">{membership.company.companyName}</div>
                            {membership.role && (
                              <div className="text-sm text-gray-600">{membership.role}</div>
                            )}
                            <div className="text-xs text-gray-500 mt-1">
                              {membership.startDate && `Started: ${formatDate(membership.startDate)}`}
                              {membership.endDate && ` • Ended: ${formatDate(membership.endDate)}`}
                              {membership.isCurrent && (
                                <Badge variant="secondary" className="ml-2 text-xs">Current</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center text-gray-500">
                      No company affiliations recorded
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Groups Tab */}
            <TabsContent value="groups" className="space-y-4">
              {contact.groupMemberships && contact.groupMemberships.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Contact Groups
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {contact.groupMemberships.map((membership, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                          <div className="text-2xl">{membership.group.groupIcon || '👥'}</div>
                          <div className="flex-1">
                            <div className="font-medium">{membership.group.groupName}</div>
                            {membership.group.groupDescription && (
                              <div className="text-sm text-gray-600">{membership.group.groupDescription}</div>
                            )}
                            {membership.roleInGroup && (
                              <div className="text-xs text-gray-500 mt-1">
                                Role: {membership.roleInGroup}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center text-gray-500">
                      Not a member of any contact groups
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Relationships Tab */}
            <TabsContent value="relationships" className="space-y-4">
              {contact.relationshipsAsA && contact.relationshipsAsA.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Personal Relationships</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {contact.relationshipsAsA.map((relationship, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                              {getInitials(relationship.contactB.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="font-medium">{relationship.contactB.fullName}</div>
                            <div className="text-sm text-gray-600">
                              {relationship.relationshipType}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center text-gray-500">
                      No personal relationships recorded
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {/* Danger Zone */}
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader>
              <CardTitle className="text-red-600 dark:text-red-400">Danger Zone</CardTitle>
              <CardDescription>
                Permanently delete this contact and all associated data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm(`Are you sure you want to delete ${contact.fullName}? This action cannot be undone.`)) {
                    deleteContactMutation.mutate();
                  }
                }}
                disabled={deleteContactMutation.isPending}
              >
                {deleteContactMutation.isPending ? "Deleting..." : "Delete Contact"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}