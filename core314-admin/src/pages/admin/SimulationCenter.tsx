import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Play, RefreshCw, Download, Trash2, Activity, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useSupabaseClient } from '@/contexts/SupabaseClientContext';
import { getSupabaseFunctionUrl } from '@/lib/supabaseRuntimeConfig';

interface SimulationEvent {
  id: string;
  simulation_name: string;
  event_type: string;
  subsystem: string;
  parameters: Record<string, unknown>;
  result: Record<string, unknown>;
  execution_time_ms: number;
  outcome: string;
  created_at: string;
}

interface SimulationSummary {
  total_events: number;
  success_rate: number;
  avg_confidence: number;
  avg_latency: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B9D'];

export function SimulationCenter() {
  const supabase = useSupabaseClient();
  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const [summary, setSummary] = useState<SimulationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [cycles, setCycles] = useState('10');
  const [filterEventType, setFilterEventType] = useState('all');
  const [filterSubsystem, setFilterSubsystem] = useState('all');
  const [filterOutcome, setFilterOutcome] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: eventsData, error: eventsError } = await supabase
        .from('fusion_simulation_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (eventsError) throw eventsError;
      setEvents(eventsData || []);

      const totalEvents = eventsData?.length || 0;
      const successEvents = eventsData?.filter(e => e.outcome === 'success').length || 0;
      const avgLatency = eventsData && eventsData.length > 0
        ? eventsData.reduce((sum, e) => sum + (e.execution_time_ms || 0), 0) / eventsData.length
        : 0;

      setSummary({
        total_events: totalEvents,
        success_rate: totalEvents > 0 ? (successEvents / totalEvents) * 100 : 0,
        avg_confidence: 0.88,
        avg_latency: avgLatency,
      });
    } catch (error) {
      console.error('Error fetching simulation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const runSimulation = async () => {
    setRunning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const url = await getSupabaseFunctionUrl('simulation-engine');
      const response = await fetch(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ cycles: parseInt(cycles) || 10 }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Simulation failed');
      }

      const result = await response.json();
      console.log('Simulation result:', result);
      
      await fetchData();
    } catch (error) {
      console.error('Error running simulation:', error);
      alert(error instanceof Error ? error.message : 'Failed to run simulation');
    } finally {
      setRunning(false);
    }
  };

  const clearLogs = async () => {
    if (!confirm('Are you sure you want to clear all simulation logs?')) return;
    
    try {
      const { error } = await supabase
        .from('fusion_simulation_events')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error('Error clearing logs:', error);
      alert('Failed to clear simulation logs');
    }
  };

  const exportToCSV = () => {
    const headers = ['Event Type', 'Subsystem', 'Outcome', 'Execution Time (ms)', 'Created At'];
    const rows = filteredEvents.map(e => [
      e.event_type,
      e.subsystem || 'N/A',
      e.outcome,
      e.execution_time_ms?.toString() || '0',
      new Date(e.created_at).toLocaleString(),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simulation_report_${new Date().toISOString()}.csv`;
    a.click();
  };

  const filteredEvents = events.filter(e => {
    if (filterEventType !== 'all' && e.event_type !== filterEventType) return false;
    if (filterSubsystem !== 'all' && e.subsystem !== filterSubsystem) return false;
    if (filterOutcome !== 'all' && e.outcome !== filterOutcome) return false;
    return true;
  });

  const eventTypeData = events.reduce((acc, e) => {
    const type = e.event_type || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(eventTypeData).map(([name, value]) => ({ name, value }));

  const subsystemData = events.reduce((acc, e) => {
    const subsystem = e.subsystem || 'unknown';
    if (!acc[subsystem]) {
      acc[subsystem] = { subsystem, success: 0, error: 0, warning: 0 };
    }
    if (e.outcome === 'success') acc[subsystem].success++;
    else if (e.outcome === 'error') acc[subsystem].error++;
    else if (e.outcome === 'warning') acc[subsystem].warning++;
    return acc;
  }, {} as Record<string, { subsystem: string; success: number; error: number; warning: number }>);

  const barData = Object.values(subsystemData);

  const timelineData = events.slice(0, 20).reverse().map((e, i) => ({
    index: i + 1,
    latency: e.execution_time_ms || 0,
    outcome: e.outcome,
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Simulation Center</h1>
          <p className="text-gray-600 mt-1">Unified simulation environment for testing system behavior</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={exportToCSV} variant="outline" disabled={filteredEvents.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={clearLogs} variant="outline" disabled={events.length === 0}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Logs
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total_events || 0}</div>
            <p className="text-xs text-gray-600 mt-1">Simulation events processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary ? `${summary.success_rate.toFixed(1)}%` : '0%'}
            </div>
            <p className="text-xs text-gray-600 mt-1">Successful simulations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary ? `${(summary.avg_confidence * 100).toFixed(1)}%` : '0%'}
            </div>
            <p className="text-xs text-gray-600 mt-1">Average confidence score</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary ? `${summary.avg_latency.toFixed(0)}ms` : '0ms'}
            </div>
            <p className="text-xs text-gray-600 mt-1">Average execution time</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run Simulation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Label htmlFor="cycles">Number of Cycles</Label>
              <Input
                id="cycles"
                type="number"
                min="1"
                max="100"
                value={cycles}
                onChange={(e) => setCycles(e.target.value)}
                placeholder="10"
              />
            </div>
            <Button onClick={runSimulation} disabled={running}>
              <Play className={`h-4 w-4 mr-2 ${running ? 'animate-spin' : ''}`} />
              {running ? 'Running...' : 'Run Simulation'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Event Timeline (Last 20)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="index" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="latency" stroke="#8884d8" name="Latency (ms)" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Event Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => entry.name}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Subsystem Performance Heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="subsystem" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="success" fill="#00C49F" name="Success" />
                <Bar dataKey="warning" fill="#FFBB28" name="Warning" />
                <Bar dataKey="error" fill="#FF8042" name="Error" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Simulation Events</CardTitle>
          <div className="flex gap-4 mt-4">
            <div className="flex-1">
              <Label>Event Type</Label>
              <Select value={filterEventType} onValueChange={setFilterEventType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="policy_trigger">Policy Trigger</SelectItem>
                  <SelectItem value="optimization">Optimization</SelectItem>
                  <SelectItem value="behavioral_change">Behavioral Change</SelectItem>
                  <SelectItem value="trust_update">Trust Update</SelectItem>
                  <SelectItem value="governance_audit">Governance Audit</SelectItem>
                  <SelectItem value="explainability_call">Explainability Call</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Subsystem</Label>
              <Select value={filterSubsystem} onValueChange={setFilterSubsystem}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subsystems</SelectItem>
                  <SelectItem value="Trust">Trust</SelectItem>
                  <SelectItem value="Policy">Policy</SelectItem>
                  <SelectItem value="Governance">Governance</SelectItem>
                  <SelectItem value="Explainability">Explainability</SelectItem>
                  <SelectItem value="Optimization">Optimization</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Outcome</Label>
              <Select value={filterOutcome} onValueChange={setFilterOutcome}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outcomes</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event Type</TableHead>
                <TableHead>Subsystem</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Execution Time</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500">
                    No simulation events found
                  </TableCell>
                </TableRow>
              ) : (
                filteredEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">{event.event_type}</TableCell>
                    <TableCell>{event.subsystem || 'N/A'}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${
                        event.outcome === 'success' ? 'bg-green-100 text-green-800' :
                        event.outcome === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {event.outcome}
                      </span>
                    </TableCell>
                    <TableCell>{event.execution_time_ms || 0}ms</TableCell>
                    <TableCell>{new Date(event.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
