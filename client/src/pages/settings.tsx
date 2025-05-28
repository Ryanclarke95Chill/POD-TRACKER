import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Save, RotateCcw } from "lucide-react";

// All available database fields with user-friendly labels
const DEFAULT_FIELD_LABELS: Record<string, string> = {
  consignment_number: "Consignment Number",
  customer_name: "Customer Name", 
  consignment_reference: "Consignment Reference",
  tracking_link: "Tracking Link",
  pickup_address: "Pickup Address",
  delivery_address: "Delivery Address",
  status: "Status",
  estimated_delivery_date: "Estimated Delivery Date",
  delivery_date: "Delivery Date",
  date_delivered: "Date Delivered",
  consignment_required_delivery_date: "Required Delivery Date",
  temperature_zone: "Temperature Zone",
  last_known_location: "Last Known Location",
  delivery_run: "Delivery Run",
  quantity: "Quantity",
  pallets: "Pallets",
  spaces: "Spaces",
  cubic_meters: "Cubic Meters",
  weight_kg: "Weight (kg)",
  shipper: "Shipper",
  receiver: "Receiver",
  pickup_company: "Pickup Company",
  delivery_company: "Delivery Company",
  pickup_contact_name: "Pickup Contact Name",
  delivery_contact_name: "Delivery Contact Name",
  pickup_contact_phone: "Pickup Contact Phone",
  delivery_contact_phone: "Delivery Contact Phone",
  special_instructions: "Special Instructions",
  product_description: "Product Description",
  delivery_instructions: "Delivery Instructions",
  pickup_instructions: "Pickup Instructions",
  delivery_livetrack_link: "Delivery Livetrack Link",
  customer_order_number: "Customer Order Number",
  document_string2: "Document String 2",
  from_location: "From Location",
  to_location: "To Location",
  group_causal_delivery_outcome: "Group Causal Delivery Outcome",
  delivery_planned_eta: "Delivery Planned ETA",
  recorded_temperature: "Recorded Temperature",
  quantity_unit_of_measurement: "Quantity Unit of Measurement",
  quantity_unit_of_measurement1: "Quantity Unit of Measurement 1",
  quantity_unit_of_measurement2: "Quantity Unit of Measurement 2",
  route: "Route",
  driver: "Driver",
  vehicle: "Vehicle",
  delivery_time: "Delivery Time",
  pickup_time: "Pickup Time",
  consignment_type: "Consignment Type",
  priority: "Priority",
  delivery_zone: "Delivery Zone",
  pickup_zone: "Pickup Zone",
  notes: "Notes",
  customer_reference: "Customer Reference",
  invoice_number: "Invoice Number",
  pod_signature: "PoD Signature",
  delivery_proof: "Delivery Proof",
  vehicle_code: "Vehicle Code",
  delivery_eta_deviation: "Delivery ETA Deviation",
  received_delivery_pod_files: "Received Delivery PoD Files",
  trip_number: "Trip Number",
  from: "From",
  to: "To",
  carrier: "Carrier",
  required_tags: "Required Tags",
  order_carrier_email: "Order Carrier Email",
  order_number: "Order Number",
  delivery_calculated_eta: "Delivery Calculated ETA",
  time_spent_in_the_unloading_area: "Time Spent in Unloading Area",
  delivery_outcome_causal: "Delivery Outcome Causal",
  delivery_arrival_date: "Delivery Arrival Date",
  delivery_outcome_date: "Delivery Outcome Date",
  delivery_unload_date: "Delivery Unload Date",
  delivery_outcome_note: "Delivery Outcome Note",
  delivery_last_position: "Delivery Last Position",
  delivery_last_position_date: "Delivery Last Position Date",
  pickup_planned_eta: "Pickup Planned ETA",
  eta_delivery_on_departure: "ETA Delivery on Departure",
  delivery_live_distance_km: "Delivery Live Distance (km)",
  delivery_distance_km: "Delivery Distance (km)",
  delivery_outcome_transmission_date: "Delivery Outcome Transmission Date",
  delivery_outcome_receipt_date: "Delivery Outcome Receipt Date",
  delivery_unload_sequence: "Delivery Unload Sequence",
  delivery_time_window: "Delivery Time Window",
  pickup_arrival_date: "Pickup Arrival Date",
  pickup_outcome_date: "Pickup Outcome Date",
  pickup_load_date: "Pickup Load Date",
  pickup_outcome_reason: "Pickup Outcome Reason",
  group_causal_pickup_outcome: "Group Causal Pickup Outcome",
  pickup_outcome_note: "Pickup Outcome Note",
  pickup_last_position: "Pickup Last Position",
  pickup_last_position_date: "Pickup Last Position Date",
  pickup_calculated_eta: "Pickup Calculated ETA",
  eta_pickup_on_departure: "ETA Pickup on Departure",
  pickup_live_distance_km: "Pickup Live Distance (km)",
  pickup_distance_km: "Pickup Distance (km)",
  pickup_outcome_receipt_date: "Pickup Outcome Receipt Date",
  pickup_load_sequence: "Pickup Load Sequence",
  pickup_time_window: "Pickup Time Window",
  from_master_data_code: "From Master Data Code",
  shipper_city: "Shipper City",
  shipper_province: "Shipper Province",
  shipper_master_data_code: "Shipper Master Data Code",
  depot: "Depot",
  depot_master_data_code: "Depot Master Data Code",
  recipient_master_data_code: "Recipient Master Data Code",
  delivery_city: "Delivery City",
  delivery_province: "Delivery Province",
  carrier_master_data_code: "Carrier Master Data Code",
  sub_carrier: "Sub Carrier",
  sub_carrier_master_data_code: "Sub Carrier Master Data Code",
  order_date: "Order Date",
  document_note: "Document Note",
  order_type: "Order Type",
  order_series: "Order Series",
  shipper_order_reference_number: "Shipper Order Reference Number",
  error_description: "Error Description",
  driver_phone: "Driver Phone",
  tractor_license_plate: "Tractor License Plate",
  trailer_license_plate: "Trailer License Plate",
  delivery_outcome: "Delivery Outcome",
  delivery_punctuality: "Delivery Punctuality",
  delivery_geolocalization_state: "Delivery Geolocalization State",
  pickup_outcome: "Pickup Outcome",
  pickup_punctuality: "Pickup Punctuality",
  pickup_geolocation_state: "Pickup Geolocation State",
  delivery_state: "Delivery State",
  pickup_state: "Pickup State",
  destination_coordinates: "Destination Coordinates",
  departure_coordinates: "Departure Coordinates",
  expected_temperature: "Expected Temperature",
  delivery_maximum_date: "Delivery Maximum Date",
  delivery_minimum_date: "Delivery Minimum Date",
  pickup_minimum_date: "Pickup Minimum Date",
  pickup_maximum_date: "Pickup Maximum Date",
  volume_m3: "Volume (m³)",
  linear_meters_m: "Linear Meters (m)",
  ground_bases: "Ground Bases",
  document_date1: "Document Date 1",
  document_date2: "Document Date 2",
  document_date3: "Document Date 3",
  document_string1: "Document String 1",
  document_string3: "Document String 3",
  time_spent_in_the_loading_area: "Time Spent in Loading Area",
  delivery_outcome_in_area: "Delivery Outcome in Area",
  pickup_outcome_in_area: "Pickup Outcome in Area",
  delivery_outcome_position: "Delivery Outcome Position",
  pickup_outcome_position: "Pickup Outcome Position",
  seals: "Seals",
  task_id: "Task ID",
  id_creation_import: "ID Creation Import",
  expected_payment_method_code: "Expected Payment Method Code",
  expected_payment_method: "Expected Payment Method",
  delivery_outcome_registration_date: "Delivery Outcome Registration Date",
  pickup_outcome_registration_date: "Pickup Outcome Registration Date",
  delivery_pin_is_valid: "Delivery PIN is Valid",
  pick_up_pin_is_valid: "Pickup PIN is Valid",
  expected_payment_notes: "Expected Payment Notes",
  delivery_pod_files: "Delivery PoD Files",
  pickup_pod_files: "Pickup PoD Files",
  departure_date_initially_planned_by_the_context: "Departure Date Initially Planned",
  order_carrier_mobile_telephone_number: "Order Carrier Mobile",
  order_carrier_telephone_number: "Order Carrier Phone",
  order_pickup_email: "Order Pickup Email",
  order_pickup_mobile_telephone_number: "Order Pickup Mobile",
  order_pickup_telephone_number: "Order Pickup Phone",
  order_delivery_email: "Order Delivery Email",
  order_delivery_mobile_telephone_number: "Order Delivery Mobile",
  order_delivery_telephone_number: "Order Delivery Phone",
  order_sub_carrier_email: "Order Sub Carrier Email",
  order_sub_carrier_mobile_telephone_number: "Order Sub Carrier Mobile",
  order_sub_carrier_telephone_number: "Order Sub Carrier Phone",
  order_shipper_email: "Order Shipper Email",
  order_shipper_mobile_telephone_number: "Order Shipper Mobile",
  order_shipper_telephone_number: "Order Shipper Phone",
  forbidden_tags: "Forbidden Tags",
  pickup_planned_service_time: "Pickup Planned Service Time",
  delivery_planned_service_time: "Delivery Planned Service Time",
  external_reference: "External Reference",
  depot_phone_number_specified_in_the_order: "Depot Phone Number",
  depot_mobile_phone_number_specified_in_the_order: "Depot Mobile Number",
  received_pickup_pod_files: "Received Pickup PoD Files",
  required_tags_description: "Required Tags Description",
  forbidden_tags_description: "Forbidden Tags Description",
  from_postal_code: "From Postal Code",
  to_postal_code: "To Postal Code",
  from_country: "From Country",
  to_country: "To Country",
  pickup_eta_deviation: "Pickup ETA Deviation",
  pickup_livetrack_link: "Pickup Livetrack Link",
  vehicle_description: "Vehicle Description"
};

// Commonly used fields for dashboard display
const DASHBOARD_FIELDS = [
  'consignment_number',
  'customer_name', 
  'delivery_address',
  'pickup_address',
  'status',
  'estimated_delivery_date',
  'temperature_zone',
  'vehicle_code',
  'delivery_planned_eta',
  'carrier',
  'driver',
  'from',
  'to',
  'delivery_outcome',
  'expected_temperature',
  'weight_kg',
  'quantity'
];

export default function Settings() {
  const { toast } = useToast();
  const [fieldLabels, setFieldLabels] = useState<Record<string, string>>({});
  const [visibleFields, setVisibleFields] = useState<string[]>([]);
  const [allDatabaseFields, setAllDatabaseFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load database schema and saved settings
  useEffect(() => {
    const loadDatabaseFields = async () => {
      try {
        // Fetch all database columns from the API
        const token = localStorage.getItem('token');
        const response = await fetch('/api/database/columns', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const databaseFields = await response.json();
        
        if (databaseFields && Array.isArray(databaseFields)) {
          setAllDatabaseFields(databaseFields);
          
          // Create field labels for all database fields
          const dynamicLabels: Record<string, string> = {};
          databaseFields.forEach((field: string) => {
            // Convert snake_case to Title Case for all fields
            dynamicLabels[field] = field
              .split('_')
              .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          });
          
          // Load saved settings or use defaults
          const savedLabels = localStorage.getItem('field-labels');
          const savedVisible = localStorage.getItem('visible-fields');
          
          if (savedLabels) {
            setFieldLabels({ ...dynamicLabels, ...JSON.parse(savedLabels) });
          } else {
            setFieldLabels(dynamicLabels);
          }
          
          if (savedVisible) {
            setVisibleFields(JSON.parse(savedVisible));
          } else {
            setVisibleFields(DASHBOARD_FIELDS);
          }
        }
      } catch (error) {
        console.error('Error loading database fields:', error);
        // Fallback to predefined fields
        setFieldLabels(DEFAULT_FIELD_LABELS);
        setVisibleFields(DASHBOARD_FIELDS);
        setAllDatabaseFields(Object.keys(DEFAULT_FIELD_LABELS));
      } finally {
        setLoading(false);
      }
    };

    loadDatabaseFields();
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
          {loading ? (
            <div className="text-center py-8">Loading database fields...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allDatabaseFields.map((fieldKey) => (
                <div key={fieldKey} className="space-y-2">
                  <Label htmlFor={fieldKey} className="text-sm font-medium">
                    {fieldKey}
                  </Label>
                  <Input
                    id={fieldKey}
                    value={fieldLabels[fieldKey] || fieldKey}
                    onChange={(e) => handleLabelChange(fieldKey, e.target.value)}
                    placeholder="Enter display label"
                  />
                </div>
              ))}
            </div>
          )}
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