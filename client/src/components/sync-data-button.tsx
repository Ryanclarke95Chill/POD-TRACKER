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
      const token = localStorage.getItem('token');
      const response = await fetch("/api/sync-axylog-now", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate consignments cache to refresh the table
      queryClient.invalidateQueries({ queryKey: ["/api/consignments"] });
      
      toast({
        title: "Sync Complete",
        description: `Successfully synced ${data.count} consignments from axylog`,
      });
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