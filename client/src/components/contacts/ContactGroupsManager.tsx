import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, Edit, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";

const groupFormSchema = z.object({
  groupName: z.string().min(1, "Group name is required"),
  groupDescription: z.string().optional(),
  groupIcon: z.string().optional(),
});

type GroupFormData = z.infer<typeof groupFormSchema>;

interface ContactGroupsManagerProps {
  userId: string;
}

export default function ContactGroupsManager({ userId }: ContactGroupsManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  
  const queryClient = useQueryClient();

  // Fetch contact groups
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['/api/crm/contact-groups', userId],
    queryFn: () => apiRequest('GET', `/api/crm/contact-groups?ownerUserId=${userId}`),
    staleTime: 30000,
  });

  // Create group mutation
  const createGroupMutation = useMutation({
    mutationFn: (data: GroupFormData) => apiRequest('POST', '/api/crm/contact-groups', {
      ...data,
      ownerUserId: userId,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contact-groups', userId] });
      setIsCreateDialogOpen(false);
      createForm.reset();
    },
  });

  // Update group mutation
  const updateGroupMutation = useMutation({
    mutationFn: ({ groupId, data }: { groupId: string; data: GroupFormData }) => 
      apiRequest('PUT', `/api/crm/contact-groups/${groupId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contact-groups', userId] });
      setEditingGroup(null);
      editForm.reset();
    },
  });

  // Delete group mutation
  const deleteGroupMutation = useMutation({
    mutationFn: (groupId: string) => apiRequest('DELETE', `/api/crm/contact-groups/${groupId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contact-groups', userId] });
    },
  });

  // Forms
  const createForm = useForm<GroupFormData>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      groupName: "",
      groupDescription: "",
      groupIcon: "👥",
    },
  });

  const editForm = useForm<GroupFormData>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      groupName: "",
      groupDescription: "",
      groupIcon: "👥",
    },
  });

  const handleCreate = (data: GroupFormData) => {
    createGroupMutation.mutate(data);
  };

  const handleEdit = (group: any) => {
    setEditingGroup(group);
    editForm.reset({
      groupName: group.groupName,
      groupDescription: group.groupDescription || "",
      groupIcon: group.groupIcon || "👥",
    });
  };

  const handleUpdate = (data: GroupFormData) => {
    if (editingGroup) {
      updateGroupMutation.mutate({
        groupId: editingGroup.groupId,
        data,
      });
    }
  };

  const handleDelete = (group: any) => {
    if (confirm(`Are you sure you want to delete the group "${group.groupName}"? This will remove all contacts from the group.`)) {
      deleteGroupMutation.mutate(group.groupId);
    }
  };

  const commonIcons = ["👥", "👨‍👩‍👧‍👦", "💼", "🏢", "🎯", "⭐", "🔥", "💡", "🚀", "🎉"];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Contact Groups
            </CardTitle>
            <CardDescription>
              Organize contacts into custom groups
            </CardDescription>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Contact Group</DialogTitle>
                <DialogDescription>
                  Create a new group to organize your contacts
                </DialogDescription>
              </DialogHeader>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
                  <FormField
                    control={createForm.control}
                    name="groupName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Group Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Family, Clients, Friends" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="groupDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Brief description of this group..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="groupIcon"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Icon</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            <Input placeholder="Enter emoji or icon" {...field} />
                            <div className="flex flex-wrap gap-2">
                              {commonIcons.map((icon) => (
                                <Button
                                  key={icon}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="text-lg p-1 h-8 w-8"
                                  onClick={() => field.onChange(icon)}
                                >
                                  {icon}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createGroupMutation.isPending}>
                      {createGroupMutation.isPending ? "Creating..." : "Create Group"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-sm text-gray-500">
            Loading groups...
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-4 text-sm text-gray-500">
            No contact groups yet
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group: any) => (
              <div
                key={group.groupId}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <div className="flex items-center gap-3">
                  <div className="text-lg">{group.groupIcon || "👥"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {group.groupName}
                    </div>
                    {group.groupDescription && (
                      <div className="text-xs text-gray-500 truncate">
                        {group.groupDescription}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      {group.memberCount || 0} members
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(group)}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(group)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Edit Group Dialog */}
      <Dialog open={!!editingGroup} onOpenChange={() => setEditingGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Contact Group</DialogTitle>
            <DialogDescription>
              Update group information
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="groupName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Family, Clients, Friends" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="groupDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Brief description of this group..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="groupIcon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Icon</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <Input placeholder="Enter emoji or icon" {...field} />
                        <div className="flex flex-wrap gap-2">
                          {commonIcons.map((icon) => (
                            <Button
                              key={icon}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-lg p-1 h-8 w-8"
                              onClick={() => field.onChange(icon)}
                            >
                              {icon}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingGroup(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateGroupMutation.isPending}>
                  {updateGroupMutation.isPending ? "Updating..." : "Update Group"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}