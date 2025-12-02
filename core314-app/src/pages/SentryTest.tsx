import * as Sentry from '@sentry/react';

export function SentryTest() {
  const handleTestError = () => {
    throw new Error('Test error from SentryTest page');
  };

  const handleConsoleError = () => {
    console.error('Console error test');
  };

  const handleCaptureMessage = () => {
    Sentry.captureMessage('Manual message test');
  };

  const handleCaptureException = () => {
    Sentry.captureException(new Error('Manual exception test'));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
          Sentry Diagnostics Test Page
        </h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4">
          <button
            onClick={handleTestError}
            className="w-full px-4 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
          >
            Trigger Test Error
          </button>
          
          <button
            onClick={handleConsoleError}
            className="w-full px-4 py-3 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors font-medium"
          >
            Trigger Console Error
          </button>
          
          <button
            onClick={handleCaptureMessage}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            Trigger Sentry.captureMessage
          </button>
          
          <button
            onClick={handleCaptureException}
            className="w-full px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors font-medium"
          >
            Trigger Sentry.captureException
          </button>
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Click each button to test different Sentry event types. Check your Sentry dashboard to verify events are being captured.
          </p>
        </div>
      </div>
    </div>
  );
}
