import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronDown, User, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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

  const selectedVendor = vendors.find(vendor => vendor.id === value);
  
  // Filter vendors based on search
  const filteredVendors = vendors.filter(vendor =>
    vendor.name.toLowerCase().includes(searchValue.toLowerCase()) ||
    (vendor.description && vendor.description.toLowerCase().includes(searchValue.toLowerCase()))
  );

  const handleSelect = (vendor: Vendor) => {
    console.log('Vendor selected:', vendor.id);
    onValueChange(vendor.id);
    setSearchValue(vendor.name);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    if (!open) {
      setOpen(true);
    }
  };

  const handleInputFocus = () => {
    setOpen(true);
  };

  // Reset search value when value changes externally
  useEffect(() => {
    if (selectedVendor) {
      setSearchValue(selectedVendor.name);
    } else {
      setSearchValue("");
    }
  }, [selectedVendor]);

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              ref={inputRef}
              value={searchValue}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              placeholder={placeholder}
              className={cn("pr-10", className)}
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setOpen(!open)}
              type="button"
            >
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-2" align="start">
          <div className="max-h-[200px] overflow-y-auto">
            {filteredVendors.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground">
                No vendors found.
              </div>
            ) : (
              filteredVendors.map((vendor) => (
                <div
                  key={vendor.id}
                  className="flex items-center gap-2 p-2 hover:bg-accent hover:text-accent-foreground rounded-sm cursor-pointer"
                  onClick={() => handleSelect(vendor)}
                >
                  {vendor.type === 'contact' ? (
                    <User className="h-4 w-4 text-blue-500" />
                  ) : (
                    <Building2 className="h-4 w-4 text-green-500" />
                  )}
                  <div className="flex flex-col flex-1">
                    <span className="font-medium">{vendor.name}</span>
                    {vendor.description && (
                      <span className="text-sm text-muted-foreground">{vendor.description}</span>
                    )}
                  </div>
                  {value === vendor.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}