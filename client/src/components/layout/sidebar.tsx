import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PhoneNumberDisplay } from "@/components/ui/phone-number-display";
import { MessageCircle, CheckSquare, Users, Calendar, Plug, Settings, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface SidebarProps {
  activeModule: string;
  onSetActiveModule: (module: string) => void;
}

export default function Sidebar({ activeModule, onSetActiveModule }: SidebarProps) {
  // Mock user data - in real app this would come from auth context
  const currentUser = {
    id: "7804247f-3ae8-4eb2-8c6d-2c44f967ad42",
    name: "Demo User",
    email: "demo@example.com",
    avatar: null
  };

  const { data: whatsappInstances = [] } = useQuery<any[]>({
    queryKey: [`/api/whatsapp/instances/${currentUser.id}`],
  });

  const navigationItems = [
    {
      id: "conversations",
      label: "Conversations",
      icon: MessageCircle,
      badge: "3",
      badgeColor: "bg-green-500"
    },
    {
      id: "tasks",
      label: "Tasks",
      icon: CheckSquare,
      badge: "5",
      badgeColor: "bg-orange-500"
    },
    {
      id: "contacts",
      label: "Contacts",
      icon: Users,
      badge: "247",
      badgeColor: "bg-gray-500"
    },
    {
      id: "calendar",
      label: "Calendar",
      icon: Calendar,
      badge: "2",
      badgeColor: "bg-blue-500"
    },
    {
      id: "integrations",
      label: "Integrations",
      icon: Plug,
      badge: null,
      badgeColor: null
    }
  ];

  return (
    <div className="w-80 whatsapp-sidebar flex flex-col">
      {/* Header */}
      <div className="p-4 bg-green-600 text-white">
        <div className="flex items-center space-x-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={currentUser.avatar || undefined} />
            <AvatarFallback className="bg-white text-green-600">
              <User className="w-5 h-5" />
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold text-sm">{currentUser.name}</h2>
            <p className="text-xs opacity-90">Personal CRM</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-2">
          <div className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;

              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  className={`w-full justify-start ${isActive ? 'nav-item active' : 'nav-item'}`}
                  onClick={() => onSetActiveModule(item.id)}
                >
                  <Icon className="mr-3 h-4 w-4" />
                  {item.label}
                  {item.badge && (
                    <Badge 
                      className={`ml-auto text-white text-xs px-2 py-0.5 ${item.badgeColor}`}
                    >
                      {item.badge}
                    </Badge>
                  )}
                  {item.id === "integrations" && (
                    <div className="ml-auto w-2 h-2 bg-green-500 rounded-full"></div>
                  )}
                </Button>
              );
            })}
          </div>
        </div>

        {/* WhatsApp Instances */}
        <div className="border-t border-gray-200 dark:border-gray-800 mt-4">
          <div className="p-3">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              WhatsApp Instances
            </h3>
            <div className="space-y-2">
              {whatsappInstances.length === 0 ? (
                <div className="flex items-center px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      No instances connected
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Connect your WhatsApp
                    </p>
                  </div>
                </div>
              ) : (
                whatsappInstances.map((instance: any) => (
                  <div key={instance.id} className="flex items-center px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className={`w-3 h-3 rounded-full mr-3 ${
                      instance.status === 'connected' ? 'bg-green-500' : 'bg-gray-400'
                    }`}></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {instance.displayName || instance.instanceName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {instance.phoneNumber ? (
                          <PhoneNumberDisplay phoneNumber={instance.phoneNumber} className="text-xs" />
                        ) : (
                          'Not connected'
                        )}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-xs text-gray-600 dark:text-gray-400">Connected</span>
          </div>
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
