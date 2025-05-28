import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Save, RotateCcw } from "lucide-react";

// Default field labels mapping
const DEFAULT_FIELD_LABELS: Record<string, string> = {
  consignmentNumber: "Consignment Number",
  customerName: "Customer Name",
  deliveryAddress: "Delivery Address",
  pickupAddress: "Pickup Address",
  status: "Status",
  estimatedDeliveryDate: "Estimated Delivery Date",
  temperatureZone: "Temperature Zone",
  lastKnownLocation: "Last Known Location",
  vehicleCode: "Vehicle Code",
  deliveryPlannedEta: "Delivery Planned ETA",
  deliveryEtaDeviation: "Delivery ETA Deviation",
  requiredTags: "Required Tags",
  from: "From",
  to: "To",
  carrier: "Carrier",
  driver: "Driver",
  tripNumber: "Trip Number",
  orderNumber: "Order Number",
  deliveryLivetrackLink: "Delivery Livetrack Link",
  orderCarrierEmail: "Order Carrier Email",
  receivedDeliveryPodFiles: "Received Delivery PoD Files",
  customerOrderNumber: "Customer Order Number",
  deliveryCalculatedEta: "Delivery Calculated ETA",
  shipper: "Shipper",
  deliveryOutcome: "Delivery Outcome",
  pickupOutcome: "Pickup Outcome",
  deliveryState: "Delivery State",
  pickupState: "Pickup State",
  expectedTemperature: "Expected Temperature",
  recordedTemperature: "Recorded Temperature",
  weightKg: "Weight (kg)",
  volumeM3: "Volume (m³)",
  quantity: "Quantity",
  pallets: "Pallets",
  spaces: "Spaces",
};

// Commonly used fields for dashboard display
const DASHBOARD_FIELDS = [
  'consignmentNumber',
  'customerName', 
  'deliveryAddress',
  'pickupAddress',
  'status',
  'estimatedDeliveryDate',
  'temperatureZone',
  'vehicleCode',
  'deliveryPlannedEta',
  'carrier',
  'driver',
  'from',
  'to',
  'deliveryOutcome',
  'expectedTemperature',
  'weightKg',
  'quantity'
];

export default function Settings() {
  const { toast } = useToast();
  const [fieldLabels, setFieldLabels] = useState<Record<string, string>>({});
  const [visibleFields, setVisibleFields] = useState<string[]>([]);

  // Load saved settings
  useEffect(() => {
    const savedLabels = localStorage.getItem('field-labels');
    const savedVisible = localStorage.getItem('visible-fields');
    
    if (savedLabels) {
      setFieldLabels({ ...DEFAULT_FIELD_LABELS, ...JSON.parse(savedLabels) });
    } else {
      setFieldLabels(DEFAULT_FIELD_LABELS);
    }
    
    if (savedVisible) {
      setVisibleFields(JSON.parse(savedVisible));
    } else {
      setVisibleFields(DASHBOARD_FIELDS);
    }
  }, []);

  const handleLabelChange = (fieldKey: string, newLabel: string) => {
    setFieldLabels(prev => ({
      ...prev,
      [fieldKey]: newLabel
    }));
  };

  const toggleFieldVisibility = (fieldKey: string) => {
    setVisibleFields(prev => 
      prev.includes(fieldKey) 
        ? prev.filter(f => f !== fieldKey)
        : [...prev, fieldKey]
    );
  };

  const saveSettings = () => {
    localStorage.setItem('field-labels', JSON.stringify(fieldLabels));
    localStorage.setItem('visible-fields', JSON.stringify(visibleFields));
    toast({
      title: "Settings saved",
      description: "Your field labels and visibility settings have been saved.",
    });
  };

  const resetToDefaults = () => {
    setFieldLabels(DEFAULT_FIELD_LABELS);
    setVisibleFields(DASHBOARD_FIELDS);
    localStorage.removeItem('field-labels');
    localStorage.removeItem('visible-fields');
    toast({
      title: "Settings reset",
      description: "All settings have been reset to defaults.",
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Display Settings</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetToDefaults}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button onClick={saveSettings}>
            <Save className="h-4 w-4 mr-2" />
            Save Settings
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Field Labels</CardTitle>
          <p className="text-sm text-gray-600">
            Customize how field names appear in the dashboard and throughout the application.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(fieldLabels).map(([fieldKey, label]) => (
              <div key={fieldKey} className="space-y-2">
                <Label htmlFor={fieldKey} className="text-sm font-medium">
                  {fieldKey}
                </Label>
                <Input
                  id={fieldKey}
                  value={label}
                  onChange={(e) => handleLabelChange(fieldKey, e.target.value)}
                  placeholder="Enter display label"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dashboard Columns</CardTitle>
          <p className="text-sm text-gray-600">
            Select which fields to display in the main dashboard table.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Object.keys(fieldLabels).map((fieldKey) => (
              <div key={fieldKey} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`visible-${fieldKey}`}
                  checked={visibleFields.includes(fieldKey)}
                  onChange={() => toggleFieldVisibility(fieldKey)}
                  className="rounded border-gray-300"
                />
                <Label 
                  htmlFor={`visible-${fieldKey}`}
                  className="text-sm cursor-pointer"
                >
                  {fieldLabels[fieldKey]}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <p className="text-sm text-gray-600">
            Currently selected fields for dashboard display:
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {visibleFields.map((fieldKey) => (
              <div
                key={fieldKey}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
              >
                {fieldLabels[fieldKey]}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}