import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Calendar, DollarSign, FileText, Download, Upload } from "lucide-react";
import { BillForm } from "./BillForm";
import { ReceivableForm } from "./ReceivableForm";
import { format } from "date-fns";

interface Bill {
  id: string;
  bill_number?: string;
  invoice_number?: string;
  vendor_entity_id?: string;
  customer_entity_id?: string;
  amount: string;
  amount_paid?: string;
  amount_received?: string;
  bill_date?: string;
  invoice_date?: string;
  due_date: string;
  status: string;
  description: string;
  penalty_amount?: string;
  tags: string[];
}

export function BillsManager() {
  const [showCreatePayableDialog, setShowCreatePayableDialog] = useState(false);
  const [showCreateReceivableDialog, setShowCreateReceivableDialog] = useState(false);

  const { data: payables = [], isLoading: payablesLoading } = useQuery({
    queryKey: ["/api/finance/payables"],
  });

  const { data: receivables = [], isLoading: receivablesLoading } = useQuery({
    queryKey: ["/api/finance/receivables"],
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "unpaid":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "overdue":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      case "draft":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(parseFloat(amount));
  };

  const BillsTable = ({ bills, type, isLoading }: { bills: Bill[], type: 'payable' | 'receivable', isLoading: boolean }) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading {type}s...</div>
        </div>
      );
    }

    if (bills.length === 0) {
      return (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-semibold text-muted-foreground">
            No {type}s found
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Get started by creating your first {type}.
          </p>
          <div className="mt-6">
            <Button 
              onClick={() => type === 'payable' ? setShowCreatePayableDialog(true) : setShowCreateReceivableDialog(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create {type === 'payable' ? 'Bill' : 'Invoice'}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{type === 'payable' ? 'Bill Number' : 'Invoice Number'}</TableHead>
              <TableHead>{type === 'payable' ? 'Vendor' : 'Customer'}</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bills.map((bill: Bill) => (
              <TableRow key={bill.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell className="font-medium">
                  {bill.bill_number || bill.invoice_number}
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {(bill.vendor_entity_id || bill.customer_entity_id || '').replace("cv_", "").replace("cc_", "").replace("cp_", "")}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-1">
                    <DollarSign className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">
                      {formatCurrency(bill.amount)}
                    </span>
                  </div>
                  {((type === 'payable' && parseFloat(bill.amount_paid || '0') > 0) || 
                    (type === 'receivable' && parseFloat(bill.amount_received || '0') > 0)) && (
                    <div className="text-xs text-muted-foreground">
                      {type === 'payable' ? 'Paid' : 'Received'}: {formatCurrency(bill.amount_paid || bill.amount_received || '0')}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">
                      {format(new Date(bill.due_date), "MMM dd, yyyy")}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={getStatusColor(bill.status)}>
                    {bill.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="max-w-xs truncate text-sm text-muted-foreground">
                    {bill.description || "No description"}
                  </div>
                  {bill.tags && bill.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {bill.tags.slice(0, 2).map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {bill.tags.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{bill.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Bills Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage your bills payable and receivable
          </p>
        </div>
      </div>

      <Tabs defaultValue="payables" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="payables" className="flex items-center space-x-2">
            <Upload className="h-4 w-4" />
            <span>Bills Payable</span>
            {payables.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {payables.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="receivables" className="flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Bills Receivable</span>
            {receivables.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {receivables.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payables" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Bills Payable</h3>
              <p className="text-sm text-muted-foreground">Money you owe to vendors</p>
            </div>
            <Dialog open={showCreatePayableDialog} onOpenChange={setShowCreatePayableDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Bill
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Bill</DialogTitle>
                </DialogHeader>
                <BillForm
                  onSuccess={() => setShowCreatePayableDialog(false)}
                  onCancel={() => setShowCreatePayableDialog(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
          <BillsTable bills={payables} type="payable" isLoading={payablesLoading} />
        </TabsContent>

        <TabsContent value="receivables" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Bills Receivable</h3>
              <p className="text-sm text-muted-foreground">Money owed to you by customers</p>
            </div>
            <Dialog open={showCreateReceivableDialog} onOpenChange={setShowCreateReceivableDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Invoice
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Invoice</DialogTitle>
                </DialogHeader>
                <ReceivableForm
                  onSuccess={() => setShowCreateReceivableDialog(false)}
                  onCancel={() => setShowCreateReceivableDialog(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
          <BillsTable bills={receivables} type="receivable" isLoading={receivablesLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}