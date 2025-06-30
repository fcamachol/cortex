import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Building2 } from "lucide-react";

interface Vendor {
  id: string;
  name: string;
  type: 'contact' | 'company';
  description?: string;
  email?: string;
  phone?: string;
}

interface VendorSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function VendorSelect({ value, onValueChange, placeholder = "Select vendor...", className }: VendorSelectProps) {
  const { data: vendors = [] } = useQuery({
    queryKey: ['/api/finance/vendors'],
    select: (data: any[]) => data.map(item => ({
      id: item.id,
      name: item.name,
      type: item.type as 'contact' | 'company',
      description: item.description,
      email: item.email,
      phone: item.phone
    }))
  });

  const handleValueChange = (selectedValue: string) => {
    console.log('Vendor selection changed:', selectedValue);
    onValueChange(selectedValue);
  };

  return (
    <Select value={value} onValueChange={handleValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {vendors.map((vendor) => (
          <SelectItem key={vendor.id} value={vendor.id}>
            <div className="flex items-center gap-2">
              {vendor.type === 'contact' ? (
                <User className="h-4 w-4 text-blue-500" />
              ) : (
                <Building2 className="h-4 w-4 text-green-500" />
              )}
              <div className="flex flex-col">
                <span className="font-medium">{vendor.name}</span>
                {vendor.description && (
                  <span className="text-sm text-muted-foreground">{vendor.description}</span>
                )}
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}