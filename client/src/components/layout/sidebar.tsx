import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, CheckSquare, Users, Calendar, Plug, Settings, User, Activity, Zap, LogOut, Plus, Hash, DollarSign, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatPhoneNumber } from "@/lib/phoneUtils";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { SpacesSidebar } from "@/components/sidebar/SpacesSidebar";
import { Space } from "@shared/schema";

interface SidebarProps {
  activeModule: string;
  onSetActiveModule: (module: string) => void;
}

export default function Sidebar({ activeModule, onSetActiveModule }: SidebarProps) {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Use authenticated user data with fallback for demo
  const currentUser = {
    id: user?.userId || "7804247f-3ae8-4eb2-8c6d-2c44f967ad42",
    name: user?.fullName || user?.email || "Demo User",
    email: user?.email || "demo@example.com",
    avatar: null
  };



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
      id: "finance",
      label: "Finance",
      icon: DollarSign,
      badge: null,
      badgeColor: null
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
      id: "actions",
      label: "Actions",
      icon: Zap,
      badge: "3",
      badgeColor: "bg-purple-500"
    },
    {
      id: "integrations",
      label: "Integrations",
      icon: Plug,
      badge: null,
      badgeColor: null
    },

  ];

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-80'} whatsapp-sidebar flex flex-col transition-all duration-300 ease-in-out`}>
      {/* Header */}
      <div className="p-4 bg-green-600 text-white relative">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
          <Avatar className="w-10 h-10">
            <AvatarImage src={currentUser.avatar || undefined} />
            <AvatarFallback className="bg-white text-green-600">
              <User className="w-5 h-5" />
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div>
              <h2 className="font-semibold text-sm">{currentUser.name}</h2>
              <p className="text-xs opacity-90">Personal CRM</p>
            </div>
          )}
        </div>
        
        {/* Toggle Button */}
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 h-6 w-6 p-0 text-white hover:bg-white/20"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Integrated Spaces Sidebar - Full View */}
        {!isCollapsed && (
          <div className="p-3 border-b border-gray-200 dark:border-gray-800">
            <SpacesSidebar 
              onSpaceSelect={(space) => {
                // Set active module to spaces and pass the selected space
                onSetActiveModule("spaces");
                // We need to communicate the selected space ID to Dashboard
                window.dispatchEvent(new CustomEvent('spaceSelected', { detail: { spaceId: space.id } }));
              }}
              onNavigateToSpaces={() => {
                // Navigate to all spaces view within Dashboard
                onSetActiveModule("spaces");
              }}
            />
          </div>
        )}
        
        {/* Collapsed Spaces Indicator */}
        {isCollapsed && (
          <div className="p-2 border-b border-gray-200 dark:border-gray-800">
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-10 p-0 justify-center"
              title="Spaces - Click to expand sidebar"
              onClick={() => setIsCollapsed(false)}
            >
              <Hash className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Main Navigation */}
        <div className="p-2">
          <div className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;

              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  className={`w-full ${isCollapsed ? 'justify-center px-0 relative' : 'justify-start'} ${isActive ? 'nav-item active' : 'nav-item'}`}
                  onClick={() => onSetActiveModule(item.id)}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className={`h-4 w-4 ${isCollapsed ? '' : 'mr-3'}`} />
                  {!isCollapsed && (
                    <>
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
                    </>
                  )}
                  {isCollapsed && item.badge && (
                    <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></div>
                  )}
                </Button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        {!isCollapsed && (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-gray-600 dark:text-gray-400">Connected</span>
              </div>
              <div className="flex items-center space-x-1">
                <Link href="/tasks">
                  <Button variant="ghost" size="sm" title="Task Management">
                    <CheckSquare className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/debug">
                  <Button variant="ghost" size="sm" title="WebSocket Debug Monitor">
                    <Activity className="h-4 w-4" />
                  </Button>
                </Link>
                <Button variant="ghost" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* User Section */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-800">
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={currentUser.avatar || undefined} />
                  <AvatarFallback>
                    {currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {currentUser.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {currentUser.email}
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={logout}
                title="Sign out"
                className="ml-2 text-gray-500 hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
        
        {/* Collapsed Footer */}
        {isCollapsed && (
          <div className="flex flex-col items-center space-y-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" title="Connected"></div>
            <div className="flex flex-col items-center space-y-1">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Task Management">
                <CheckSquare className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Settings">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
            <Avatar className="h-8 w-8" title={currentUser.name}>
              <AvatarImage src={currentUser.avatar || undefined} />
              <AvatarFallback>
                {currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={logout}
              title="Sign out"
              className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}