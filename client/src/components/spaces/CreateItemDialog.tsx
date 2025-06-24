import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  CheckSquare, 
  Briefcase, 
  FileText, 
  Calendar,
  Folder
} from "lucide-react";

interface CreateItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: number | null;
  itemType: string;
}

export function CreateItemDialog({ isOpen, onClose, spaceId, itemType }: CreateItemDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'project': return Briefcase;
      case 'task': return CheckSquare;
      case 'file': return FileText;
      case 'document': return FileText;
      case 'note': return FileText;
      case 'event': return Calendar;
      case 'subspace': return Folder;
      default: return FileText;
    }
  };

  const getItemTypeLabel = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const createItemMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; itemType: string; spaceId: number }) => {
      if (itemType === 'subspace') {
        // Create subspace
        return await apiRequest('/api/spaces', 'POST', {
          spaceName: data.title,
          description: data.description,
          parentId: data.spaceId,
          category: 'work', // Default category
          color: '#3B82F6', // Default color
          privacy: 'workspace'
        });
      } else {
        // Create space item
        return await apiRequest('/api/space-items', 'POST', data);
      }
    },
    onSuccess: () => {
      toast({
        title: `${getItemTypeLabel(itemType)} created`,
        description: `Successfully created ${title}`,
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/spaces'] });
      queryClient.invalidateQueries({ queryKey: ['/api/space-items', spaceId] });
      
      // Reset form and close
      setTitle("");
      setDescription("");
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create ${itemType}: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !spaceId) return;

    createItemMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      itemType,
      spaceId,
    });
  };

  const handleClose = () => {
    setTitle("");
    setDescription("");
    onClose();
  };

  const Icon = getItemIcon(itemType);

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            Create {getItemTypeLabel(itemType)}
          </SheetTitle>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="space-y-2">
            <Label htmlFor="title">
              {itemType === 'subspace' ? 'Space Name' : 'Title'}
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Enter ${itemType} ${itemType === 'subspace' ? 'name' : 'title'}...`}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`Describe this ${itemType}...`}
              rows={4}
            />
          </div>
          
          {/* Additional fields based on item type */}
          {itemType === 'task' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <select className="w-full p-2 border rounded-md">
                  <option value="low">Low</option>
                  <option value="medium" selected>Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="date" />
              </div>
            </div>
          )}
          
          {itemType === 'event' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="datetime-local" />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="datetime-local" />
              </div>
            </div>
          )}
          
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || createItemMutation.isPending}
            >
              {createItemMutation.isPending ? 'Creating...' : `Create ${getItemTypeLabel(itemType)}`}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}