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

  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ['/api/finance/vendors'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const selectedVendor = vendors.find(vendor => vendor.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {selectedVendor ? (
            <div className="flex items-center gap-2">
              {selectedVendor.type === 'contact' ? (
                <User className="h-4 w-4" />
              ) : (
                <Building2 className="h-4 w-4" />
              )}
              <span className="truncate">{selectedVendor.name}</span>
              {selectedVendor.description && (
                <span className="text-muted-foreground text-sm truncate">
                  - {selectedVendor.description}
                </span>
              )}
            </div>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Search vendors..." />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Loading vendors..." : "No vendors found."}
            </CommandEmpty>
            {vendors.length > 0 && (
              <CommandGroup>
                {vendors.map((vendor) => (
                  <CommandItem
                    key={vendor.id}
                    value={vendor.name}
                    onSelect={() => {
                      onValueChange(vendor.id);
                      setOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-2 w-full">
                      {vendor.type === 'contact' ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Building2 className="h-4 w-4" />
                      )}
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="font-medium truncate">{vendor.name}</span>
                        {vendor.description && (
                          <span className="text-sm text-muted-foreground truncate">
                            {vendor.description}
                          </span>
                        )}
                        {(vendor.email || vendor.phone) && (
                          <span className="text-xs text-muted-foreground truncate">
                            {[vendor.email, vendor.phone].filter(Boolean).join(' • ')}
                          </span>
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