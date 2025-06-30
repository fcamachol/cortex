import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Check, ChevronDown, User, Building2, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

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
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newEntityType, setNewEntityType] = useState<'contact' | 'company'>('contact');
  const [newEntityName, setNewEntityName] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

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

  // Mutation for creating new contacts/companies
  const createContactMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      return apiRequest(`/api/cortex/entities/persons`, {
        method: 'POST',
        body: {
          name: data.name,
          userId: "7804247f-3ae8-4eb2-8c6d-2c44f967ad42"
        }
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/finance/vendors'] });
      onValueChange(data.id);
      setCreateDialogOpen(false);
      setNewEntityName("");
    }
  });

  const createCompanyMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      return apiRequest(`/api/cortex/entities/companies`, {
        method: 'POST',
        body: {
          name: data.name,
          userId: "7804247f-3ae8-4eb2-8c6d-2c44f967ad42"
        }
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/finance/vendors'] });
      onValueChange(data.id);
      setCreateDialogOpen(false);
      setNewEntityName("");
    }
  });

  const handleSelect = (vendor: Vendor) => {
    console.log('Vendor selected:', vendor.id, vendor.name);
    onValueChange(vendor.id);
    setSearchValue(vendor.name);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    setOpen(true);
  };

  const handleInputFocus = () => {
    setOpen(true);
  };

  const handleClear = () => {
    setSearchValue("");
    onValueChange("");
    setOpen(false);
  };

  const handleCreateEntity = () => {
    if (!newEntityName.trim()) return;
    
    if (newEntityType === 'contact') {
      createContactMutation.mutate({ name: newEntityName.trim() });
    } else {
      createCompanyMutation.mutate({ name: newEntityName.trim() });
    }
  };

  // Reset search value when value changes externally
  useEffect(() => {
    if (selectedVendor) {
      setSearchValue(selectedVendor.name);
    } else if (!searchValue) {
      setSearchValue("");
    }
  }, [selectedVendor]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={searchValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className={cn("pr-24", className)}
        />
        <div className="absolute right-0 top-0 h-full flex items-center">
          {selectedVendor && (
            <Button
              variant="ghost"
              size="sm"
              className="h-full px-2 hover:bg-transparent"
              onClick={handleClear}
              type="button"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-full px-2 hover:bg-transparent"
                type="button"
              >
                <Plus className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Vendor</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="entity-type">Type</Label>
                  <RadioGroup
                    value={newEntityType}
                    onValueChange={(value: 'contact' | 'company') => setNewEntityType(value)}
                    className="flex gap-6 mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="contact" id="contact" />
                      <Label htmlFor="contact" className="flex items-center gap-2">
                        <User className="h-4 w-4 text-blue-500" />
                        Person
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="company" id="company" />
                      <Label htmlFor="company" className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-green-500" />
                        Company
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                <div>
                  <Label htmlFor="entity-name">Name</Label>
                  <Input
                    id="entity-name"
                    value={newEntityName}
                    onChange={(e) => setNewEntityName(e.target.value)}
                    placeholder={`Enter ${newEntityType} name...`}
                    className="mt-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateEntity();
                      }
                    }}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCreateDialogOpen(false)}
                    type="button"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateEntity}
                    disabled={!newEntityName.trim() || createContactMutation.isPending || createCompanyMutation.isPending}
                    type="button"
                  >
                    {(createContactMutation.isPending || createCompanyMutation.isPending) ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            variant="ghost"
            size="sm"
            className="h-full px-2 hover:bg-transparent"
            onClick={() => setOpen(!open)}
            type="button"
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border border-border rounded-md shadow-lg">
          <div className="max-h-[200px] overflow-y-auto p-1">
            {filteredVendors.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground">
                No vendors found.
              </div>
            ) : (
              filteredVendors.map((vendor) => (
                <button
                  key={vendor.id}
                  type="button"
                  className="w-full flex items-center gap-2 p-2 hover:bg-accent hover:text-accent-foreground rounded-sm cursor-pointer text-left"
                  onClick={() => handleSelect(vendor)}
                >
                  {vendor.type === 'contact' ? (
                    <User className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  ) : (
                    <Building2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  )}
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-medium truncate">{vendor.name}</span>
                    {vendor.description && (
                      <span className="text-sm text-muted-foreground truncate">{vendor.description}</span>
                    )}
                  </div>
                  {value === vendor.id && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}