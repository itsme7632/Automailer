import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  Mail,
  Users,
  FileText,
  Send,
  Settings,
  ShieldAlert,
  LogOut,
  Zap,
} from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  if (!user) return null;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
          <SidebarHeader className="h-16 flex items-center px-4 border-b border-sidebar-border">
            <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg text-primary tracking-tight">
              <Zap className="h-5 w-5" />
              <span>Vertex Mailer</span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/dashboard"} tooltip="Dashboard">
                      <Link href="/dashboard">
                        <LayoutDashboard className="h-4 w-4" />
                        <span>Dashboard</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.startsWith("/campaigns")} tooltip="Campaigns">
                      <Link href="/campaigns">
                        <Mail className="h-4 w-4" />
                        <span>Campaigns</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.startsWith("/leads")} tooltip="Leads">
                      <Link href="/leads">
                        <Users className="h-4 w-4" />
                        <span>Leads</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.startsWith("/templates")} tooltip="Templates">
                      <Link href="/templates">
                        <FileText className="h-4 w-4" />
                        <span>Templates</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.startsWith("/drafts")} tooltip="Drafts">
                      <Link href="/drafts">
                        <Send className="h-4 w-4" />
                        <span>Drafts</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="mt-auto">
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location === "/settings"} tooltip="Settings">
                      <Link href="/settings">
                        <Settings className="h-4 w-4" />
                        <span>Settings</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {user.role === "admin" && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location === "/admin"} tooltip="Admin">
                        <Link href="/admin">
                          <ShieldAlert className="h-4 w-4" />
                          <span>Admin</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t border-sidebar-border p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full p-2 rounded-md hover:bg-sidebar-accent transition-colors">
                  <Avatar className="h-8 w-8 border border-sidebar-border">
                    {user.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt={user.name} />
                    ) : (
                      <AvatarFallback className="bg-primary/20 text-primary text-xs">
                        {user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex flex-col items-start text-sm overflow-hidden">
                    <span className="font-medium truncate w-full text-left">{user.name}</span>
                    <span className="text-xs text-sidebar-foreground/60 truncate w-full text-left">{user.email}</span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout} className="text-destructive focus:bg-destructive/10">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-16 flex items-center px-6 border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-10 lg:hidden">
            <SidebarTrigger className="-ml-2 mr-4" />
            <h1 className="font-semibold text-lg">Vertex Mailer</h1>
          </header>
          <div className="flex-1 overflow-auto bg-background p-6">
            <div className="max-w-6xl mx-auto w-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}