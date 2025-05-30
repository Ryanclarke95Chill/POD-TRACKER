import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Download, Calendar, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function SyncDataButton() {
  const [syncFromDate, setSyncFromDate] = useState<string>("");
  const [syncToDate, setSyncToDate] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const syncMutation = useMutation({
    mutationFn: async () => {
      try {
        console.log('Starting axylog sync...');
        
        // Get base URL for the current environment
        const baseUrl = window.location.origin;
        
        // Step 1: Authenticate with axylog
        const authResponse = await fetch(`${baseUrl}/axylog-proxy/auth`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          }
        });
        
        if (!authResponse.ok) {
          throw new Error(`Auth failed: ${authResponse.status}`);
        }
        
        const authData = await authResponse.json();
        if (!authData.success) {
          throw new Error('Axylog authentication failed');
        }
        
        console.log('Axylog authentication successful');
        
        // Step 2: Fetch deliveries using auth credentials
        const deliveriesResponse = await fetch(`${baseUrl}/axylog-proxy/deliveries`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            token: authData.token,
            userId: authData.userId,
            companyId: authData.companyId,
            contextOwnerId: authData.contextOwnerId,
            fromDate: syncFromDate,
            toDate: syncToDate
          })
        });
        
        if (!deliveriesResponse.ok) {
          throw new Error(`Deliveries fetch failed: ${deliveriesResponse.status}`);
        }
        
        const deliveriesData = await deliveriesResponse.json();
        if (!deliveriesData.success) {
          throw new Error('Failed to fetch deliveries');
        }
        
        const deliveries = deliveriesData.data.itemList || [];
        console.log(`Retrieved ${deliveries.length} deliveries from axylog`);
        
        // Step 3: Store deliveries in database via API
        const userToken = localStorage.getItem('token');
        const storeResponse = await fetch(`${baseUrl}/api/consignments/sync-from-axylog`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${userToken}`
          },
          body: JSON.stringify({
            deliveries: deliveries
          })
        });
        
        if (!storeResponse.ok) {
          throw new Error(`Store failed: ${storeResponse.status}`);
        }
        
        return await storeResponse.json();
        
      } catch (error) {
        console.error('Sync error:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // Invalidate consignments cache to refresh the table
      queryClient.invalidateQueries({ queryKey: ["/api/consignments"] });
      
      toast({
        title: "Sync Complete", 
        description: "Your Chill Transport Company data has been synced successfully",
      });
      
      // Close dialog and reset dates
      setIsDialogOpen(false);
      setSyncFromDate("");
      setSyncToDate("");
      
      // Force page reload to show updated data
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync data from axylog",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 text-white">
          <Download className="h-4 w-4 mr-2" />
          Sync from Axylog
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sync Data from Axylog</DialogTitle>
          <DialogDescription>
            Select a date range to fetch consignment data from Axylog. Leave empty to sync today's data.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="sync-from-date" className="block text-sm font-medium text-gray-700 mb-1">
                From Date
              </label>
              <Input
                id="sync-from-date"
                type="date"
                value={syncFromDate}
                onChange={(e) => setSyncFromDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label htmlFor="sync-to-date" className="block text-sm font-medium text-gray-700 mb-1">
                To Date
              </label>
              <Input
                id="sync-to-date"
                type="date"
                value={syncToDate}
                onChange={(e) => setSyncToDate(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={syncMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {syncMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {syncMutation.isPending ? "Syncing..." : "Start Sync"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}