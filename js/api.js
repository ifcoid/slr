// js/api.js

// Default Base URL
let baseURL = localStorage.getItem('apiBaseURL') || 'http://localhost:50607/api';

export function getBaseURL() {
    return baseURL;
}

export function setBaseURL(url) {
    baseURL = url;
    localStorage.setItem('apiBaseURL', url);
}

// Universal fetch wrapper
async function apiFetch(endpoint, options = {}) {
    try {
        const isFormData = options.body instanceof FormData;
        const headers = isFormData
            ? { ...(options.headers || {}) }
            : { 'Content-Type': 'application/json', ...(options.headers || {}) };

        // Remove Content-Type if explicitly set to null/undefined (e.g. for multipart)
        if (headers['Content-Type'] === null || headers['Content-Type'] === undefined) {
            delete headers['Content-Type'];
        }

        const token = localStorage.getItem('auth_token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${baseURL}${endpoint}`, {
            ...options,
            headers,
            body: options.body
        });

        if (response.status === 401) {
            // Unauthorized, redirect to login
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            window.location.reload();
            throw new Error('Sesi berakhir atau tidak valid. Silakan login kembali.');
        }

        // Handle non-JSON responses (e.g. CSV export)
        if (options.responseType === 'text') {
            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new Error(text || `HTTP Error ${response.status}`);
            }
            return await response.text();
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || `HTTP Error ${response.status}`);
        }
        
        return data;
    } catch (error) {
        console.error(`API Error on ${endpoint}:`, error);
        throw error;
    }
}

export const API = {
    // Auth API
    login: (username, password) => apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    }),
    register: (username, password, inviteCode) => apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password, invite_code: inviteCode })
    }),

    // Session API
    createSession: (id, topic) => apiFetch('/sessions', {
        method: 'POST',
        body: JSON.stringify({ id, topic })
    }),
    
    getSession: (id) => apiFetch(`/sessions/${id}`),

    updateSession: (id, payload = {}) => apiFetch(`/sessions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
    }),

    resumeSession: (id) => apiFetch(`/sessions/${id}/resume`, {
        method: 'POST'
    }),
    
    approveStep: (id, payload = {}) => apiFetch(`/sessions/${id}/approve`, {
        method: 'PUT',
        body: JSON.stringify(payload)
    }),
    
    reviseStep: (id, feedback, targetStatus = undefined) => apiFetch(`/sessions/${id}/revise`, {
        method: 'PUT',
        body: JSON.stringify({ feedback, target_status: targetStatus })
    }),

    importData: (id, formData) => apiFetch(`/sessions/${id}/import-data`, {
        method: 'POST',
        body: formData
    }),

    getDisagreements: (id, stage) => apiFetch(`/sessions/${id}/disagreements${stage ? `?stage=${stage}` : ''}`),

    resolveConflicts: (id, payload) => apiFetch(`/sessions/${id}/resolve-conflicts`, {
        method: 'POST',
        body: JSON.stringify(payload)
    }),

    resolvePICOAudit: (id, payload) => apiFetch(`/sessions/${id}/pico-audit/resolve`, {
        method: 'POST',
        body: JSON.stringify(payload)
    }),

    rerunPICOAudit: (id) => apiFetch(`/sessions/${id}/pico-audit/rerun`, {
        method: 'POST'
    }),

    saveAuditScope: (id, rules) => apiFetch(`/sessions/${id}/pico-audit/scope`, {
        method: 'POST',
        body: JSON.stringify({ rules })
    }),

    reimportData: (id) => apiFetch(`/sessions/${id}/reimport`, {
        method: 'PUT'
    }),

    saveFrameworkColumns: (id, columns) => apiFetch(`/sessions/${id}/framework/columns`, {
        method: 'PUT',
        body: JSON.stringify({ columns })
    }),

    savePriorReviews: (id, reviews) => apiFetch(`/sessions/${id}/prior-reviews`, {
        method: 'PUT',
        body: JSON.stringify({ reviews })
    }),

    getScreeningReview: (id) => apiFetch(`/sessions/${id}/screening-review`),

    correctScreening: (id, corrections) => apiFetch(`/sessions/${id}/screening-correction`, {
        method: 'POST',
        body: JSON.stringify({ corrections })
    }),

    getExtractions: (id) => apiFetch(`/sessions/${id}/extractions`),

    getAmbiguousExtractions: (id) => apiFetch(`/sessions/${id}/extractions/ambiguous`),
    
    resolveExtractionManual: (id, extId, fieldKey, resolvedValue) => apiFetch(`/sessions/${id}/extractions/${extId}/resolve`, {
        method: 'PUT',
        body: JSON.stringify({ field_key: fieldKey, resolved_value: resolvedValue })
    }),

    resolveExtractionAuto: (id, extId, fieldKey) => apiFetch(`/sessions/${id}/extractions/${extId}/auto-resolve`, {
        method: 'POST',
        body: JSON.stringify({ field_key: fieldKey })
    }),
    
    // LLM Config API
    updateLLMConfig: (provider, apiKey, defaultModel, baseUrl = "") => apiFetch('/llm/config', {
        method: 'PUT',
        body: JSON.stringify({ provider, api_key: apiKey, default_model: defaultModel, base_url: baseUrl })
    }),
    
    fetchModels: (provider, apiKey, baseUrl) => apiFetch(`/llm/providers/${provider}/models`, {
        method: 'POST',
        body: JSON.stringify({ api_key: apiKey, base_url: baseUrl })
    }),

    getLLMConfigs: () => apiFetch('/llm/config'),

    testModel: (provider, opts = {}) => apiFetch('/llm/test', {
        method: 'POST',
        body: JSON.stringify({
            provider: provider || '', role: opts.role || '',
            api_key: opts.api_key || '', base_url: opts.base_url || '', model: opts.model || ''
        })
    }),

    getRoles: () => apiFetch('/llm/roles'),

    updateRoles: (roles) => apiFetch('/llm/roles', {
        method: 'PUT',
        body: JSON.stringify(roles)
    }),

    submitVOSviewer: (id, data) => apiFetch(`/sessions/${id}/m8b/vosviewer`, {
        method: 'POST',
        body: JSON.stringify({ data })
    }),

    getGitHubConfig: () => apiFetch('/github/config'),

    updateGitHubConfig: (cfg) => apiFetch('/github/config', {
        method: 'PUT',
        body: JSON.stringify(cfg)
    }),

    getEmbedConfig: () => apiFetch('/embed/config'),

    updateEmbedConfig: (cfg) => apiFetch('/embed/config', {
        method: 'PUT',
        body: JSON.stringify(cfg)
    }),

    getScopusConfig: () => apiFetch('/scopus/config'),

    updateScopusConfig: (cfg) => apiFetch('/scopus/config', {
        method: 'PUT',
        body: JSON.stringify(cfg)
    }),

    checkLLMHealth: () => apiFetch('/llm/health'),

    // Pre-flight: uji SEMUA role pipeline (primary+fallback) dengan generate NYATA. Lebih
    // ketat dari checkLLMHealth (yang hanya cek konektivitas /models). Bisa makan ~1-2 menit.
    preflightRoles: () => apiFetch('/llm/preflight'),

    // Reproducible Error (xAI): jejak panggilan LLM gagal terakhir + replay prompt ("Uji Coba").
    getLLMDebug: (id) => apiFetch(`/sessions/${id}/llm-debug`),
    // Snapshot state DB tersanitasi (disisipkan ke laporan bug → tak perlu akses Mongo user).
    getSessionDiagnostic: (id) => apiFetch(`/sessions/${id}/diagnostic`),
    // replayLLM ASYNC: balas {job_id}; poll getReplayResult sampai {done:true}. Aman utk
    // prompt panjang (generasi lama tak kena timeout proxy).
    replayLLM: (payload) => apiFetch('/llm/replay', { method: 'POST', body: JSON.stringify(payload) }),
    getReplayResult: (jobId) => apiFetch(`/llm/replay/${jobId}`),

    resetModul7: (id) => apiFetch(`/sessions/${id}/reset-m7`, { method: 'POST' }),

    // M6 API
    syncQdrant: (id) => apiFetch(`/sessions/${id}/m6/sync-qdrant`, {
        method: 'POST'
    }),
    getSyncQdrantResult: (id) => apiFetch(`/sessions/${id}/m6/sync-qdrant/result`),

    deleteQdrantPaper: (id, payload) => apiFetch(`/sessions/${id}/m6/qdrant/paper`, {
        method: 'DELETE',
        body: JSON.stringify(payload)
    }),

    markInaccessible: (id, paperId, documentation) => apiFetch(`/sessions/${id}/m6/mark-inaccessible`, {
        method: 'POST',
        body: JSON.stringify({ paper_id: paperId, documentation })
    }),

    exportLinks: (id) => apiFetch(`/sessions/${id}/m6/export-links`, {
        responseType: 'text'
    }),

    getM6Papers: (id) => apiFetch(`/sessions/${id}/m6/papers`),

    getExcludedFulltext: (id) => apiFetch(`/sessions/${id}/m6/excluded-fulltext`),

    recodeExclusions: (id, recodes) => apiFetch(`/sessions/${id}/m6/recode-exclusions`, {
        method: 'POST',
        body: JSON.stringify({ recodes })
    }),

    suggestRecodes: (id) => apiFetch(`/sessions/${id}/m6/suggest-recodes`, {
        method: 'POST'
    }),

    getRecodeResult: (id) => apiFetch(`/sessions/${id}/m6/suggest-recodes/result`),

    // xAI Audit Log
    getXAILog: (id, step) => apiFetch(`/sessions/${id}/xai-log${step ? `?step=${step}` : ''}`)
};
