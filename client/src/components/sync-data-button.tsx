import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function SyncDataButton() {
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
            contextOwnerId: authData.contextOwnerId
          })
        });
        
        if (!deliveriesResponse.ok) {
          throw new Error(`Deliveries fetch failed: ${deliveriesResponse.status}`);
        }
        
        const deliveriesData = await deliveriesResponse.json();
        if (!deliveriesData.success) {
          throw new Error('Failed to fetch deliveries');
        }
        
        console.log(`Retrieved ${deliveriesData.deliveries.length} deliveries from axylog`);
        
        // Step 3: Store deliveries in database via API
        const userToken = localStorage.getItem('token');
        const storeResponse = await fetch(`${baseUrl}/api/consignments/sync-from-axylog`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${userToken}`
          },
          body: JSON.stringify({
            deliveries: deliveriesData.deliveries
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
      {syncMutation.isPending ? "Syncing..." : "Sync from Axylog"}
    </Button>
  );
}