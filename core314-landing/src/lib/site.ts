export const SITE_URL = 'https://core314.com';
export const BOOKING_URL: string | undefined = import.meta.env.VITE_BOOKING_URL || undefined;
export const GA4_ID: string | undefined = import.meta.env.VITE_GA4_ID || undefined;
export const CONSULT_PATH = '/contact';
export const CONSULT_LABEL = 'Schedule a 20-Minute Consultation';

type Gtag = (command: string, ...args: unknown[]) => void;
declare global {
  interface Window {
    gtag?: Gtag;
    dataLayer?: unknown[];
  }
}

export function track(event: string, params: Record<string, string> = {}) {
  if (typeof window !== 'undefined' && window.gtag) window.gtag('event', event, params);
}

export function isProductionSite(): boolean {
  return typeof window !== 'undefined' && ['core314.com', 'www.core314.com'].includes(window.location.hostname);
}

export function initAnalytics() {
  if (!GA4_ID || !isProductionSite() || typeof document === 'undefined' || window.gtag) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  } as Gtag;
  window.gtag('js', new Date());
  window.gtag('config', GA4_ID, { send_page_view: false });
}

const LEAD_KEY = 'core314_lead_source';
export function captureLeadSource() {
  if (typeof window === 'undefined') return;
  try {
    if (sessionStorage.getItem(LEAD_KEY)) return;
    const p = new URLSearchParams(window.location.search);
    const data = {
      utm_source: p.get('utm_source') || '',
      utm_medium: p.get('utm_medium') || '',
      utm_campaign: p.get('utm_campaign') || '',
      referrer: document.referrer || '',
      landing_page: window.location.pathname,
    };
    sessionStorage.setItem(LEAD_KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable */
  }
}
export function getLeadSource(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(LEAD_KEY) || '{}');
  } catch {
    return {};
  }
}
