import { getSupabaseClientSync } from './supabaseClient';

async function getAuthToken(): Promise<string | null> {
  const client = getSupabaseClientSync();
  if (!client) return null;
  const { data: { session } } = await client.auth.getSession();
  return session?.access_token ?? null;
}

function authHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function fetchOntologyData<T = unknown>(type: string): Promise<T> {
  const token = await getAuthToken();
  const res = await fetch(`/.netlify/functions/admin-ontology-data?type=${type}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Failed to fetch ${type}`);
  }
  return res.json();
}

export async function createOntologyRecord<T = unknown>(type: string, body: Record<string, unknown>): Promise<T> {
  const token = await getAuthToken();
  const res = await fetch(`/.netlify/functions/admin-ontology-data?type=${type}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Failed to create ${type}`);
  }
  return res.json();
}

export async function updateOntologyRecord<T = unknown>(type: string, body: Record<string, unknown>): Promise<T> {
  const token = await getAuthToken();
  const res = await fetch(`/.netlify/functions/admin-ontology-data?type=${type}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Failed to update ${type}`);
  }
  return res.json();
}

export async function deleteOntologyRecord(type: string, id: string): Promise<void> {
  const token = await getAuthToken();
  const res = await fetch(`/.netlify/functions/admin-ontology-data?type=${type}&id=${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Failed to delete ${type}`);
  }
}
