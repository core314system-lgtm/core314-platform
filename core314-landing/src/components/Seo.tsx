import { useEffect } from 'react';
import { SITE_URL, track } from '../lib/site';

interface SeoProps {
  title: string;
  description: string;
  path: string;
  jsonLd?: Record<string, unknown>;
  noindex?: boolean;
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export default function Seo({ title, description, path, jsonLd, noindex }: SeoProps) {
  useEffect(() => {
    const url = `${SITE_URL}${path}`;
    document.title = title;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', noindex ? 'noindex' : 'index, follow');
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', url);
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = url;
    const existing = document.getElementById('page-jsonld');
    if (existing) existing.remove();
    if (jsonLd) {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.id = 'page-jsonld';
      s.text = JSON.stringify(jsonLd);
      document.head.appendChild(s);
    }
    track('page_view', { page_path: path, page_title: title });
  }, [title, description, path, jsonLd, noindex]);
  return null;
}
