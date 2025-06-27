import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
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
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [spaceDropdownOpen, setSpaceDropdownOpen] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch spaces
  const { data: spaces = [] } = useQuery({
    queryKey: ['/api/spaces']
  });

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ['/api/crm/projects']
  });

  // Filter projects based on selected space
  const filteredProjects = useMemo(() => {
    if (!selectedSpaceId || !Array.isArray(projects)) {
      return projects;
    }
    return projects.filter((project: any) => project.spaceId === parseInt(selectedSpaceId));
  }, [projects, selectedSpaceId]);

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
      queryClient.invalidateQueries({ queryKey: ['/api/spaces'] });
      setSelectedSpaceId(newSpace.spaceId);
      setShowCreateSpace(false);
      setNewSpaceName('');
      toast({
        title: "Space created",
        description: `"${newSpace.spaceName}" has been created successfully.`,
      });
    },
    onError: (error) => {
      console.error('Error creating space:', error);
      toast({
        title: "Error",
        description: "Failed to create space. Please try again.",
        variant: "destructive",
      });
    },
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
      queryClient.invalidateQueries({ queryKey: ['/api/crm/projects'] });
      setSelectedProjectId(newProject.projectId);
      setShowCreateProject(false);
      setNewProjectName('');
      toast({
        title: "Project created",
        description: `"${newProject.projectName}" has been created successfully.`,
      });
    },
    onError: (error) => {
      console.error('Error creating project:', error);
      toast({
        title: "Error",
        description: "Failed to create project. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create group mutation
  const createGroupMutation = useMutation({
    mutationFn: async (groupData: any) => {
      return apiRequest('POST', '/api/crm/groups', groupData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/groups'] });
      toast({
        title: "Success",
        description: "WhatsApp group has been added to CRM successfully.",
      });
      handleClose();
    },
    onError: (error) => {
      console.error('Error creating group:', error);
      toast({
        title: "Error",
        description: "Failed to create CRM group. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Group name is required.",
        variant: "destructive",
      });
      return;
    }

    const groupData = {
      groupId: generateGroupId(),
      name: name.trim(),
      type,
      description: description.trim() || null,
      color,
      tags: tags.trim() ? tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
      whatsappJid: groupJid,
      whatsappInstanceId: instanceId,
      isWhatsappLinked: true,
      whatsappLinkedAt: new Date(),
      userId: '7804247f-3ae8-4eb2-8c6d-2c44f967ad42'
    };

    createGroupMutation.mutate(groupData);
  };

  const handleClose = () => {
    setName(groupName || '');
    setType('team');
    setDescription('');
    setColor('#3B82F6');
    setTags('');
    setSelectedSpaceId('');
    setSelectedProjectId('');
    setShowCreateSpace(false);
    setShowCreateProject(false);
    setNewSpaceName('');
    setNewProjectName('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Add WhatsApp Group to CRM
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Group Name *</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter group name"
              required
            />
          </div>

          {/* Group Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Group Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Select group type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="team">Team</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="department">Department</SelectItem>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="vendor">Vendor</SelectItem>
                <SelectItem value="other">Other</SelectItem>
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

          {/* Link to Space or Project */}
          <div className="space-y-3">
            <Label>Link to Space or Project (Optional)</Label>
            
            {/* Space and Project Selection Side by Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Space Column */}
              <div className="space-y-2">
                {!showCreateSpace ? (
                  <div className="flex gap-2">
                    <Popover open={spaceDropdownOpen} onOpenChange={setSpaceDropdownOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={spaceDropdownOpen}
                          className="flex-1 justify-between"
                        >
                          {selectedSpaceId
                            ? spaces?.find((space: any) => space.spaceId === selectedSpaceId)?.spaceName
                            : "Select a space..."}
                          <FolderOpen className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Search spaces..." />
                          <CommandEmpty>No space found.</CommandEmpty>
                          <CommandGroup>
                            {Array.isArray(spaces) && spaces.map((space: any) => (
                              <CommandItem
                                key={space.spaceId}
                                onSelect={() => {
                                  setSelectedSpaceId(space.spaceId);
                                  setSpaceDropdownOpen(false);
                                  // Clear project selection when space changes
                                  setSelectedProjectId('');
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    selectedSpaceId === space.spaceId ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                                {space.spaceName}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowCreateSpace(true)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="New space name"
                      value={newSpaceName}
                      onChange={(e) => setNewSpaceName(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => createSpaceMutation.mutate(newSpaceName)}
                      disabled={!newSpaceName.trim() || createSpaceMutation.isPending}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowCreateSpace(false);
                        setNewSpaceName('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>

              {/* Project Column */}
              <div className="space-y-2">
                {!showCreateProject ? (
                  <div className="flex gap-2">
                    <Popover open={projectDropdownOpen} onOpenChange={setProjectDropdownOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={projectDropdownOpen}
                          className="flex-1 justify-between"
                        >
                          {selectedProjectId
                            ? filteredProjects?.find((project: any) => project.projectId === selectedProjectId)?.projectName
                            : "Select a project..."}
                          <Building2 className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Search projects..." />
                          <CommandEmpty>No project found.</CommandEmpty>
                          <CommandGroup>
                            {Array.isArray(filteredProjects) && filteredProjects.map((project: any) => (
                              <CommandItem
                                key={project.projectId}
                                onSelect={() => {
                                  setSelectedProjectId(project.projectId);
                                  setProjectDropdownOpen(false);
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    selectedProjectId === project.projectId ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                                {project.projectName}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowCreateProject(true)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="New project name"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => createProjectMutation.mutate(newProjectName)}
                      disabled={!newProjectName.trim() || createProjectMutation.isPending}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowCreateProject(false);
                        setNewProjectName('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label htmlFor="color">Color</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-16 h-10 p-1 border border-gray-300 rounded"
              />
              <span className="text-sm text-gray-600">{color}</span>
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