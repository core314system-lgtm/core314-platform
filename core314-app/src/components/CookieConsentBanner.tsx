import { useState, useEffect } from 'react';
import { X, Cookie } from 'lucide-react';

const CONSENT_KEY = 'core314-cookie-consent';

type ConsentLevel = 'all' | 'essential' | null;

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      // Show banner after a short delay so it doesn't flash on page load
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = (level: ConsentLevel) => {
    if (!level) return;
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ level, accepted_at: new Date().toISOString() }));
    setVisible(false);

    // If user accepted all cookies, initialize analytics
    if (level === 'all') {
      // Google Analytics / any other tracking can be initialized here
      console.log('[CookieConsent] All cookies accepted — analytics enabled');
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 mt-1">
            <Cookie className="h-6 w-6 text-sky-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Cookie Preferences
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              We use cookies to enhance your experience, analyze site traffic, and serve personalized content.
              Essential cookies are required for the site to function. You can choose to accept all cookies
              or only essential ones.{' '}
              <a
                href="https://core314.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-500 hover:text-sky-600 underline"
              >
                Privacy Policy
              </a>
            </p>

            {showDetails && (
              <div className="mb-4 space-y-3 text-sm">
                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900 dark:text-white">Essential Cookies</span>
                    <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded-full">Always Active</span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400">
                    Required for authentication, security, and basic site functionality. These cannot be disabled.
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900 dark:text-white">Analytics Cookies</span>
                    <span className="text-xs bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">Optional</span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400">
                    Help us understand how visitors interact with the site so we can improve the experience.
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900 dark:text-white">Marketing Cookies</span>
                    <span className="text-xs bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">Optional</span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400">
                    Used to deliver relevant advertising and track campaign performance.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => handleAccept('all')}
                className="px-5 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Accept All
              </button>
              <button
                onClick={() => handleAccept('essential')}
                className="px-5 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors"
              >
                Essential Only
              </button>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors underline"
              >
                {showDetails ? 'Hide Details' : 'Cookie Details'}
              </button>
            </div>
          </div>
          <button
            onClick={() => handleAccept('essential')}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close cookie banner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
