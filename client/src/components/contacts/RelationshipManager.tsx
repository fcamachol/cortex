import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, Edit, Trash2, Search, ArrowRight, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";

const relationshipFormSchema = z.object({
  contactAId: z.number().min(1, "First contact is required"),
  contactBId: z.number().min(1, "Second contact is required"),
  relationshipAToB: z.string().min(1, "Relationship type is required"),
  relationshipBToA: z.string().optional(),
});

type RelationshipFormData = z.infer<typeof relationshipFormSchema>;

interface RelationshipManagerProps {
  userId: string;
}

export default function RelationshipManager({ userId }: RelationshipManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRelationship, setEditingRelationship] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContactA, setSelectedContactA] = useState<any>(null);
  const [selectedContactB, setSelectedContactB] = useState<any>(null);
  
  const queryClient = useQueryClient();

  // Fetch all contacts for relationship selection
  const { data: contacts = [] } = useQuery({
    queryKey: ['/api/crm/contacts', userId],
    queryFn: () => apiRequest('GET', `/api/crm/contacts?ownerUserId=${userId}`),
    staleTime: 30000,
  });

  // Fetch all relationships
  const { data: relationships = [], isLoading } = useQuery({
    queryKey: ['/api/crm/contact-relationships', userId],
    queryFn: () => apiRequest('GET', `/api/crm/contact-relationships?ownerUserId=${userId}`),
    staleTime: 30000,
  });

  // Create relationship mutation
  const createRelationshipMutation = useMutation({
    mutationFn: (data: RelationshipFormData) => apiRequest('POST', '/api/crm/contact-relationships', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contact-relationships', userId] });
      setIsCreateDialogOpen(false);
      setSelectedContactA(null);
      setSelectedContactB(null);
      createForm.reset();
    },
  });

  // Update relationship mutation
  const updateRelationshipMutation = useMutation({
    mutationFn: ({ relationshipId, data }: { relationshipId: string; data: RelationshipFormData }) => 
      apiRequest('PUT', `/api/crm/contact-relationships/${relationshipId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contact-relationships', userId] });
      setEditingRelationship(null);
      editForm.reset();
    },
  });

  // Delete relationship mutation
  const deleteRelationshipMutation = useMutation({
    mutationFn: (relationshipId: string) => apiRequest('DELETE', `/api/crm/contact-relationships/${relationshipId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contact-relationships', userId] });
    },
  });

  // Forms
  const createForm = useForm<RelationshipFormData>({
    resolver: zodResolver(relationshipFormSchema),
    defaultValues: {
      contactAId: 0,
      contactBId: 0,
      relationshipAToB: "",
      relationshipBToA: "",
    },
  });

  const editForm = useForm<RelationshipFormData>({
    resolver: zodResolver(relationshipFormSchema),
    defaultValues: {
      contactAId: 0,
      contactBId: 0,
      relationshipAToB: "",
      relationshipBToA: "",
    },
  });

  const relationshipTypes = [
    { value: "Parent", reciprocal: "Child" },
    { value: "Child", reciprocal: "Parent" },
    { value: "Spouse", reciprocal: "Spouse" },
    { value: "Sibling", reciprocal: "Sibling" },
    { value: "Friend", reciprocal: "Friend" },
    { value: "Colleague", reciprocal: "Colleague" },
    { value: "Business Partner", reciprocal: "Business Partner" },
    { value: "Manager", reciprocal: "Employee" },
    { value: "Employee", reciprocal: "Manager" },
    { value: "Client", reciprocal: "Service Provider" },
    { value: "Service Provider", reciprocal: "Client" },
    { value: "Mentor", reciprocal: "Mentee" },
    { value: "Mentee", reciprocal: "Mentor" },
    { value: "Relative", reciprocal: "Relative" },
    { value: "Neighbor", reciprocal: "Neighbor" },
    { value: "Acquaintance", reciprocal: "Acquaintance" },
  ];

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRelationshipColor = (relationship: string) => {
    const familyTypes = ["Parent", "Child", "Spouse", "Sibling", "Relative"];
    const businessTypes = ["Colleague", "Business Partner", "Manager", "Employee", "Client", "Service Provider"];
    const personalTypes = ["Friend", "Mentor", "Mentee", "Neighbor", "Acquaintance"];

    if (familyTypes.includes(relationship)) {
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    }
    if (businessTypes.includes(relationship)) {
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    }
    if (personalTypes.includes(relationship)) {
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    }
    return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  };

  const handleContactASelect = (contactId: string) => {
    const contact = contacts.find((c: any) => c.contactId.toString() === contactId);
    setSelectedContactA(contact);
    createForm.setValue("contactAId", parseInt(contactId));
  };

  const handleContactBSelect = (contactId: string) => {
    const contact = contacts.find((c: any) => c.contactId.toString() === contactId);
    setSelectedContactB(contact);
    createForm.setValue("contactBId", parseInt(contactId));
  };

  const handleRelationshipAChange = (relationship: string) => {
    createForm.setValue("relationshipAToB", relationship);
    const relationshipType = relationshipTypes.find(rt => rt.value === relationship);
    if (relationshipType) {
      createForm.setValue("relationshipBToA", relationshipType.reciprocal);
    }
  };

  const handleCreate = (data: RelationshipFormData) => {
    createRelationshipMutation.mutate(data);
  };

  const handleEdit = (relationship: any) => {
    setEditingRelationship(relationship);
    editForm.reset({
      contactAId: relationship.contactAId,
      contactBId: relationship.contactBId,
      relationshipAToB: relationship.relationshipAToB || "",
      relationshipBToA: relationship.relationshipBToA || "",
    });
  };

  const handleUpdate = (data: RelationshipFormData) => {
    if (editingRelationship) {
      updateRelationshipMutation.mutate({
        relationshipId: `${editingRelationship.contactAId}-${editingRelationship.contactBId}`,
        data,
      });
    }
  };

  const handleDelete = (relationship: any) => {
    if (confirm(`Are you sure you want to delete this relationship?`)) {
      deleteRelationshipMutation.mutate(`${relationship.contactAId}-${relationship.contactBId}`);
    }
  };

  // Filter relationships based on search
  const filteredRelationships = relationships.filter((rel: any) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      rel.contactA?.fullName?.toLowerCase().includes(searchLower) ||
      rel.contactB?.fullName?.toLowerCase().includes(searchLower) ||
      rel.relationshipAToB?.toLowerCase().includes(searchLower) ||
      rel.relationshipBToA?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Relationship Manager
            </CardTitle>
            <CardDescription>
              Manage connections and relationships between contacts
            </CardDescription>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Relationship
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Contact Relationship</DialogTitle>
                <DialogDescription>
                  Define the relationship between two contacts
                </DialogDescription>
              </DialogHeader>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-6">
                  {/* Contact A Selection */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium">First Contact</label>
                    <Select onValueChange={handleContactASelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select first contact" />
                      </SelectTrigger>
                      <SelectContent>
                        {contacts.map((contact: any) => (
                          <SelectItem key={contact.contactId} value={contact.contactId.toString()}>
                            <div className="flex items-center gap-2">
                              <Avatar className="w-6 h-6">
                                <AvatarImage src={contact.profilePictureUrl || ""} />
                                <AvatarFallback className="text-xs">
                                  {getInitials(contact.fullName)}
                                </AvatarFallback>
                              </Avatar>
                              {contact.fullName}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedContactA && (
                      <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={selectedContactA.profilePictureUrl || ""} />
                          <AvatarFallback>
                            {getInitials(selectedContactA.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{selectedContactA.fullName}</span>
                      </div>
                    )}
                  </div>

                  {/* Relationship Type */}
                  <FormField
                    control={createForm.control}
                    name="relationshipAToB"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Relationship Type</FormLabel>
                        <Select onValueChange={handleRelationshipAChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select relationship type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {relationshipTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Contact B Selection */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Second Contact</label>
                    <Select onValueChange={handleContactBSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select second contact" />
                      </SelectTrigger>
                      <SelectContent>
                        {contacts
                          .filter((contact: any) => contact.contactId !== selectedContactA?.contactId)
                          .map((contact: any) => (
                            <SelectItem key={contact.contactId} value={contact.contactId.toString()}>
                              <div className="flex items-center gap-2">
                                <Avatar className="w-6 h-6">
                                  <AvatarImage src={contact.profilePictureUrl || ""} />
                                  <AvatarFallback className="text-xs">
                                    {getInitials(contact.fullName)}
                                  </AvatarFallback>
                                </Avatar>
                                {contact.fullName}
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {selectedContactB && (
                      <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={selectedContactB.profilePictureUrl || ""} />
                          <AvatarFallback>
                            {getInitials(selectedContactB.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{selectedContactB.fullName}</span>
                      </div>
                    )}
                  </div>

                  {/* Reciprocal Relationship */}
                  <FormField
                    control={createForm.control}
                    name="relationshipBToA"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reciprocal Relationship (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="How second contact relates to first" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Preview */}
                  {selectedContactA && selectedContactB && createForm.watch("relationshipAToB") && (
                    <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20">
                      <h4 className="font-medium mb-2">Relationship Preview:</h4>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{selectedContactA.fullName}</span>
                        <span>is a</span>
                        <Badge className={getRelationshipColor(createForm.watch("relationshipAToB"))}>
                          {createForm.watch("relationshipAToB")}
                        </Badge>
                        <span>of</span>
                        <span className="font-medium">{selectedContactB.fullName}</span>
                      </div>
                      {createForm.watch("relationshipBToA") && (
                        <div className="flex items-center gap-2 text-sm mt-1">
                          <span className="font-medium">{selectedContactB.fullName}</span>
                          <span>is a</span>
                          <Badge className={getRelationshipColor(createForm.watch("relationshipBToA"))}>
                            {createForm.watch("relationshipBToA")}
                          </Badge>
                          <span>of</span>
                          <span className="font-medium">{selectedContactA.fullName}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createRelationshipMutation.isPending}>
                      {createRelationshipMutation.isPending ? "Creating..." : "Create Relationship"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search relationships..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Relationship List */}
        {isLoading ? (
          <div className="text-center py-4 text-sm text-gray-500">
            Loading relationships...
          </div>
        ) : filteredRelationships.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
              No relationships found
            </h3>
            <p className="text-sm text-gray-500">
              {searchTerm ? "Try adjusting your search term" : "Create your first contact relationship"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRelationships.map((relationship: any, index: number) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <div className="flex items-center gap-4 flex-1">
                  {/* Contact A */}
                  <div className="flex items-center gap-2">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={relationship.contactA?.profilePictureUrl || ""} />
                      <AvatarFallback>
                        {getInitials(relationship.contactA?.fullName || "?")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{relationship.contactA?.fullName}</div>
                      <div className="text-xs text-gray-500">{relationship.contactA?.relationship}</div>
                    </div>
                  </div>

                  {/* Relationship Display */}
                  <div className="flex items-center gap-2 flex-1">
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <Badge className={getRelationshipColor(relationship.relationshipAToB)}>
                      {relationship.relationshipAToB}
                    </Badge>
                    {relationship.relationshipBToA && relationship.relationshipBToA !== relationship.relationshipAToB && (
                      <>
                        <ArrowLeftRight className="w-4 h-4 text-gray-400" />
                        <Badge className={getRelationshipColor(relationship.relationshipBToA)}>
                          {relationship.relationshipBToA}
                        </Badge>
                      </>
                    )}
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </div>

                  {/* Contact B */}
                  <div className="flex items-center gap-2">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={relationship.contactB?.profilePictureUrl || ""} />
                      <AvatarFallback>
                        {getInitials(relationship.contactB?.fullName || "?")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{relationship.contactB?.fullName}</div>
                      <div className="text-xs text-gray-500">{relationship.contactB?.relationship}</div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(relationship)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(relationship)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Edit Relationship Dialog */}
      <Dialog open={!!editingRelationship} onOpenChange={() => setEditingRelationship(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Relationship</DialogTitle>
            <DialogDescription>
              Update the relationship between contacts
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="relationshipAToB"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship A to B</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {relationshipTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="relationshipBToA"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship B to A (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Reciprocal relationship" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingRelationship(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateRelationshipMutation.isPending}>
                  {updateRelationshipMutation.isPending ? "Updating..." : "Update Relationship"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}