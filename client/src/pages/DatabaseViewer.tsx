import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Database, MessageSquare, Users, Phone, Calendar, Table as TableIcon, Folder, ChevronRight } from 'lucide-react';

interface DatabaseSchema {
  schema_name: string;
  table_count: number;
}

interface DatabaseTable {
  table_name: string;
  column_count: number;
}

interface TableColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

interface TableData {
  columns: TableColumn[];
  data: any[];
  total: number;
}

export default function DatabaseViewer() {
  const [schemas, setSchemas] = useState<DatabaseSchema[]>([]);
  const [tables, setTables] = useState<DatabaseTable[]>([]);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (endpoint: string) => {
    try {
      const response = await fetch(`/api/database/${endpoint}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${endpoint}`);
      }
      return await response.json();
    } catch (err) {
      throw new Error(`Error fetching ${endpoint}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const loadSchemas = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const schemasData = await fetchData('schemas');
      setSchemas(schemasData);
      
      // Auto-select whatsapp schema if available
      const whatsappSchema = schemasData.find((s: DatabaseSchema) => s.schema_name === 'whatsapp');
      if (whatsappSchema) {
        setSelectedSchema('whatsapp');
        await loadTables('whatsapp');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schemas');
    } finally {
      setLoading(false);
    }
  };

  const loadTables = async (schema: string) => {
    if (!schema) return;
    
    setLoading(true);
    try {
      const tablesData = await fetchData(`tables/${schema}`);
      setTables(tablesData);
      setSelectedTable('');
      setTableData(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tables');
    } finally {
      setLoading(false);
    }
  };

  const loadTableData = async (schema: string, table: string) => {
    if (!schema || !table) return;
    
    setLoading(true);
    try {
      const data = await fetchData(`table-data/${schema}/${table}?limit=100`);
      setTableData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load table data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchemas();
  }, []);

  useEffect(() => {
    if (selectedSchema) {
      loadTables(selectedSchema);
    }
  }, [selectedSchema]);

  useEffect(() => {
    if (selectedSchema && selectedTable) {
      loadTableData(selectedSchema, selectedTable);
    }
  }, [selectedSchema, selectedTable]);

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'boolean') return value.toString();
    if (value instanceof Date) return value.toLocaleString();
    return String(value);
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Database className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Database Schemas & Tables</h1>
        </div>
        <Button onClick={loadSchemas} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh Data'}
        </Button>
      </div>

      {error && (
        <Alert className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Schemas Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Schemas ({schemas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {schemas.map((schema) => (
                <div
                  key={schema.schema_name}
                  className={`p-3 rounded-lg cursor-pointer border transition-colors ${
                    selectedSchema === schema.schema_name
                      ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                      : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
                  }`}
                  onClick={() => setSelectedSchema(schema.schema_name)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{schema.schema_name}</span>
                    <Badge variant="outline">{schema.table_count} tables</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tables Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TableIcon className="h-5 w-5" />
              Tables ({tables.length})
              {selectedSchema && (
                <Badge variant="outline">{selectedSchema}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedSchema ? (
              <div className="space-y-2">
                {tables.map((table) => (
                  <div
                    key={table.table_name}
                    className={`p-3 rounded-lg cursor-pointer border transition-colors ${
                      selectedTable === table.table_name
                        ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                        : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
                    }`}
                    onClick={() => setSelectedTable(table.table_name)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{table.table_name}</span>
                      <Badge variant="outline">{table.column_count} cols</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Select a schema to view tables</p>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Database Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Total Schemas</span>
                <Badge>{schemas.length}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Total Tables</span>
                <Badge>{schemas.reduce((sum, s) => sum + s.table_count, 0)}</Badge>
              </div>
              {selectedSchema && selectedTable && tableData && (
                <div className="flex items-center justify-between">
                  <span>Table Rows</span>
                  <Badge>{tableData.total}</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table Data Display */}
      {selectedSchema && selectedTable && tableData && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TableIcon className="h-5 w-5" />
              {selectedSchema}.{selectedTable} Data
              <Badge variant="outline">{tableData.total} rows</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {tableData.columns.map((column) => (
                      <TableHead key={column.column_name} className="whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold">{column.column_name}</span>
                          <span className="text-xs text-gray-500">
                            {column.data_type}
                            {column.is_nullable === 'NO' && ' (NOT NULL)'}
                          </span>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.data.map((row, index) => (
                    <TableRow key={index}>
                      {tableData.columns.map((column) => (
                        <TableCell key={column.column_name} className="max-w-xs">
                          <div className="truncate" title={formatValue(row[column.column_name])}>
                            {truncateText(formatValue(row[column.column_name]), 50)}
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}