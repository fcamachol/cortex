import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Settings, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface WhatsAppGroup {
  groupJid: string;
  instanceId: string;
  subject: string;
  description?: string;
  ownerJid: string;
  creationTimestamp?: string;
  isLocked: boolean;
  updatedAt: string;
}

export default function GroupsPage() {
  const { data: groups = [], isLoading, error } = useQuery<WhatsAppGroup[]>({
    queryKey: ["/api/whatsapp/groups"],
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">WhatsApp Groups</h1>
          <p className="text-muted-foreground">Loading groups...</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">WhatsApp Groups</h1>
          <p className="text-red-500">Error loading groups: {error.message}</p>
        </div>
      </div>
    );
  }

  const groupsByInstance = groups.reduce((acc, group) => {
    if (!acc[group.instanceId]) {
      acc[group.instanceId] = [];
    }
    acc[group.instanceId].push(group);
    return acc;
  }, {} as Record<string, WhatsAppGroup[]>);

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Users className="h-8 w-8" />
          WhatsApp Groups
        </h1>
        <p className="text-muted-foreground">
          Found {groups.length} groups across {Object.keys(groupsByInstance).length} instances
        </p>
      </div>

      {Object.entries(groupsByInstance).map(([instanceId, instanceGroups]) => (
        <div key={instanceId} className="mb-8">
          <div className="mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Instance: {instanceId}
            </h2>
            <p className="text-sm text-muted-foreground">
              {instanceGroups.length} groups
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {instanceGroups.map((group) => (
              <Card key={group.groupJid} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg line-clamp-2">
                    {group.subject || "Unnamed Group"}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {group.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge variant={group.isLocked ? "secondary" : "default"}>
                        {group.isLocked ? "Locked" : "Open"}
                      </Badge>
                    </div>
                    
                    <div className="text-sm">
                      <p className="text-muted-foreground">Owner</p>
                      <p className="font-mono text-xs truncate">
                        {group.ownerJid || "Unknown"}
                      </p>
                    </div>

                    <div className="text-sm">
                      <p className="text-muted-foreground">Group ID</p>
                      <p className="font-mono text-xs truncate">
                        {group.groupJid}
                      </p>
                    </div>

                    {group.updatedAt && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>
                          Updated {formatDistanceToNow(new Date(group.updatedAt), { addSuffix: true })}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {groups.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Groups Found</h3>
            <p className="text-muted-foreground">
              No WhatsApp groups are currently available in your instances.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}