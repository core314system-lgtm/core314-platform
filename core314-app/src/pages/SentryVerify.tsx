/**
 * Sentry Verification Test Page
 * Tests all Sentry features: messages, breadcrumbs, exceptions, transactions, replays
 * 
 * Guarded by VITE_DEV_SENTRY_VERIFY flag and ?ok=1 query parameter
 */

import { useState, useEffect } from 'react';
import * as Sentry from '@sentry/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

export default function SentryVerify() {
  const [results, setResults] = useState<string[]>([]);
  
  const addResult = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setResults(prev => [...prev, `${timestamp}: ${message}`]);
  };
  
  useEffect(() => {
    console.log('🧪 SentryVerify mounted - firing test events');
    
    Sentry.captureMessage('SentryVerify: Test message on mount');
    
    Sentry.captureException(new Error('SentryVerify: Test exception on mount'));
    
    console.log('🧪 Test events fired - check Network tab for "envelope" requests to sentry.io');
  }, []);
  
  const testMessage = () => {
    addResult('Sending test message...');
    Sentry.captureMessage('verify: message', 'info');
    addResult('✅ Message sent to Sentry');
  };
  
  const testBreadcrumb = () => {
    addResult('Adding test breadcrumb...');
    Sentry.addBreadcrumb({
      category: 'verify',
      message: 'breadcrumb',
      level: 'info',
      data: {
        test: true,
        timestamp: new Date().toISOString(),
      },
    });
    addResult('✅ Breadcrumb added');
  };
  
  const testException = () => {
    addResult('Triggering test exception...');
    try {
      throw new Error('verify: exception');
    } catch (error) {
      Sentry.captureException(error);
      addResult('✅ Exception captured and sent to Sentry');
    }
  };
  
  const testTransaction = async () => {
    addResult('Starting test transaction...');
    
    try {
      await Sentry.startSpan(
        {
          name: 'verify-transaction',
          op: 'test',
        },
        async (span) => {
          await new Promise(resolve => setTimeout(resolve, 300));
          
          await Sentry.startSpan(
            {
              name: 'verify-span',
              op: 'test.child',
            },
            async () => {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          );
        }
      );
      
      addResult('✅ Transaction completed and sent to Sentry');
    } catch (error) {
      addResult('❌ Transaction failed');
      throw error;
    }
  };
  
  const testReplay = () => {
    addResult('Triggering replay capture...');
    try {
      throw new Error('verify: replay trigger');
    } catch (error) {
      Sentry.captureException(error);
      addResult('✅ Replay should be captured (replaysOnErrorSampleRate=1.0)');
    }
  };
  
  const testAll = async () => {
    setResults([]);
    testMessage();
    await new Promise(resolve => setTimeout(resolve, 100));
    testBreadcrumb();
    await new Promise(resolve => setTimeout(resolve, 100));
    testException();
    await new Promise(resolve => setTimeout(resolve, 100));
    await testTransaction();
    await new Promise(resolve => setTimeout(resolve, 100));
    testReplay();
  };
  
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Sentry Verification Test</CardTitle>
          <CardDescription>
            Comprehensive test of all Sentry features for core314-app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Button onClick={testMessage} variant="outline">
              Test Message
            </Button>
            <Button onClick={testBreadcrumb} variant="outline">
              Test Breadcrumb
            </Button>
            <Button onClick={testException} variant="outline">
              Test Exception
            </Button>
            <Button onClick={testTransaction} variant="outline">
              Test Transaction
            </Button>
            <Button onClick={testReplay} variant="destructive">
              Test Replay
            </Button>
            <Button onClick={testAll} variant="default">
              Run All Tests
            </Button>
          </div>
          
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">Test Results</h3>
            <div className="bg-muted p-4 rounded-md min-h-[200px]">
              {results.length === 0 ? (
                <p className="text-muted-foreground">No tests run yet. Click a button above to test.</p>
              ) : (
                <ul className="space-y-1 font-mono text-sm">
                  {results.map((result, i) => (
                    <li key={i}>{result}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-md">
            <h4 className="font-semibold mb-2">Instructions</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Click the test buttons above to trigger Sentry events</li>
              <li>Go to your Sentry dashboard for core314-app project</li>
              <li>Verify that events appear in the Issues tab</li>
              <li>Check that breadcrumbs, transactions, and replays are captured correctly</li>
              <li>Verify release, environment, and buildId tags are present</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
