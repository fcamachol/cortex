import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, User, Building2 } from "lucide-react";
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

  const handleSelect = (vendorId: string) => {
    console.log('Vendor selected:', vendorId);
    onValueChange(vendorId);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          type="button"
        >
          {selectedVendor ? (
            <div className="flex items-center gap-2">
              {selectedVendor.type === 'contact' ? (
                <User className="h-4 w-4 text-blue-500" />
              ) : (
                <Building2 className="h-4 w-4 text-green-500" />
              )}
              <span>{selectedVendor.name}</span>
              {selectedVendor.description && (
                <span className="text-sm text-muted-foreground">({selectedVendor.description})</span>
              )}
            </div>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search vendors..." />
          <CommandList>
            <CommandEmpty>
              No vendors found.
            </CommandEmpty>
            {vendors.length > 0 && (
              <CommandGroup>
                {vendors.map((vendor) => (
                  <CommandItem
                    key={vendor.id}
                    value={vendor.name}
                    onSelect={() => handleSelect(vendor.id)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2 w-full">
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
                      <Check
                        className={cn(
                          "ml-auto h-4 w-4",
                          value === vendor.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}