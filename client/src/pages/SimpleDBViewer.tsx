import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Database, Folder, TableIcon, RefreshCw } from 'lucide-react';

export default function SimpleDBViewer() {
  const [schemas, setSchemas] = useState<any[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableData, setTableData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const fetchSchemas = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/database/schemas');
      if (!response.ok) throw new Error('Failed to fetch schemas');
      const data = await response.json();
      setSchemas(data);
      console.log('Schemas loaded:', data);
    } catch (err) {
      setError('Failed to load schemas: ' + (err as Error).message);
      console.error('Schema error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTables = async (schema: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/database/tables/${schema}`);
      if (!response.ok) throw new Error('Failed to fetch tables');
      const data = await response.json();
      setTables(data);
      setSelectedTable('');
      setTableData(null);
      console.log('Tables loaded for', schema, ':', data);
    } catch (err) {
      setError('Failed to load tables: ' + (err as Error).message);
      console.error('Tables error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTableData = async (schema: string, table: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/database/table-data/${schema}/${table}?limit=20`);
      if (!response.ok) throw new Error('Failed to fetch table data');
      const data = await response.json();
      setTableData(data);
      console.log('Table data loaded:', data);
    } catch (err) {
      setError('Failed to load table data: ' + (err as Error).message);
      console.error('Table data error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchemas();
  }, []);

  const handleSchemaClick = (schemaName: string) => {
    setSelectedSchema(schemaName);
    fetchTables(schemaName);
  };

  const handleTableClick = (tableName: string) => {
    setSelectedTable(tableName);
    if (selectedSchema) {
      fetchTableData(selectedSchema, tableName);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Database Viewer</h1>
        </div>
        <Button onClick={fetchSchemas} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Schemas */}
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
                  className={`p-3 rounded border cursor-pointer transition-colors ${
                    selectedSchema === schema.schema_name
                      ? 'bg-blue-50 border-blue-200'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleSchemaClick(schema.schema_name)}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{schema.schema_name}</span>
                    <Badge variant="outline">{schema.table_count}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tables */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TableIcon className="h-5 w-5" />
              Tables ({tables.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedSchema ? (
              <div className="space-y-2">
                {tables.map((table) => (
                  <div
                    key={table.table_name}
                    className={`p-3 rounded border cursor-pointer transition-colors ${
                      selectedTable === table.table_name
                        ? 'bg-green-50 border-green-200'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => handleTableClick(table.table_name)}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{table.table_name}</span>
                      <Badge variant="outline">{table.column_count}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Select a schema to view tables</p>
            )}
          </CardContent>
        </Card>

        {/* Info Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>Total Schemas:</span>
              <Badge>{schemas.length}</Badge>
            </div>
            <div className="flex justify-between">
              <span>Total Tables:</span>
              <Badge>{schemas.reduce((sum, s) => sum + parseInt(s.table_count), 0)}</Badge>
            </div>
            {selectedSchema && (
              <div className="flex justify-between">
                <span>Selected:</span>
                <Badge variant="outline">{selectedSchema}</Badge>
              </div>
            )}
            {selectedTable && (
              <div className="flex justify-between">
                <span>Table:</span>
                <Badge variant="outline">{selectedTable}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Table Data */}
      {tableData && (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedSchema}.{selectedTable} - {tableData.total} rows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {tableData.columns?.map((col: any) => (
                      <TableHead key={col.column_name} className="whitespace-nowrap">
                        <div>
                          <div className="font-semibold">{col.column_name}</div>
                          <div className="text-xs text-gray-500">{col.data_type}</div>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.data?.map((row: any, index: number) => (
                    <TableRow key={index}>
                      {tableData.columns?.map((col: any) => (
                        <TableCell key={col.column_name} className="max-w-xs">
                          <div className="truncate" title={String(row[col.column_name] || '')}>
                            {row[col.column_name] === null 
                              ? <span className="text-gray-400 italic">null</span>
                              : String(row[col.column_name] || '').substring(0, 100)
                            }
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