import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Sparkles, Send } from 'lucide-react';
import { quickQuery } from '../../services/aiGateway';

export function AIQuickQuery() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Array<{ query: string; response: string }>>([]);

  const handleSubmit = async () => {
    if (!query.trim()) return;

    setLoading(true);
    const currentQuery = query;
    setQuery('');

    try {
      const result = await quickQuery(currentQuery);
      setResponse(result);
      setHistory([{ query: currentQuery, response: result }, ...history.slice(0, 2)]);
    } catch (error) {
      console.error('Quick query error:', error);
      setResponse('Failed to get response. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleSubmit();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask Core314 anything..."
          disabled={loading}
          className="flex-1"
        />
        <Button
          onClick={handleSubmit}
          disabled={loading || !query.trim()}
          size="icon"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {response && (
        <Card className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-800">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                Core314 AI Response
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {response}
              </p>
            </div>
          </div>
        </Card>
      )}

      {history.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Recent Queries</p>
          {history.map((item, idx) => (
            <div key={idx} className="text-xs space-y-1 p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <p className="font-medium text-gray-700 dark:text-gray-300">Q: {item.query}</p>
              <p className="text-gray-600 dark:text-gray-400">A: {item.response.substring(0, 100)}...</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
