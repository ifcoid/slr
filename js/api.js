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
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        const token = localStorage.getItem('auth_token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${baseURL}${endpoint}`, {
            ...options,
            headers
        });
        
        const data = await response.json().catch(() => ({}));
        
        if (response.status === 401) {
            // Unauthorized, redirect to login
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            window.location.reload();
            throw new Error('Sesi berakhir atau tidak valid. Silakan login kembali.');
        }

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
        headers: {
            'Content-Type': undefined // Biarkan browser yang atur boundary
        },
        body: formData
    }),

    getDisagreements: (id, stage) => apiFetch(`/sessions/${id}/disagreements${stage ? `?stage=${stage}` : ''}`),

    resolveConflicts: (id, payload) => apiFetch(`/sessions/${id}/resolve-conflicts`, {
        method: 'POST',
        body: JSON.stringify(payload)
    }),

    reimportData: (id) => apiFetch(`/sessions/${id}/reimport`, {
        method: 'PUT'
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

    getRoles: () => apiFetch('/llm/roles'),

    updateRoles: (roles) => apiFetch('/llm/roles', {
        method: 'PUT',
        body: JSON.stringify(roles)
    })
};
