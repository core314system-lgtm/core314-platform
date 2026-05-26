import { useState } from 'react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { useAddons } from '../hooks/useAddons';
import { useToast } from '../hooks/use-toast';

interface ExportDataButtonProps {
  data: Record<string, unknown>[];
  filename: string;
  headers?: string[];
}

/**
 * Export Data button component - only visible when data_export add-on is active.
 * Provides CSV and JSON export options for the provided data.
 */
export function ExportDataButton({ data, filename, headers }: ExportDataButtonProps) {
  const { hasAddon, loading } = useAddons();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  // Only render if user has data_export entitlement
  if (loading || !hasAddon('data_export')) {
    return null;
  }

  const generateFilename = (extension: string) => {
    const date = new Date().toISOString().split('T')[0];
    return `core314-export-${filename}-${date}.${extension}`;
  };

  const downloadFile = (content: string, mimeType: string, extension: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generateFilename(extension);
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleExportCSV = () => {
    if (data.length === 0) {
      toast({
        title: 'No data to export',
        description: 'There is no data available for export.',
        variant: 'destructive',
      });
      return;
    }

    setExporting(true);
    try {
      // Use provided headers or extract from first data item
      const csvHeaders = headers || Object.keys(data[0]);
      
      const csvRows = [
        csvHeaders.join(','),
        ...data.map(row => 
          csvHeaders.map(header => {
            const value = row[header];
            // Handle values that might contain commas or quotes
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value ?? '';
          }).join(',')
        ),
      ];

      const csvContent = csvRows.join('\n');
      downloadFile(csvContent, 'text/csv', 'csv');

      toast({
        title: 'Export complete',
        description: `Downloaded ${generateFilename('csv')}`,
      });
    } catch (error) {
      console.error('CSV export error:', error);
      toast({
        title: 'Export failed',
        description: 'Failed to export data as CSV.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportJSON = () => {
    if (data.length === 0) {
      toast({
        title: 'No data to export',
        description: 'There is no data available for export.',
        variant: 'destructive',
      });
      return;
    }

    setExporting(true);
    try {
      const jsonContent = JSON.stringify(data, null, 2);
      downloadFile(jsonContent, 'application/json', 'json');

      toast({
        title: 'Export complete',
        description: `Downloaded ${generateFilename('json')}`,
      });
    } catch (error) {
      console.error('JSON export error:', error);
      toast({
        title: 'Export failed',
        description: 'Failed to export data as JSON.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={exporting}>
          <Download className="h-4 w-4 mr-2" />
          Export Data
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportCSV}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportJSON}>
          <FileJson className="h-4 w-4 mr-2" />
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
