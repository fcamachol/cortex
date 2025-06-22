import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Database, Users, MessageSquare, Briefcase, Calendar } from "lucide-react";

interface TableData {
  schema: string;
  table: string;
  count: number;
  sample_data: any[];
}

export default function DatabaseViewer() {
  const { data: tableData, isLoading } = useQuery({
    queryKey: ['/api/database/overview'],
    retry: false,
  });

  const { data: whatsappData } = useQuery({
    queryKey: ['/api/database/whatsapp-summary'],
    retry: false,
  });

  const { data: crmData } = useQuery({
    queryKey: ['/api/database/crm-summary'],
    retry: false,
  });

  const { data: appData } = useQuery({
    queryKey: ['/api/database/app-summary'],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-2 mb-6">
          <Database className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Database Overview</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-2 mb-6">
        <Database className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Database Overview</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">WhatsApp Schema</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{whatsappData?.total_tables || 0}</div>
            <p className="text-xs text-muted-foreground">
              {whatsappData?.total_records || 0} total records
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CRM Schema</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{crmData?.total_tables || 0}</div>
            <p className="text-xs text-muted-foreground">
              {crmData?.total_records || 0} total records
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">App Schema</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{appData?.total_tables || 0}</div>
            <p className="text-xs text-muted-foreground">
              {appData?.total_records || 0} total records
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="whatsapp" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="whatsapp">WhatsApp Data</TabsTrigger>
          <TabsTrigger value="crm">CRM Data</TabsTrigger>
          <TabsTrigger value="app">App Data</TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>WhatsApp Instances</CardTitle>
              <CardDescription>Your connected WhatsApp instances</CardDescription>
            </CardHeader>
            <CardContent>
              {whatsappData?.instances && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Instance ID</TableHead>
                      <TableHead>Display Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {whatsappData.instances.map((instance: any) => (
                      <TableRow key={instance.instance_id}>
                        <TableCell className="font-medium">{instance.instance_id}</TableCell>
                        <TableCell>{instance.display_name}</TableCell>
                        <TableCell>
                          <Badge variant={instance.is_connected ? "default" : "secondary"}>
                            {instance.is_connected ? "Connected" : "Disconnected"}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(instance.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Messages Summary</CardTitle>
              <CardDescription>Recent WhatsApp message activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold">{whatsappData?.message_count || 0}</div>
                  <p className="text-xs text-muted-foreground">Total Messages</p>
                </div>
                <div>
                  <div className="text-2xl font-bold">{whatsappData?.contact_count || 0}</div>
                  <p className="text-xs text-muted-foreground">Total Contacts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="crm" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>CRM Overview</CardTitle>
              <CardDescription>Your CRM data summary</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold">{crmData?.task_count || 0}</div>
                  <p className="text-xs text-muted-foreground">Total Tasks</p>
                </div>
                <div>
                  <div className="text-2xl font-bold">{crmData?.project_count || 0}</div>
                  <p className="text-xs text-muted-foreground">Total Projects</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="app" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Users & Workspaces</CardTitle>
              <CardDescription>Your application data</CardDescription>
            </CardHeader>
            <CardContent>
              {appData?.users && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appData.users.map((user: any) => (
                      <TableRow key={user.user_id}>
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell>{user.full_name}</TableCell>
                        <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}