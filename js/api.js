// js/api.js

// Default Base URL
let baseURL = localStorage.getItem('apiBaseURL') || 'http://localhost:8080/api';

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
        const response = await fetch(`${baseURL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
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
    
    reviseStep: (id, feedback) => apiFetch(`/sessions/${id}/revise`, {
        method: 'PUT',
        body: JSON.stringify({ feedback })
    }),
    
    // LLM Config API
    updateLLMConfig: (provider, apiKey, defaultModel) => apiFetch('/llm/config', {
        method: 'PUT',
        body: JSON.stringify({ provider, api_key: apiKey, default_model: defaultModel })
    }),
    
    fetchModels: (provider, apiKey, baseUrl) => apiFetch(`/llm/providers/${provider}/models`, {
        method: 'POST',
        body: JSON.stringify({ api_key: apiKey, base_url: baseUrl })
    })
};
