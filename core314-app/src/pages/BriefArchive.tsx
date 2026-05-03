import { useState, useEffect } from 'react';
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
  ChevronRight,
  ArrowLeft,
  Filter,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ArchivedBrief {
  id: string;
  title: string;
  health_score: number | null;
  confidence: number;
  created_at: string;
  detected_signals: string[];
}

const getHealthColor = (score: number | null) => {
  if (score === null) return 'text-slate-400';
  if (score >= 90) return 'text-green-400';
  if (score >= 70) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  if (score >= 30) return 'text-orange-400';
  if (score >= 10) return 'text-red-400';
  return 'text-red-500';
};

const getHealthLabel = (score: number | null) => {
  if (score === null) return 'Unknown';
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Moderate';
  if (score >= 30) return 'At Risk';
  if (score >= 10) return 'Critical';
  return 'System Failure';
};

export function BriefArchive() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [briefs, setBriefs] = useState<ArchivedBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [scoreFilter, setScoreFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  useEffect(() => {
    if (profile?.id) {
      fetchBriefs(0);
    }
  }, [profile?.id, scoreFilter]);

  const fetchBriefs = async (pageNum: number) => {
    if (!profile?.id) return;
    setLoading(true);

    let query = supabase
      .from('operational_briefs')
      .select('id, title, health_score, confidence, created_at, detected_signals')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

    if (scoreFilter === 'critical') {
      query = query.lt('health_score', 30);
    } else if (scoreFilter === 'at-risk') {
      query = query.gte('health_score', 30).lt('health_score', 50);
    } else if (scoreFilter === 'healthy') {
      query = query.gte('health_score', 70);
    }

    const { data, error } = await query;

    if (!error && data) {
      if (pageNum === 0) {
        setBriefs(data as ArchivedBrief[]);
      } else {
        setBriefs(prev => [...prev, ...(data as ArchivedBrief[])]);
      }
      setHasMore(data.length === PAGE_SIZE);
      setPage(pageNum);
    }
    setLoading(false);
  };

  const filteredBriefs = searchQuery
    ? briefs.filter(b =>
        b.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : briefs;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/brief')}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="h-6 w-6 text-sky-500" />
              Brief Archive
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Full history of your operational briefs
            </p>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search briefs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          {['all', 'critical', 'at-risk', 'healthy'].map((filter) => (
            <Button
              key={filter}
              variant={scoreFilter === filter ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setScoreFilter(filter);
                setPage(0);
              }}
              className={scoreFilter === filter ? 'bg-sky-600' : 'border-slate-700 text-slate-400'}
            >
              {filter === 'all' ? 'All' : filter === 'at-risk' ? 'At Risk' : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Brief List */}
      {loading && briefs.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full bg-slate-800 rounded-xl" />
          ))}
        </div>
      ) : filteredBriefs.length === 0 ? (
        <div className="bg-slate-900 rounded-2xl p-10 text-center">
          <FileText className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">
            {searchQuery ? 'No briefs match your search.' : 'No briefs found.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredBriefs.map((brief) => (
            <Card
              key={brief.id}
              className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
              onClick={() => navigate('/brief', { state: { briefId: brief.id } })}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">
                    {brief.title}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(brief.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                      {brief.confidence}% confidence
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  {brief.health_score !== null && (
                    <div className="text-right">
                      <span className={`text-lg font-bold ${getHealthColor(brief.health_score)}`}>
                        {brief.health_score}
                      </span>
                      <p className={`text-xs ${getHealthColor(brief.health_score)}`}>
                        {getHealthLabel(brief.health_score)}
                      </p>
                    </div>
                  )}
                  <ChevronRight className="h-4 w-4 text-slate-600" />
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Load More */}
          {hasMore && !searchQuery && (
            <div className="text-center pt-4">
              <Button
                variant="outline"
                onClick={() => fetchBriefs(page + 1)}
                disabled={loading}
                className="border-slate-700 text-slate-400"
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
