const API_BASE_KEY = 'api_base_url';

export function normalizeApiBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, '');
}

export function getCurrentHostApiBaseUrl(): string {
  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    const url = new URL(window.location.origin);
    if (url.port && url.port !== '8000') {
      url.port = '8000';
    }
    return normalizeApiBaseUrl(url.toString());
  }

  return 'http://127.0.0.1:8000';
}

export function getApiBaseUrl(): string {
  const saved = localStorage.getItem('api_base_url')?.trim();
  if (saved) {
    return normalizeApiBaseUrl(saved);
  }

  return getCurrentHostApiBaseUrl();
}

export function setApiBaseUrl(value: string): void {
  localStorage.setItem(API_BASE_KEY, normalizeApiBaseUrl(value));
}

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}
