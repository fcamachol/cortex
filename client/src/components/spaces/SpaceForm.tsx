import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Palette, Upload, Folder } from 'lucide-react';
import { useState } from 'react';

interface Space {
  spaceId: number;
  spaceName: string;
  description?: string;
  icon?: string;
  color?: string;
  coverImage?: string;
  spaceType: 'workspace' | 'project' | 'team' | 'personal' | 'archive';
  privacy: 'public' | 'private' | 'restricted';
  parentSpaceId?: number;
  isArchived: boolean;
  isFavorite: boolean;
}

interface SpaceFormProps {
  space?: Partial<Space> | null;
  spaces?: Space[];
  onSubmit: (spaceId: number | undefined, data: any) => void;
  onClose: () => void;
  isLoading?: boolean;
  isOpen?: boolean;
}

const spaceFormSchema = z.object({
  spaceName: z.string().min(1, 'Space name is required'),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  coverImage: z.string().optional(),
  spaceType: z.enum(['workspace', 'project', 'team', 'personal', 'archive']),
  privacy: z.enum(['public', 'private', 'restricted']),
  parentSpaceId: z.number().optional(),
  isFavorite: z.boolean().optional(),
});

type SpaceFormData = z.infer<typeof spaceFormSchema>;

const predefinedColors = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
];

const predefinedIcons = [
  '📁', '📂', '🏢', '🎯', '⚡', '🚀', '💡', '🎨', '📊', '🔧',
  '💼', '🌟', '🔥', '📈', '🎪', '🏠', '🌍', '🎵', '📚', '⚽'
];

export function SpaceForm({ space, spaces = [], onSubmit, onClose, isLoading, isOpen = true }: SpaceFormProps) {
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [selectedIconIndex, setSelectedIconIndex] = useState(0);

  const form = useForm<SpaceFormData>({
    resolver: zodResolver(spaceFormSchema),
    defaultValues: {
      spaceName: space?.spaceName || '',
      description: space?.description || '',
      icon: space?.icon || predefinedIcons[0],
      color: space?.color || predefinedColors[0],
      coverImage: space?.coverImage || '',
      spaceType: space?.spaceType || 'workspace',
      privacy: space?.privacy || 'private',
      parentSpaceId: space?.parentSpaceId || undefined,
      isFavorite: space?.isFavorite || false,
    },
  });

  const handleSubmit = (data: SpaceFormData) => {
    onSubmit(space?.spaceId, data);
  };

  // Filter spaces that can be parents (no circular references)
  const availableParentSpaces = spaces.filter(s => 
    s.spaceId !== space?.spaceId && 
    s.spaceType !== 'archive' &&
    !s.isArchived
  );

  // Check if parent is pre-determined (creating subspace from specific parent)
  const isParentPredetermined = space?.parentSpaceId && !space.spaceId;
  const parentSpace = isParentPredetermined ? spaces.find(s => s.spaceId === space.parentSpaceId) : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {space ? 'Edit Space' : 'Create New Space'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Space Name */}
            <FormField
              control={form.control}
              name="spaceName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Space Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter space name..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter space description..." 
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Icon Selection */}
            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icon</FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      <div className="grid grid-cols-10 gap-2">
                        {predefinedIcons.map((icon, index) => (
                          <Button
                            key={index}
                            type="button"
                            variant={field.value === icon ? "default" : "outline"}
                            className="h-10 w-10 p-0"
                            onClick={() => field.onChange(icon)}
                          >
                            {icon}
                          </Button>
                        ))}
                      </div>
                      <Input
                        placeholder="Or enter custom emoji/icon..."
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Color Selection */}
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      <div className="grid grid-cols-10 gap-2">
                        {predefinedColors.map((color, index) => (
                          <Button
                            key={index}
                            type="button"
                            className={`h-10 w-10 p-0 border-2 ${
                              field.value === color ? 'border-black dark:border-white' : 'border-gray-200'
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => field.onChange(color)}
                          />
                        ))}
                      </div>
                      <Input
                        placeholder="Or enter custom hex color..."
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Space Type and Privacy */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="spaceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Space Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="workspace">Workspace</SelectItem>
                        <SelectItem value="project">Project</SelectItem>
                        <SelectItem value="team">Team</SelectItem>
                        <SelectItem value="personal">Personal</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="privacy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Privacy</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select privacy" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                        <SelectItem value="restricted">Restricted</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Parent Space */}
            {isParentPredetermined ? (
              // Show read-only parent when creating subspace from specific parent
              <div className="space-y-2">
                <FormLabel>Parent Space</FormLabel>
                <div className="flex items-center space-x-3 p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
                  <span>{parentSpace?.icon || '📁'}</span>
                  <span className="font-medium">{parentSpace?.spaceName}</span>
                  <Badge variant="secondary" className="text-xs">Automatic</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  This subspace will be created within "{parentSpace?.spaceName}"
                </p>
              </div>
            ) : (
              // Show dropdown for regular space creation
              availableParentSpaces.length > 0 && (
                <FormField
                  control={form.control}
                  name="parentSpaceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parent Space (Optional)</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value === 'none' ? undefined : parseInt(value))} 
                        defaultValue={field.value?.toString() || 'none'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select parent space" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No parent (root level)</SelectItem>
                          {availableParentSpaces.map((parentSpace) => (
                            <SelectItem key={parentSpace.spaceId} value={parentSpace.spaceId.toString()}>
                              <div className="flex items-center space-x-2">
                                <span>{parentSpace.icon || '📁'}</span>
                                <span>{parentSpace.spaceName}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )
            )}

            {/* Cover Image */}
            <FormField
              control={form.control}
              name="coverImage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cover Image (Optional)</FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      <Input
                        placeholder="Enter image URL..."
                        {...field}
                      />
                      <Button type="button" variant="outline" className="w-full">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Image
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Favorite Toggle */}
            <FormField
              control={form.control}
              name="isFavorite"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Add to Favorites</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Show this space in your favorites list
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Preview */}
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm font-medium mb-3">Preview</div>
                <div className="flex items-center space-x-3 p-3 border rounded-lg">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold"
                    style={{ backgroundColor: form.watch('color') || '#3B82F6' }}
                  >
                    {form.watch('icon') || '📁'}
                  </div>
                  <div>
                    <div className="font-medium">{form.watch('spaceName') || 'Space Name'}</div>
                    <div className="text-sm text-muted-foreground">
                      {form.watch('description') || 'Space description...'}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {form.watch('spaceType')}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {form.watch('privacy')}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Form Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : space ? 'Update Space' : 'Create Space'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}