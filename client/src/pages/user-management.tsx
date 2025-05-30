import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Edit2, Shield, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: number;
  username: string;
  email: string;
  name: string;
  role: string;
  department?: string;
  isActive: boolean;
}

const userRoles = [
  { value: "admin", label: "Administrator", description: "Full system access, user management" },
  { value: "manager", label: "Manager", description: "All analytics, driver management" },
  { value: "supervisor", label: "Supervisor", description: "Department analytics, limited access" },
  { value: "driver", label: "Driver", description: "Own deliveries only" },
  { value: "viewer", label: "Viewer", description: "Read-only analytics access" }
];

const departments = [
  "Sydney Depot",
  "Melbourne Depot", 
  "Brisbane Depot",
  "Perth Depot",
  "Adelaide Depot",
  "Operations",
  "Management",
  "IT Support"
];

export default function UserManagement() {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, ...userData }: { id: number } & Partial<User>) => 
      apiRequest(`/api/users/${id}`, {
        method: "PUT",
        body: userData,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsEditDialogOpen(false);
      setEditingUser(null);
      toast({
        title: "User Updated",
        description: "User permissions have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    },
  });

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setIsEditDialogOpen(true);
  };

  const handleUpdateUser = () => {
    if (!editingUser) return;
    updateUserMutation.mutate(editingUser);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin": return "bg-red-100 text-red-800";
      case "manager": return "bg-blue-100 text-blue-800";
      case "supervisor": return "bg-green-100 text-green-800";
      case "driver": return "bg-yellow-100 text-yellow-800";
      case "viewer": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-gray-600 mt-2">Manage user roles and permissions</p>
        </div>
        
        <Button>
          <UserPlus className="w-4 h-4 mr-2" />
          Add New User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Users</CardTitle>
          <CardDescription>
            Manage user access levels and department assignments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getRoleBadgeColor(user.role)}>
                      <Shield className="w-3 h-3 mr-1" />
                      {userRoles.find(r => r.value === user.role)?.label || user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.department ? (
                      <Badge variant="outline">
                        <Building className="w-3 h-3 mr-1" />
                        {user.department}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">No department</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "default" : "secondary"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditUser(user)}
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Role Permissions Reference */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
          <CardDescription>Understanding access levels for each role</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userRoles.map((role) => (
              <div key={role.value} className="p-4 border rounded-lg">
                <div className="flex items-center mb-2">
                  <Badge className={getRoleBadgeColor(role.value)}>
                    {role.label}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mb-3">{role.description}</p>
                <div className="text-xs space-y-1">
                  {role.value === "admin" && (
                    <>
                      <div>✓ All system access</div>
                      <div>✓ User management</div>
                      <div>✓ Custom dashboards</div>
                      <div>✓ Data synchronization</div>
                    </>
                  )}
                  {role.value === "manager" && (
                    <>
                      <div>✓ Full analytics access</div>
                      <div>✓ Driver management</div>
                      <div>✓ Custom dashboards</div>
                      <div>✓ Data synchronization</div>
                    </>
                  )}
                  {role.value === "supervisor" && (
                    <>
                      <div>✓ Department analytics</div>
                      <div>✓ Custom dashboards</div>
                      <div>× User management</div>
                    </>
                  )}
                  {role.value === "driver" && (
                    <>
                      <div>✓ Own deliveries only</div>
                      <div>× Analytics access</div>
                      <div>× Dashboard creation</div>
                    </>
                  )}
                  {role.value === "viewer" && (
                    <>
                      <div>✓ Read-only analytics</div>
                      <div>× Dashboard creation</div>
                      <div>× Data modification</div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      {editingUser && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit User Permissions</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div>
                <Label>User</Label>
                <div className="mt-1">
                  <div className="font-medium">{editingUser.name}</div>
                  <div className="text-sm text-gray-500">{editingUser.email}</div>
                </div>
              </div>

              <div>
                <Label htmlFor="role">Role</Label>
                <Select
                  value={editingUser.role}
                  onValueChange={(value) => setEditingUser({ ...editingUser, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {userRoles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div>
                          <div className="font-medium">{role.label}</div>
                          <div className="text-xs text-gray-500">{role.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="department">Department</Label>
                <Select
                  value={editingUser.department || ""}
                  onValueChange={(value) => setEditingUser({ ...editingUser, department: value || undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No department</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={editingUser.isActive}
                  onCheckedChange={(checked) => setEditingUser({ ...editingUser, isActive: checked })}
                />
                <Label htmlFor="active">User is active</Label>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdateUser}
                  disabled={updateUserMutation.isPending}
                >
                  {updateUserMutation.isPending ? "Updating..." : "Update User"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}