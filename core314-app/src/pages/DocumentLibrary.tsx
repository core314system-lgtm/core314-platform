import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  FileText,
  Search,
  Clock,
  ExternalLink,
  Filter,
  Database,
  Sheet,
  BookOpen,
  AlertCircle,
  HardDrive,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface DocumentRecord {
  id: string;
  title: string;
  description: string | null;
  content_preview: string | null;
  service_name: string;
  source_type: string;
  external_url: string | null;
  source_modified_at: string | null;
  extracted_at: string;
  mime_type: string | null;
  file_size_bytes: number;
  extraction_status: string;
  rank?: number;
}

interface StorageUsage {
  total_documents: number;
  total_bytes: number;
}

const SERVICE_LABELS: Record<string, string> = {
  google_sheets: 'Google Sheets',
  jira: 'Jira',
  notion: 'Notion',
};

const SERVICE_ICONS: Record<string, typeof FileText> = {
  google_sheets: Sheet,
  jira: AlertCircle,
  notion: BookOpen,
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  spreadsheet: 'Spreadsheet',
  issue: 'Issue',
  page: 'Page',
  database: 'Database',
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getServiceColor(service: string): string {
  switch (service) {
    case 'google_sheets': return 'bg-green-100 text-green-800 border-green-200';
    case 'jira': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'notion': return 'bg-gray-100 text-gray-800 border-gray-200';
    default: return 'bg-slate-100 text-slate-800 border-slate-200';
  }
}

export function DocumentLibrary() {
  const { profile } = useAuth();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const PAGE_SIZE = 20;

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch storage usage
  useEffect(() => {
    if (!profile?.id) return;
    const fetchUsage = async () => {
      const { data } = await supabase
        .from('content_storage_usage')
        .select('total_documents, total_bytes')
        .eq('user_id', profile.id)
        .single();
      if (data) setStorageUsage(data as StorageUsage);
    };
    fetchUsage();
  }, [profile?.id]);

  const fetchDocuments = useCallback(async (pageNum: number, query: string, service: string) => {
    if (!profile?.id) return;
    setLoading(true);

    try {
      if (query && query.trim().length > 0) {
        // Use full-text search RPC
        const { data, error } = await supabase.rpc('search_integration_documents', {
          p_user_id: profile.id,
          p_query: query.trim(),
          p_service_name: service === 'all' ? null : service,
          p_source_type: null,
          p_limit: PAGE_SIZE,
          p_offset: pageNum * PAGE_SIZE,
        });

        if (!error && data) {
          const docs = data as DocumentRecord[];
          if (pageNum === 0) {
            setDocuments(docs);
          } else {
            setDocuments(prev => [...prev, ...docs]);
          }
          setHasMore(docs.length === PAGE_SIZE);
          setPage(pageNum);
        }
      } else {
        // Regular query without search
        let query_builder = supabase
          .from('integration_documents')
          .select('id, title, description, content_preview, service_name, source_type, external_url, source_modified_at, extracted_at, mime_type, file_size_bytes, extraction_status')
          .eq('user_id', profile.id)
          .eq('extraction_status', 'complete')
          .order('source_modified_at', { ascending: false })
          .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

        if (service !== 'all') {
          query_builder = query_builder.eq('service_name', service);
        }

        const { data, error } = await query_builder;

        if (!error && data) {
          const docs = data as DocumentRecord[];
          if (pageNum === 0) {
            setDocuments(docs);
          } else {
            setDocuments(prev => [...prev, ...docs]);
          }
          setHasMore(docs.length === PAGE_SIZE);
          setPage(pageNum);
        }
      }
    } catch (err) {
      console.error('[DocumentLibrary] Fetch error:', err);
    }

    setLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    if (profile?.id) {
      fetchDocuments(0, debouncedQuery, serviceFilter);
    }
  }, [profile?.id, debouncedQuery, serviceFilter, fetchDocuments]);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Database className="h-6 w-6 text-sky-500" />
            Document Library
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Extracted content from your connected integrations
          </p>
        </div>

        {/* Storage Usage */}
        {storageUsage && (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <HardDrive className="h-4 w-4" />
            <span>{storageUsage.total_documents} documents</span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>{formatBytes(storageUsage.total_bytes)} used</span>
          </div>
        )}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          {['all', 'google_sheets', 'jira', 'notion'].map((filter) => (
            <Button
              key={filter}
              variant={serviceFilter === filter ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setServiceFilter(filter);
                setPage(0);
              }}
            >
              {filter === 'all' ? 'All' : SERVICE_LABELS[filter] || filter}
            </Button>
          ))}
        </div>
      </div>

      {/* Document List */}
      {loading && documents.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Database className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              {searchQuery
                ? 'No documents match your search.'
                : 'No documents extracted yet.'}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {!searchQuery && 'Connect Google Sheets, Jira, or Notion integrations to start extracting content.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const ServiceIcon = SERVICE_ICONS[doc.service_name] || FileText;
            const isExpanded = expandedDoc === doc.id;

            return (
              <Card
                key={doc.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      {/* Title row */}
                      <div className="flex items-center gap-2 mb-1">
                        <ServiceIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {doc.title}
                        </p>
                      </div>

                      {/* Description */}
                      {doc.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-2 pl-6">
                          {doc.description}
                        </p>
                      )}

                      {/* Metadata row */}
                      <div className="flex flex-wrap items-center gap-2 pl-6">
                        <Badge variant="outline" className={`text-xs ${getServiceColor(doc.service_name)}`}>
                          {SERVICE_LABELS[doc.service_name] || doc.service_name}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {SOURCE_TYPE_LABELS[doc.source_type] || doc.source_type}
                        </Badge>
                        <span className="text-xs text-gray-400">{formatBytes(doc.file_size_bytes)}</span>
                        {doc.source_modified_at && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(doc.source_modified_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        )}
                        {doc.rank !== undefined && doc.rank > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            Relevance: {Math.round(doc.rank * 100)}%
                          </Badge>
                        )}
                      </div>

                      {/* Expandable preview */}
                      {isExpanded && doc.content_preview && (
                        <div className="mt-3 ml-6 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-mono">
                          {doc.content_preview}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}
                        title={isExpanded ? 'Collapse' : 'Preview'}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      {doc.external_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          title="Open in source"
                        >
                          <a href={doc.external_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Load More */}
          {hasMore && !searchQuery && (
            <div className="text-center pt-4">
              <Button
                variant="outline"
                onClick={() => fetchDocuments(page + 1, debouncedQuery, serviceFilter)}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
