import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Share2, Eye, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Dashboard {
  id: number;
  userId: number;
  name: string;
  description?: string;
  isDefault: boolean;
  isPublic: boolean;
  layout: any;
  filters?: any;
  createdAt: string;
  updatedAt: string;
}

interface DashboardData {
  userDashboards: Dashboard[];
  publicDashboards: Dashboard[];
}

const predefinedLayouts = [
  {
    id: "overview",
    name: "Overview Dashboard",
    description: "General metrics and KPIs",
    layout: {
      widgets: [
        { id: "total-deliveries", type: "metric", position: { x: 0, y: 0, w: 3, h: 2 } },
        { id: "completion-rate", type: "metric", position: { x: 3, y: 0, w: 3, h: 2 } },
        { id: "active-drivers", type: "metric", position: { x: 6, y: 0, w: 3, h: 2 } },
        { id: "delivery-chart", type: "chart", position: { x: 0, y: 2, w: 6, h: 4 } },
        { id: "driver-performance", type: "table", position: { x: 6, y: 2, w: 6, h: 4 } }
      ]
    }
  },
  {
    id: "driver-focus",
    name: "Driver Performance",
    description: "Driver-centric analytics",
    layout: {
      widgets: [
        { id: "driver-stats", type: "metric-grid", position: { x: 0, y: 0, w: 12, h: 2 } },
        { id: "driver-rankings", type: "table", position: { x: 0, y: 2, w: 6, h: 6 } },
        { id: "performance-trends", type: "chart", position: { x: 6, y: 2, w: 6, h: 6 } }
      ]
    }
  },
  {
    id: "operational",
    name: "Operations Dashboard",
    description: "Real-time operational metrics",
    layout: {
      widgets: [
        { id: "live-tracking", type: "map", position: { x: 0, y: 0, w: 8, h: 6 } },
        { id: "alerts", type: "alert-list", position: { x: 8, y: 0, w: 4, h: 3 } },
        { id: "eta-predictions", type: "list", position: { x: 8, y: 3, w: 4, h: 3 } },
        { id: "temperature-monitoring", type: "chart", position: { x: 0, y: 6, w: 12, h: 3 } }
      ]
    }
  }
];

export default function CustomDashboards() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null);
  const [newDashboard, setNewDashboard] = useState({
    name: "",
    description: "",
    isPublic: false,
    layout: predefinedLayouts[0].layout
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: dashboardData, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboards"],
  });

  const createDashboardMutation = useMutation({
    mutationFn: (dashboard: typeof newDashboard) => 
      apiRequest("/api/dashboards", {
        method: "POST",
        body: dashboard,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboards"] });
      setIsCreateDialogOpen(false);
      setNewDashboard({
        name: "",
        description: "",
        isPublic: false,
        layout: predefinedLayouts[0].layout
      });
      toast({
        title: "Dashboard Created",
        description: "Your custom dashboard has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create dashboard",
        variant: "destructive",
      });
    },
  });

  const updateDashboardMutation = useMutation({
    mutationFn: ({ id, ...dashboard }: { id: number } & Partial<Dashboard>) => 
      apiRequest(`/api/dashboards/${id}`, {
        method: "PUT",
        body: dashboard,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboards"] });
      setEditingDashboard(null);
      toast({
        title: "Dashboard Updated",
        description: "Your dashboard has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update dashboard",
        variant: "destructive",
      });
    },
  });

  const deleteDashboardMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/dashboards/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboards"] });
      toast({
        title: "Dashboard Deleted",
        description: "Dashboard has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete dashboard",
        variant: "destructive",
      });
    },
  });

  const handleCreateDashboard = () => {
    if (!newDashboard.name.trim()) {
      toast({
        title: "Error",
        description: "Dashboard name is required",
        variant: "destructive",
      });
      return;
    }
    createDashboardMutation.mutate(newDashboard);
  };

  const handleUpdateDashboard = () => {
    if (!editingDashboard) return;
    updateDashboardMutation.mutate(editingDashboard);
  };

  const handleDeleteDashboard = (id: number) => {
    if (window.confirm("Are you sure you want to delete this dashboard?")) {
      deleteDashboardMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Custom Dashboards</h1>
          <p className="text-gray-600 mt-2">Create and manage personalized analytics views</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Dashboard
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Dashboard</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div>
                <Label htmlFor="name">Dashboard Name</Label>
                <Input
                  id="name"
                  value={newDashboard.name}
                  onChange={(e) => setNewDashboard({ ...newDashboard, name: e.target.value })}
                  placeholder="Enter dashboard name"
                />
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newDashboard.description}
                  onChange={(e) => setNewDashboard({ ...newDashboard, description: e.target.value })}
                  placeholder="Describe your dashboard"
                />
              </div>

              <div>
                <Label>Choose a Template</Label>
                <div className="grid grid-cols-1 gap-3 mt-2">
                  {predefinedLayouts.map((template) => (
                    <div
                      key={template.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        newDashboard.layout === template.layout
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setNewDashboard({ ...newDashboard, layout: template.layout })}
                    >
                      <h4 className="font-medium">{template.name}</h4>
                      <p className="text-sm text-gray-600">{template.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="public"
                  checked={newDashboard.isPublic}
                  onCheckedChange={(checked) => setNewDashboard({ ...newDashboard, isPublic: checked })}
                />
                <Label htmlFor="public">Make this dashboard public</Label>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateDashboard}
                  disabled={createDashboardMutation.isPending}
                >
                  {createDashboardMutation.isPending ? "Creating..." : "Create Dashboard"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-8">
        {/* User's Dashboards */}
        <div>
          <h2 className="text-xl font-semibold mb-4">My Dashboards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboardData?.userDashboards.map((dashboard) => (
              <Card key={dashboard.id} className="relative">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{dashboard.name}</CardTitle>
                      {dashboard.description && (
                        <CardDescription>{dashboard.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex space-x-1">
                      {dashboard.isPublic ? (
                        <Badge variant="secondary">
                          <Share2 className="w-3 h-3 mr-1" />
                          Public
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <Lock className="w-3 h-3 mr-1" />
                          Private
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <Button variant="outline" size="sm">
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingDashboard(dashboard)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteDashboard(dashboard.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Public Dashboards */}
        {dashboardData?.publicDashboards && dashboardData.publicDashboards.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Public Dashboards</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dashboardData.publicDashboards.map((dashboard) => (
                <Card key={dashboard.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{dashboard.name}</CardTitle>
                    {dashboard.description && (
                      <CardDescription>{dashboard.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" size="sm">
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit Dashboard Dialog */}
      {editingDashboard && (
        <Dialog open={!!editingDashboard} onOpenChange={() => setEditingDashboard(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Dashboard</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div>
                <Label htmlFor="edit-name">Dashboard Name</Label>
                <Input
                  id="edit-name"
                  value={editingDashboard.name}
                  onChange={(e) => setEditingDashboard({ ...editingDashboard, name: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editingDashboard.description || ""}
                  onChange={(e) => setEditingDashboard({ ...editingDashboard, description: e.target.value })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-public"
                  checked={editingDashboard.isPublic}
                  onCheckedChange={(checked) => setEditingDashboard({ ...editingDashboard, isPublic: checked })}
                />
                <Label htmlFor="edit-public">Make this dashboard public</Label>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditingDashboard(null)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdateDashboard}
                  disabled={updateDashboardMutation.isPending}
                >
                  {updateDashboardMutation.isPending ? "Updating..." : "Update Dashboard"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}