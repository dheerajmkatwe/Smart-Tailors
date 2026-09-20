import axios from 'axios';

let baseUrl = import.meta.env.VITE_API_URL;
if (!baseUrl) {
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1' || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
            // Local computer or local Wi-Fi IP testing
            baseUrl = `http://${hostname}:5000/api`;
        } else {
            // Production server / Vercel deployment
            baseUrl = '/api';
        }
    } else {
        baseUrl = 'http://localhost:5000/api';
    }
} else if (!baseUrl.endsWith('/api')) {
    baseUrl = baseUrl.endsWith('/') ? `${baseUrl}api` : `${baseUrl}/api`;
}

const api = axios.create({
    baseURL: baseUrl,
    headers: { 'Content-Type': 'application/json' },
});

// Add tenant_id and branch_id request interceptor
api.interceptors.request.use((config) => {
    const auth = localStorage.getItem('tailor_auth');
    if (auth) {
        try {
            const user = JSON.parse(auth);
            if (user && user.tenant_id) {
                config.headers['X-Tenant-Id'] = user.tenant_id;
            }
        } catch {
            // Ignore invalid JSON in localStorage
        }
    }
    const branchId = localStorage.getItem('tailor_branch_id');
    if (branchId) {
        config.headers['X-Branch-Id'] = branchId;
    }
    return config;
});

export default api;
