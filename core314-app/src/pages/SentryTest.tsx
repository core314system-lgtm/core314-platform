import { useState } from 'react';
import * as Sentry from '@sentry/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function SentryTest() {
  const [testResults, setTestResults] = useState<string[]>([]);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testException = () => {
    try {
      addResult('Triggering test exception...');
      throw new Error('Sentry test exception from core314-app');
    } catch (error) {
      Sentry.captureException(error);
      addResult('✅ Exception captured and sent to Sentry');
    }
  };

  const testMessage = () => {
    addResult('Sending test message...');
    Sentry.captureMessage('Sentry test message from core314-app', 'info');
    addResult('✅ Message sent to Sentry');
  };

  const testBreadcrumb = () => {
    addResult('Adding test breadcrumb...');
    Sentry.addBreadcrumb({
      category: 'test',
      message: 'Test breadcrumb from core314-app',
      level: 'info',
    });
    addResult('✅ Breadcrumb added');
  };

  const testErrorBoundary = () => {
    addResult('Triggering ErrorBoundary...');
    throw new Error('Sentry ErrorBoundary test from core314-app');
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Sentry Integration Test</CardTitle>
          <CardDescription>
            Test Sentry error tracking and monitoring for core314-app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Button onClick={testException} variant="outline">
              Test Exception
            </Button>
            <Button onClick={testMessage} variant="outline">
              Test Message
            </Button>
            <Button onClick={testBreadcrumb} variant="outline">
              Test Breadcrumb
            </Button>
            <Button onClick={testErrorBoundary} variant="destructive">
              Test ErrorBoundary
            </Button>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">Test Results</h3>
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md max-h-64 overflow-y-auto">
              {testResults.length === 0 ? (
                <p className="text-gray-500">No tests run yet. Click a button above to test.</p>
              ) : (
                <ul className="space-y-1 font-mono text-sm">
                  {testResults.map((result, index) => (
                    <li key={index}>{result}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md">
            <h4 className="font-semibold mb-2">Instructions</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Click the test buttons above to trigger Sentry events</li>
              <li>Go to your Sentry dashboard for core314-app project</li>
              <li>Verify that events appear in the Issues tab</li>
              <li>Check that breadcrumbs and context are captured correctly</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
