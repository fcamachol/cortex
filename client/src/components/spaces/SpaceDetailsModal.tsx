import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  Users, Settings, Star, Archive, Calendar, BarChart3, 
  Files, MessageCircle, Clock, Eye, Lock, Globe,
  Edit, Trash2, UserPlus, Share
} from 'lucide-react';

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
  creatorUserId: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  taskCount?: number;
  projectCount?: number;
  childSpaces?: Space[];
}

interface SpaceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  space: Space;
  onEdit: (space: Space) => void;
}

export function SpaceDetailsModal({ isOpen, onClose, space, onEdit }: SpaceDetailsModalProps) {
  const getPrivacyIcon = (privacy: string) => {
    switch (privacy) {
      case 'public': return <Globe className="h-4 w-4" />;
      case 'private': return <Lock className="h-4 w-4" />;
      case 'restricted': return <Eye className="h-4 w-4" />;
      default: return <Lock className="h-4 w-4" />;
    }
  };

  const getPrivacyDescription = (privacy: string) => {
    switch (privacy) {
      case 'public': return 'Anyone can view and join this space';
      case 'private': return 'Only invited members can access this space';
      case 'restricted': return 'Members need permission to access certain areas';
      default: return 'Private space';
    }
  };

  // Mock data for demonstration
  const mockMembers = [
    { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin', avatar: '', initials: 'JD' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'Editor', avatar: '', initials: 'JS' },
    { id: 3, name: 'Mike Johnson', email: 'mike@example.com', role: 'Viewer', avatar: '', initials: 'MJ' },
  ];

  const mockActivity = [
    { id: 1, user: 'John Doe', action: 'created task "Setup database"', time: '2 hours ago' },
    { id: 2, user: 'Jane Smith', action: 'updated project timeline', time: '4 hours ago' },
    { id: 3, user: 'Mike Johnson', action: 'commented on task "Design review"', time: '1 day ago' },
    { id: 4, user: 'John Doe', action: 'uploaded file "specifications.pdf"', time: '2 days ago' },
  ];

  const mockStats = {
    totalTasks: space.taskCount || 0,
    completedTasks: Math.floor((space.taskCount || 0) * 0.6),
    totalProjects: space.projectCount || 0,
    activeProjects: Math.floor((space.projectCount || 0) * 0.8),
    totalFiles: 24,
    totalMembers: space.memberCount || 0
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl font-semibold"
                style={{ backgroundColor: space.color || '#3B82F6' }}
              >
                {space.icon || '📁'}
              </div>
              <div>
                <DialogTitle className="text-2xl">{space.spaceName}</DialogTitle>
                <div className="flex items-center space-x-3 mt-2">
                  <Badge variant="outline" className="flex items-center gap-1">
                    {getPrivacyIcon(space.privacy)}
                    {space.privacy}
                  </Badge>
                  <Badge variant="secondary">{space.spaceType}</Badge>
                  {space.isFavorite && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      Favorite
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={() => onEdit(space)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button variant="outline" size="sm">
                <Share className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Cover Image */}
        {space.coverImage && (
          <div className="h-32 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg mb-4 relative overflow-hidden">
            <img src={space.coverImage} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Description */}
              {space.description && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{space.description}</p>
                  </CardContent>
                </Card>
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{mockStats.totalTasks}</div>
                    <p className="text-xs text-muted-foreground">Total Tasks</p>
                    <div className="text-xs text-green-600">
                      {mockStats.completedTasks} completed
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{mockStats.totalProjects}</div>
                    <p className="text-xs text-muted-foreground">Projects</p>
                    <div className="text-xs text-blue-600">
                      {mockStats.activeProjects} active
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{mockStats.totalFiles}</div>
                    <p className="text-xs text-muted-foreground">Files</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{mockStats.totalMembers}</div>
                    <p className="text-xs text-muted-foreground">Members</p>
                  </CardContent>
                </Card>
              </div>

              {/* Space Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Space Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="font-medium">Created</div>
                      <div className="text-muted-foreground">
                        {new Date(space.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">Last Updated</div>
                      <div className="text-muted-foreground">
                        {new Date(space.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">Privacy</div>
                      <div className="text-muted-foreground flex items-center gap-1">
                        {getPrivacyIcon(space.privacy)}
                        {getPrivacyDescription(space.privacy)}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">Type</div>
                      <div className="text-muted-foreground capitalize">{space.spaceType}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="members" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Members ({mockMembers.length})</h3>
                <Button size="sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Members
                </Button>
              </div>

              <div className="space-y-3">
                {mockMembers.map((member) => (
                  <Card key={member.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Avatar>
                            <AvatarImage src={member.avatar} />
                            <AvatarFallback>{member.initials}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{member.name}</div>
                            <div className="text-sm text-muted-foreground">{member.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{member.role}</Badge>
                          <Button variant="ghost" size="sm">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="activity" className="space-y-4">
              <h3 className="text-lg font-semibold">Recent Activity</h3>
              
              <div className="space-y-3">
                {mockActivity.map((activity) => (
                  <Card key={activity.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                        <div className="flex-1">
                          <div className="text-sm">
                            <span className="font-medium">{activity.user}</span> {activity.action}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
                            {activity.time}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <h3 className="text-lg font-semibold">Space Settings</h3>
              
              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Archive Space</div>
                      <div className="text-sm text-muted-foreground">
                        Hide this space from the active spaces list
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      <Archive className="h-4 w-4 mr-2" />
                      Archive
                    </Button>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Delete Space</div>
                      <div className="text-sm text-muted-foreground">
                        Permanently delete this space and all its content
                      </div>
                    </div>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}