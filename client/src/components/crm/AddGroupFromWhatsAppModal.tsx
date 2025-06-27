import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Plus, Check, Building2, FolderOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface AddGroupFromWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupJid: string;
  groupName?: string;
  instanceId: string;
}

export function AddGroupFromWhatsAppModal({
  isOpen,
  onClose,
  groupJid,
  groupName,
  instanceId
}: AddGroupFromWhatsAppModalProps) {
  const [name, setName] = useState(groupName || '');
  const [type, setType] = useState('team');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [tags, setTags] = useState('');
  const [linkType, setLinkType] = useState('none'); // 'none', 'space', 'project'
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch spaces
  const { data: spaces = [] } = useQuery({
    queryKey: ['/api/spaces'],
    enabled: linkType === 'space'
  });

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ['/api/crm/projects'],
    enabled: linkType === 'project'
  });

  // Generate UUID with cg_ prefix for CRM groups
  const generateGroupId = () => {
    return `cg_${crypto.randomUUID()}`;
  };

  // Create space mutation
  const createSpaceMutation = useMutation({
    mutationFn: async (spaceName: string) => {
      return apiRequest('POST', '/api/spaces', { 
        spaceName, 
        category: 'work',
        userId: '7804247f-3ae8-4eb2-8c6d-2c44f967ad42' 
      });
    },
    onSuccess: (newSpace) => {
      setSelectedSpaceId(newSpace.spaceId);
      setShowCreateSpace(false);
      setNewSpaceName('');
      queryClient.invalidateQueries({ queryKey: ['/api/spaces'] });
      toast({
        title: "Success",
        description: "Space created successfully",
      });
    }
  });

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (projectName: string) => {
      return apiRequest('POST', '/api/crm/projects', { 
        projectName,
        spaceId: selectedSpaceId || null,
        userId: '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'
      });
    },
    onSuccess: (newProject) => {
      setSelectedProjectId(newProject.projectId);
      setShowCreateProject(false);
      setNewProjectName('');
      queryClient.invalidateQueries({ queryKey: ['/api/crm/projects'] });
      toast({
        title: "Success",
        description: "Project created successfully",
      });
    }
  });

  const createGroupMutation = useMutation({
    mutationFn: async (groupData: any) => {
      return apiRequest('POST', '/api/crm/groups', groupData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "CRM group created successfully and linked to WhatsApp group",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/groups'] });
      queryClient.invalidateQueries({ queryKey: [`/api/crm/groups/whatsapp-link-status/${groupJid}`] });
      onClose();
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create CRM group",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setName(groupName || '');
    setType('team');
    setDescription('');
    setColor('#3B82F6');
    setTags('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Group name is required",
        variant: "destructive",
      });
      return;
    }

    const groupData = {
      id: generateGroupId(),
      name: name.trim(),
      type,
      description: description.trim() || null,
      color,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      status: 'active',
      // Link to WhatsApp group
      whatsappJid: groupJid,
      whatsappInstanceId: instanceId,
      whatsappLinkedAt: new Date().toISOString(),
    };

    createGroupMutation.mutate(groupData);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const groupTypes = [
    { value: 'team', label: 'Team' },
    { value: 'family', label: 'Family' },
    { value: 'project', label: 'Project' },
    { value: 'community', label: 'Community' },
    { value: 'business', label: 'Business' },
    { value: 'social', label: 'Social' },
    { value: 'study', label: 'Study' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Add WhatsApp Group to CRM
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* WhatsApp Group Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
              <Users className="h-4 w-4" />
              <span className="font-medium">WhatsApp Group:</span>
            </div>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1 truncate">
              {groupJid}
            </p>
          </div>

          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="group-name">Group Name</Label>
            <Input
              id="group-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter group name"
              required
            />
          </div>

          {/* Group Type */}
          <div className="space-y-2">
            <Label htmlFor="group-type">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Select group type" />
              </SelectTrigger>
              <SelectContent>
                {groupTypes.map((groupType) => (
                  <SelectItem key={groupType.value} value={groupType.value}>
                    {groupType.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter group description"
              rows={3}
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label htmlFor="color">Color</Label>
            <div className="flex items-center gap-2">
              <input
                id="color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
              />
              <Input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#3B82F6"
                className="flex-1"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags (Optional)</Label>
            <Input
              id="tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Enter tags separated by commas"
            />
            <p className="text-xs text-gray-500">Separate multiple tags with commas</p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createGroupMutation.isPending}
              className="flex items-center gap-2"
            >
              {createGroupMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create CRM Group
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}