/**
 * Read-only EnergiOS API client.
 *
 * Browser requests use the same-origin /api proxy. Vite and Vercel forward
 * that prefix to https://energios-backend.vercel.app so no credentials or
 * cross-origin browser access are required.
 */

class EnergiOSApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'EnergiOSApiError';
    this.status = status;
  }
}

class EnergiOSApiClient {
  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.status = { isLive: false, lastPingMs: null, lastChecked: null, error: null };
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  async request(path, { signal, timeoutMs = 45000, method = 'GET', body } = {}) {
    const started = performance.now();
    let status = 0;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const abort = () => controller.abort();
    if (signal) signal.addEventListener('abort', abort, { once: true });

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
      status = response.status;
      if (!response.ok) {
        let detail = `EnergiOS API returned HTTP ${response.status}`;
        try {
          const body = await response.json();
          if (typeof body.detail === 'string') detail = body.detail;
          else if (Array.isArray(body.detail)) detail = body.detail.map(item => item.msg).join('; ');
        } catch {
          // Keep the sanitized HTTP message for non-JSON errors.
        }
        throw new EnergiOSApiError(detail, response.status);
      }
      return await response.json();
    } catch (error) {
      if (error instanceof EnergiOSApiError) throw error;
      const message = error.name === 'AbortError'
        ? 'The EnergiOS API request timed out.'
        : 'The EnergiOS API is temporarily unavailable.';
      throw new EnergiOSApiError(message, 0);
    } finally {
      if (typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('energios:request', {detail: {path, status, ms: Math.round(performance.now()-started)}}));
      }
      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', abort);
    }
  }

  post(path, body, options = {}) { return this.request(path, { ...options, method: 'POST', body }); }

  async checkHealth() {
    const startedAt = performance.now();
    try {
      const data = await this.request('/health', { timeoutMs: 30000 });
      if (data.status !== 'ok' || data.version !== '1') {
        throw new EnergiOSApiError('Unexpected EnergiOS health response.', 0);
      }
      this.status.isLive = true;
      this.status.lastPingMs = Math.round(performance.now() - startedAt);
      this.status.lastChecked = new Date();
      this.status.error = null;
      return { ok: true, latencyMs: this.status.lastPingMs, data };
    } catch (error) {
      this.status.isLive = false;
      this.status.lastPingMs = null;
      this.status.lastChecked = new Date();
      this.status.error = error.message;
      return { ok: false, error: error.message, status: error.status || 0 };
    }
  }

  async getAssets(options = {}) {
    const data = await this.request('/assets?limit=100', options);
    this.status.isLive = true;
    return data;
  }

  async getReadings(assetId, options = {}) {
    const limit = options.limit || 168;
    let path = `/assets/${encodeURIComponent(assetId)}/readings?limit=${limit}`;
    if (options.from && options.to) {
      path += `&from=${encodeURIComponent(options.from)}&to=${encodeURIComponent(options.to)}`;
    }
    return this.request(path, options);
  }

  async getObservedHistory(assetId, { granularity, periods, ...options } = {}) {
    if (!['daily', 'monthly'].includes(granularity)) throw new EnergiOSApiError('History granularity must be daily or monthly.', 0);
    const maximum = granularity === 'daily' ? 31 : 12;
    const count = periods ?? maximum;
    if (!Number.isInteger(count) || count < 1 || count > maximum) throw new EnergiOSApiError(`History periods must be between 1 and ${maximum}.`, 0);
    const query = new URLSearchParams({ granularity, periods: String(count) });
    return this.request(`/demo/assets/${encodeURIComponent(assetId)}/history?${query}`, options);
  }

  async getForecast(assetId, options = {}) {
    return this.request(`/assets/${encodeURIComponent(assetId)}/forecast`, options);
  }

  async getAnomalies(assetId, options = {}) {
    const limit = options.limit || 100;
    let path = `/assets/${encodeURIComponent(assetId)}/anomalies?limit=${limit}`;
    if (options.from && options.to) {
      path += `&from=${encodeURIComponent(options.from)}&to=${encodeURIComponent(options.to)}`;
    }
    return this.request(path, options);
  }

  async getScenarioProfile(assetId, options = {}) {
    return this.request(`/demo/scenario-profile/${encodeURIComponent(assetId)}`, options);
  }
}

window.EnergiOSApiError = EnergiOSApiError;
window.EnergiOSApiClient = EnergiOSApiClient;
window.apiClient = new EnergiOSApiClient();
