import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { X, Edit, Phone, Mail, MapPin, Calendar, Building2, Users, Heart, Tag, Plus, ArrowRight, Trash2, Check, ChevronDown, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import ContactForm from "./ContactForm";
import ContactFormBlocks from "./ContactFormBlocks";
import { apiRequest } from "@/lib/queryClient";
import type { ContactWithRelations } from "@shared/schema";

// Relationship form schema
const relationshipFormSchema = z.object({
  contactBId: z.number().min(1, "Please select a contact"),
  relationshipAToB: z.string().min(1, "Please specify the relationship"),
  relationshipBToA: z.string().optional(),
});

type RelationshipFormData = z.infer<typeof relationshipFormSchema>;

interface ContactDetailViewProps {
  contact: ContactWithRelations;
  interests: any[];
  onClose: () => void;
  onUpdate: () => void;
  onEdit?: (contact: ContactWithRelations) => void;
}

export default function ContactDetailView({ contact, interests, onClose, onUpdate, onEdit }: ContactDetailViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingRelationship, setIsAddingRelationship] = useState(false);
  const [editingRelationshipId, setEditingRelationshipId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isContactInfoOpen, setIsContactInfoOpen] = useState(true);
  const [isRelationshipsOpen, setIsRelationshipsOpen] = useState(true);
  const [isPersonalDetailsOpen, setIsPersonalDetailsOpen] = useState(true);
  const queryClient = useQueryClient();

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  // Fetch full contact details including phones with WhatsApp linking info
  const { data: fullContactDetails, isLoading: isLoadingDetails, error } = useQuery({
    queryKey: [`/api/crm/contacts/${contact.contactId}/details`],
    staleTime: 0, // Disable caching temporarily for debugging
    cacheTime: 0,
  });

  // Debug logging
  console.log('ContactDetailView fullContactDetails:', fullContactDetails);
  console.log('ContactDetailView isLoadingDetails:', isLoadingDetails);

  // Fetch related contacts for relationship creation
  const { data: allContacts } = useQuery({
    queryKey: ['/api/crm/contacts'],
    queryFn: () => apiRequest('GET', '/api/crm/contacts'),
    staleTime: 30000,
  });

  // Fetch relationships for this contact
  const { data: relationships } = useQuery({
    queryKey: ['/api/crm/contact-relationships', contact.contactId],
    queryFn: () => apiRequest('GET', `/api/crm/contact-relationships?contactId=${contact.contactId}`),
    staleTime: 30000,
  });

  // Fetch related tasks for this contact
  const { data: relatedTasks } = useQuery({
    queryKey: [`/api/crm/contacts/${contact.contactId}/tasks`],
    staleTime: 30000,
  });

  // Fetch related events for this contact
  const { data: relatedEvents } = useQuery({
    queryKey: [`/api/crm/contacts/${contact.contactId}/events`],
    staleTime: 30000,
  });

  // Fetch related finance records for this contact
  const { data: relatedFinance } = useQuery({
    queryKey: [`/api/crm/contacts/${contact.contactId}/finance`],
    staleTime: 30000,
  });

  // Fetch related notes for this contact
  const { data: relatedNotes } = useQuery({
    queryKey: [`/api/crm/contacts/${contact.contactId}/notes`],
    staleTime: 30000,
  });

  // Delete contact mutation
  const deleteContactMutation = useMutation({
    mutationFn: (contactId: number) => apiRequest('DELETE', `/api/crm/contacts/${contactId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts'] });
      onClose();
    },
  });

  // Update contact mutation
  const updateContactMutation = useMutation({
    mutationFn: (data: any) => apiRequest('PUT', `/api/crm/contacts/${contact.contactId}`, data),
    onSuccess: () => {
      setIsEditing(false);
      onUpdate();
    },
  });

  // Create relationship mutation
  const createRelationshipMutation = useMutation({
    mutationFn: (data: RelationshipFormData) => apiRequest('POST', '/api/crm/contact-relationships', {
      ...data,
      contactAId: contact.contactId,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contact-relationships', contact.contactId] });
      setIsAddingRelationship(false);
      relationshipForm.reset();
    },
  });

  // Update relationship mutation
  const updateRelationshipMutation = useMutation({
    mutationFn: ({ relationshipId, data }: { relationshipId: number; data: RelationshipFormData }) => 
      apiRequest('PUT', `/api/crm/contact-relationships/${relationshipId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contact-relationships', contact.contactId] });
      setEditingRelationshipId(null);
    },
  });

  // Delete relationship mutation
  const deleteRelationshipMutation = useMutation({
    mutationFn: (relationshipId: number) => 
      apiRequest('DELETE', `/api/crm/contact-relationships/${relationshipId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contact-relationships', contact.contactId] });
    },
  });

  // Relationship form
  const relationshipForm = useForm<RelationshipFormData>({
    resolver: zodResolver(relationshipFormSchema),
    defaultValues: {
      contactBId: 0,
      relationshipAToB: "",
      relationshipBToA: "",
    },
  });

  const handleCreateRelationship = (data: RelationshipFormData) => {
    createRelationshipMutation.mutate(data);
  };

  const handleUpdateRelationship = (data: RelationshipFormData) => {
    if (editingRelationshipId) {
      updateRelationshipMutation.mutate({ relationshipId: editingRelationshipId, data });
    }
  };

  const handleEditRelationship = (relationship: any) => {
    setEditingRelationshipId(relationship.relationshipId);
    relationshipForm.reset({
      contactBId: relationship.contactBId,
      relationshipAToB: relationship.relationshipAToB || "",
      relationshipBToA: relationship.relationshipBToA || "",
    });
  };

  const handleDeleteRelationship = (relationshipId: number) => {
    deleteRelationshipMutation.mutate(relationshipId);
  };

  const handleCancelRelationshipEdit = () => {
    setEditingRelationshipId(null);
    setIsAddingRelationship(false);
    relationshipForm.reset();
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleEdit = () => {
    onClose();
    if (onEdit) {
      onEdit(contact);
    }
  };

  const handleDeleteContact = () => {
    deleteContactMutation.mutate(contact.contactId);
  };

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
              <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Card - Contact Bubble Style */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={contact.profilePictureUrl || ""} />
                  <AvatarFallback className="bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 text-lg">
                    {getInitials(contact.fullName)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1">
                  {/* Name with Checkmark */}
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {contact.fullName}
                    </h2>
                    {contact.isWhatsappLinked && (
                      <Check className="w-5 h-5 text-green-600" />
                    )}
                  </div>

                  {/* Profession and Company */}
                  {(contact.profession || contact.company) && (
                    <div className="mb-3">
                      <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
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
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
                      {contact.notes.trim()}
                    </p>
                  )}

                  {/* Tags below description */}
                  {contact.tags && contact.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.map((tag, index) => (
                        <span key={index} className="text-sm text-gray-700 bg-gray-100 px-2 py-1 rounded dark:bg-gray-700 dark:text-gray-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Details - Additional Information */}
          {fullContactDetails && (
            <Card>
              <CardContent className="p-6 space-y-4">
                {/* Phone Numbers */}
                {fullContactDetails.phones && fullContactDetails.phones.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Phone Numbers
                  </h4>
                  <div className="space-y-1">
                    {fullContactDetails.phones.map((phone, index) => (
                      <div key={index} className="text-sm">
                        <span className="text-gray-900 dark:text-gray-100">{phone.phoneNumber}</span>
                        {phone.label && <span className="text-gray-500 ml-2">({phone.label})</span>}
                        {phone.isPrimary && <span className="text-green-600 ml-2">Primary</span>}
                        {phone.isWhatsappLinked && <span className="text-green-600 ml-2">✓ WhatsApp</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Email Addresses */}
              {fullContactDetails?.emails && fullContactDetails.emails.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email Addresses
                  </h4>
                  <div className="space-y-1">
                    {fullContactDetails.emails.map((email, index) => (
                      <div key={index} className="text-sm">
                        <span className="text-gray-900 dark:text-gray-100">{email.emailAddress}</span>
                        {email.label && <span className="text-gray-500 ml-2">({email.label})</span>}
                        {email.isPrimary && <span className="text-green-600 ml-2">Primary</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Addresses */}
              {fullContactDetails?.addresses && fullContactDetails.addresses.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Addresses
                  </h4>
                  <div className="space-y-1">
                    {fullContactDetails.addresses.map((address, index) => (
                      <div key={index} className="text-sm">
                        <span className="text-gray-900 dark:text-gray-100">
                          {address.streetAddress}
                          {address.city && `, ${address.city}`}
                          {address.state && `, ${address.state}`}
                          {address.postalCode && ` ${address.postalCode}`}
                        </span>
                        {address.label && <span className="text-gray-500 ml-2">({address.label})</span>}
                        {address.isPrimary && <span className="text-green-600 ml-2">Primary</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Companies */}
              {fullContactDetails?.companies && fullContactDetails.companies.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Companies
                  </h4>
                  <div className="space-y-1">
                    {fullContactDetails.companies.map((company, index) => (
                      <div key={index} className="text-sm">
                        <span className="text-gray-900 dark:text-gray-100">{company.company.name}</span>
                        {company.position && <span className="text-gray-500 ml-2">- {company.position}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Special Dates */}
              {fullContactDetails?.specialDates && fullContactDetails.specialDates.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Special Dates
                  </h4>
                  <div className="space-y-1">
                    {fullContactDetails.specialDates.map((date, index) => {
                      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      const formattedDate = `${monthNames[date.eventMonth - 1]} ${date.eventDay}${date.originalYear ? `, ${date.originalYear}` : ''}`;
                      const categoryIcon = date.category === 'birthday' ? '🎂' : date.category === 'anniversary' ? '💕' : '📅';
                      
                      return (
                        <div key={index} className="text-sm">
                          <span className="text-gray-900 dark:text-gray-100">
                            {categoryIcon} {date.eventName}: {formattedDate}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Interests */}
              {fullContactDetails?.interests && fullContactDetails.interests.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <Heart className="w-4 h-4" />
                    Interests
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {fullContactDetails.interests.map((interest, index) => (
                      <span key={index} className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-700 dark:text-gray-300">
                        {interest.interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Contact Relationships */}
              {fullContactDetails?.relationships && fullContactDetails.relationships.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Relationships
                  </h4>
                  <div className="space-y-1">
                    {fullContactDetails.relationships.map((relationship, index) => (
                      <div key={index} className="text-sm">
                        <span className="text-gray-900 dark:text-gray-100">
                          {relationship.relatedContact?.fullName} ({relationship.relationshipType})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Groups */}
              {fullContactDetails?.groups && fullContactDetails.groups.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Groups
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {fullContactDetails.groups.map((group, index) => (
                      <span key={index} className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-700 dark:text-gray-300">
                        {group.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}


              </CardContent>
            </Card>
          )}

          {/* Activity Section */}
          <Tabs defaultValue="tasks" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
              <TabsTrigger value="finance">Finance</TabsTrigger>
              <TabsTrigger value="notes">Notes & Docs</TabsTrigger>
            </TabsList>

            <TabsContent value="tasks" className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  {relatedTasks && relatedTasks.length > 0 ? (
                    <div className="space-y-3">
                      {relatedTasks.map((task: any) => (
                        <div key={task.taskId} className="border rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900 dark:text-gray-100">{task.title}</h4>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              task.status === 'done' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                              task.status === 'in_progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                            }`}>
                              {task.status?.replace('_', ' ')}
                            </span>
                          </div>
                          {task.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{task.description}</p>
                          )}
                          {task.dueDate && (
                            <p className="text-xs text-gray-500">Due: {formatDate(task.dueDate)}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500">
                      No tasks linked to this contact yet
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="events" className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  {relatedEvents && relatedEvents.length > 0 ? (
                    <div className="space-y-3">
                      {relatedEvents.map((event: any) => (
                        <div key={event.eventId} className="border rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900 dark:text-gray-100">{event.title}</h4>
                            <span className="text-xs text-gray-500">
                              {event.isAllDay ? 'All Day' : formatDate(event.startTime)}
                            </span>
                          </div>
                          {event.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{event.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            {event.location && (
                              <span>📍 {event.location}</span>
                            )}
                            {event.attendees && event.attendees.length > 0 && (
                              <span>👥 {event.attendees.length} attendees</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500">
                      No events scheduled with this contact
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="finance" className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  {relatedFinance && relatedFinance.length > 0 ? (
                    <div className="space-y-3">
                      {relatedFinance.map((record: any) => (
                        <div key={record.id} className="border rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900 dark:text-gray-100">
                              {record.type === 'payable' ? '💳' : record.type === 'loan' ? '🏦' : '💰'} {record.description || record.title}
                            </h4>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              record.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                              record.status === 'overdue' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                              'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            }`}>
                              {record.status}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                            <span>Amount: ${record.amount}</span>
                            {record.dueDate && (
                              <span>Due: {formatDate(record.dueDate)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500">
                      No financial records for this contact
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  {relatedNotes && relatedNotes.length > 0 ? (
                    <div className="space-y-3">
                      {relatedNotes.map((note: any) => (
                        <div key={note.noteId} className="border rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900 dark:text-gray-100">
                              📝 {note.title || 'Untitled Note'}
                            </h4>
                            <span className="text-xs text-gray-500">
                              {formatDate(note.createdAt)}
                            </span>
                          </div>
                          {note.content && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-3">
                              {note.content.substring(0, 150)}...
                            </p>
                          )}
                          {note.tags && note.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {note.tags.map((tag: string, index: number) => (
                                <span key={index} className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-700 dark:text-gray-300">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500">
                      No notes or documents for this contact yet
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Contact</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this contact? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteContact}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}