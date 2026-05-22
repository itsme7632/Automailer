import { useState } from "react";
import { 
  useAdminGetUsers, 
  useAdminGetStats, 
  useAdminGetLogs 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Mail, BarChart3, Database } from "lucide-react";

export default function Admin() {
  const { data: stats, isLoading: isStatsLoading } = useAdminGetStats();
  
  const [userPage, setUserPage] = useState(1);
  const { data: users, isLoading: isUsersLoading } = useAdminGetUsers({ page: userPage, limit: 10 });
  
  const [logPage, setLogPage] = useState(1);
  const { data: logs, isLoading: isLogsLoading } = useAdminGetLogs({ page: logPage, limit: 10 });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Admin Dashboard</h2>
        <p className="text-muted-foreground mt-1">System administration, usage stats, and logs.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Users</p>
              {isStatsLoading ? <Skeleton className="h-8 w-16 mt-1" /> : <h4 className="text-2xl font-bold">{stats?.totalUsers || 0}</h4>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Drafts Generated</p>
              {isStatsLoading ? <Skeleton className="h-8 w-16 mt-1" /> : <h4 className="text-2xl font-bold">{stats?.totalDraftsCreated || 0}</h4>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Leads</p>
              {isStatsLoading ? <Skeleton className="h-8 w-16 mt-1" /> : <h4 className="text-2xl font-bold">{stats?.totalLeads || 0}</h4>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">AI Calls</p>
              {isStatsLoading ? <Skeleton className="h-8 w-16 mt-1" /> : <h4 className="text-2xl font-bold">{stats?.totalAiCalls || 0}</h4>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="logs">System Logs</TabsTrigger>
        </TabsList>
        
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Gmail Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isUsersLoading ? (
                    Array(5).fill(0).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      </TableRow>
                    ))
                  ) : users?.data?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No users found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    users?.data?.map(user => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell className="capitalize">{user.role}</TableCell>
                        <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {user.gmailConnected ? (
                            <span className="text-green-500 text-xs font-medium bg-green-500/10 px-2 py-0.5 rounded">Connected</span>
                          ) : (
                            <span className="text-muted-foreground text-xs font-medium bg-muted px-2 py-0.5 rounded">Not Connected</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between mt-4">
                <Button variant="outline" size="sm" disabled={userPage === 1} onClick={() => setUserPage(p => p - 1)}>Previous</Button>
                <span className="text-sm text-muted-foreground">Page {users?.page || 1} of {Math.ceil((users?.total || 0) / 10) || 1}</span>
                <Button variant="outline" size="sm" disabled={userPage >= Math.ceil((users?.total || 0) / 10)} onClick={() => setUserPage(p => p + 1)}>Next</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLogsLoading ? (
                    Array(5).fill(0).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      </TableRow>
                    ))
                  ) : logs?.data?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No logs found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs?.data?.map(log => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            log.type.includes('error') || log.type.includes('failed') ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'
                          }`}>
                            {log.type}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-md truncate">{log.description}</TableCell>
                        <TableCell>{log.userId || '-'}</TableCell>
                        <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between mt-4">
                <Button variant="outline" size="sm" disabled={logPage === 1} onClick={() => setLogPage(p => p - 1)}>Previous</Button>
                <span className="text-sm text-muted-foreground">Page {logs?.page || 1} of {Math.ceil((logs?.total || 0) / 10) || 1}</span>
                <Button variant="outline" size="sm" disabled={logPage >= Math.ceil((logs?.total || 0) / 10)} onClick={() => setLogPage(p => p + 1)}>Next</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}