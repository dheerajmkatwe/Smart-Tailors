import axios from 'axios';

let baseUrl = import.meta.env.VITE_API_URL;
if (!baseUrl) {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    baseUrl = `http://${hostname}:5000/api`;
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
        } catch (e) {}
    }
    const branchId = localStorage.getItem('tailor_branch_id');
    if (branchId) {
        config.headers['X-Branch-Id'] = branchId;
    }
    return config;
});

export default api;
