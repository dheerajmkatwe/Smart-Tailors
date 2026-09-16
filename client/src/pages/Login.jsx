import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Scissors, Lock, User, LogIn, Eye, EyeOff, ChevronRight, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

export default function Login({ setAuth }) {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const [authMode, setAuthMode] = useState('Password');

    const [workersList, setWorkersList] = useState([]);
    const [selectedWorker, setSelectedWorker] = useState('');
    const [loadingWorkers, setLoadingWorkers] = useState(false);

    useEffect(() => {
        if (authMode !== 'Worker' || !username.trim()) {
            setWorkersList([]);
            setSelectedWorker('');
            return;
        }
        const delayDebounceFn = setTimeout(async () => {
            setLoadingWorkers(true);
            try {
                const res = await api.get(`/auth/public/workers/${encodeURIComponent(username.trim())}`);
                setWorkersList(res.data);
                setSelectedWorker(res.data.length > 0 ? res.data[0].name : '');
            } catch {
                setWorkersList([]);
                setSelectedWorker('');
            } finally {
                setLoadingWorkers(false);
            }
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [username, authMode]);

    const handleLogin = async (e) => {
        if (e) e.preventDefault();
        if (!username.trim()) { toast.error('Shop username is required'); return; }
        if (authMode === 'Password' && !password) { toast.error('Password is required'); return; }
        if (authMode === 'Worker' && !selectedWorker) {
            toast.error('No workers registered. Admin must add workers in Boutique Settings first.');
            return;
        }
        setLoading(true);
        try {
            const res = await api.post('/auth/login', {
                username: username.trim(),
                password: authMode === 'Password' ? password : '',
                role: authMode === 'Worker' ? 'Worker' : 'Admin',
                worker_name: authMode === 'Worker' ? selectedWorker : undefined
            });
            const user = res.data;
            localStorage.setItem('tailor_auth', JSON.stringify(user));
            setAuth(user);
            toast.success(`Welcome back, ${user.name}! ✨`);
            navigate('/');
        } catch (err) {
            toast.error(err.response?.data?.error || err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };


    const handleSubmit = (e) => {
        e.preventDefault();
        handleLogin(e);
    };

    const modes = [
        { id: 'Password', label: '🔒 Password', sub: 'Admin access' },
        { id: 'Worker', label: '👷 Worker', sub: 'Passwordless' },
    ];

    return (
        <div style={{
            display: 'flex', minHeight: '100vh',
            background: 'linear-gradient(135deg, #1a0309 0%, #3a0c18 40%, #1a0309 100%)',
            fontFamily: '"Outfit", "Inter", sans-serif',
            position: 'relative', overflow: 'hidden'
        }}>
            {/* Animated background orbs */}
            <div style={{ position: 'absolute', top: '-100px', left: '-100px', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-80px', right: '-80px', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: '40%', right: '10%', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(106,30,46,0.4) 0%, transparent 70%)', pointerEvents: 'none' }} />

            {/* Left branding panel — hidden on mobile */}
            <div style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '60px 48px', position: 'relative'
            }} className="login-brand-panel">
                <style>{`
                    @keyframes floatScissors { 0%,100%{transform:translateY(0) rotate(-8deg);} 50%{transform:translateY(-12px) rotate(-8deg);} }
                    @keyframes shimmer { 0%{opacity:0.6;} 50%{opacity:1;} 100%{opacity:0.6;} }
                    @keyframes slideInLeft { from{opacity:0;transform:translateX(-30px);} to{opacity:1;transform:translateX(0);} }
                    @keyframes slideInRight { from{opacity:0;transform:translateX(30px);} to{opacity:1;transform:translateX(0);} }
                    @keyframes fadeUp { from{opacity:0;transform:translateY(16px);} to{opacity:1;transform:translateY(0);} }
                    @keyframes spin { to{transform:rotate(360deg);} }
                    @media(max-width:768px) { .login-brand-panel { display: none !important; } .login-right { border-radius: 0 !important; min-height: 100vh !important; } }
                    .auth-mode-btn { transition: all 0.2s ease; border: none; cursor: pointer; border-radius: 10px; padding: 10px 8px; flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; }
                    .auth-mode-btn.active { background: linear-gradient(135deg, #6A1E2E, #4A101C); color: #fff; box-shadow: 0 4px 12px rgba(74,16,28,0.3); }
                    .auth-mode-btn.inactive { background: transparent; color: rgba(255,255,255,0.5); }
                    .auth-mode-btn.inactive:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.8); }
                    .login-input { background: rgba(255,255,255,0.06) !important; border: 1.5px solid rgba(255,255,255,0.12) !important; border-radius: 12px !important; padding: 14px 16px !important; color: #fff !important; font-size: 15px !important; width: 100%; outline: none; transition: border-color 0.2s; font-family: inherit; }
                    .login-input::placeholder { color: rgba(255,255,255,0.3); }
                    .login-input:focus { border-color: rgba(212,175,55,0.6) !important; background: rgba(255,255,255,0.09) !important; }
                    .login-input-wrap { position: relative; }
                    .login-input-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,0.35); pointer-events: none; }
                    .login-input.with-icon { padding-left: 44px !important; }
                    .login-btn-primary { width: 100%; padding: 15px; border-radius: 12px; border: none; cursor: pointer; font-size: 15px; font-weight: 700; letter-spacing: 0.3px; transition: all 0.25s; display: flex; align-items: center; justify-content: center; gap: 8px; background: linear-gradient(135deg, #d4af37 0%, #b8921f 100%); color: #2a0709; box-shadow: 0 6px 20px rgba(212,175,55,0.3); }
                    .login-btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(212,175,55,0.4); }
                    .login-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
                    .feature-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; background: rgba(212,175,55,0.1); border: 1px solid rgba(212,175,55,0.2); border-radius: 20px; font-size: 12px; color: rgba(255,255,255,0.7); margin: 4px; }
                `}</style>

                <div style={{ animation: 'slideInLeft 0.6s ease both', textAlign: 'center', maxWidth: 460 }}>
                    <div style={{ margin: '0 auto 24px', display: 'flex', justifyContent: 'center', animation: 'floatScissors 3s ease-in-out infinite' }}>
                        <img src="/logo.png" alt="Smart Tailor Logo" style={{ width: 120, height: 120, objectFit: 'contain', filter: 'drop-shadow(0 8px 32px rgba(212,175,55,0.3))' }} />
                    </div>
                    <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: '42px', color: '#fff', margin: '0 0 8px', fontWeight: 400, lineHeight: 1.2 }}>
                        Smart Tailor
                    </h1>
                    <p style={{ color: '#d4af37', fontSize: '15px', margin: '0 0 32px', letterSpacing: '0.5px', animation: 'shimmer 2.5s ease-in-out infinite' }}>
                        ✨ Professional Boutique Management
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', lineHeight: 1.7, margin: '0 0 32px' }}>
                        The all-in-one platform trusted by boutiques to manage orders, measurements, billing, and analytics — all in one elegant workspace.
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {['📦 Order Management', '📐 Measurements', '📊 Analytics', '🧾 Smart Bills', '👷 Worker Portal', '☁️ Cloud Sync'].map(f => (
                            <span key={f} className="feature-pill">{f}</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right form panel */}
            <div className="login-right" style={{
                width: '100%', maxWidth: 480, minHeight: '100vh',
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(24px)',
                borderLeft: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '48px 40px',
                animation: 'slideInRight 0.6s ease both'
            }}>
                <div style={{ width: '100%', maxWidth: 380 }}>
                    {/* Header */}
                    <div style={{ marginBottom: 32, textAlign: 'center' }}>
                        <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: 26, color: '#fff', margin: '0 0 6px', fontWeight: 400 }}>
                            Welcome Back
                        </h2>
                        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: 0 }}>
                            Sign in to your boutique dashboard
                        </p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {/* Shop Username */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
                                Shop Username or Phone
                            </label>
                            <div className="login-input-wrap">
                                <User size={16} className="login-input-icon" />
                                <input
                                    className="login-input with-icon"
                                    type="text"
                                    placeholder="Enter shop username or phone"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    autoComplete="username"
                                    required
                                />
                            </div>
                        </div>

                        {/* Auth mode tabs */}
                        <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: 'rgba(255,255,255,0.05)', padding: 5, borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)' }}>
                            {modes.map(m => (
                                <button
                                    key={m.id}
                                    type="button"
                                    className={`auth-mode-btn ${authMode === m.id ? 'active' : 'inactive'}`}
                                    onClick={() => { setAuthMode(m.id); setOtpSent(false); }}
                                >
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</span>
                                    <span style={{ fontSize: 10, opacity: 0.7 }}>{m.sub}</span>
                                </button>
                            ))}
                        </div>

                        {/* Password mode */}
                        {authMode === 'Password' && (
                            <div style={{ marginBottom: 24, animation: 'fadeUp 0.25s ease both' }}>
                                <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
                                    Password
                                </label>
                                <div className="login-input-wrap">
                                    <Lock size={16} className="login-input-icon" />
                                    <input
                                        className="login-input with-icon"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        autoComplete="current-password"
                                        style={{ paddingRight: 44 }}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 0, display: 'flex', alignItems: 'center' }}
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                        )}



                        {/* Worker mode */}
                        {authMode === 'Worker' && (
                            <div style={{ marginBottom: 24, animation: 'fadeUp 0.25s ease both' }}>
                                <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
                                    Select Worker
                                </label>
                                {loadingWorkers ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: 12, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                                        <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.15)', borderTop: '2px solid #d4af37', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                                        Fetching workers...
                                    </div>
                                ) : workersList.length > 0 ? (
                                    <div className="login-input-wrap">
                                        <User size={16} className="login-input-icon" />
                                        <select
                                            value={selectedWorker}
                                            onChange={e => setSelectedWorker(e.target.value)}
                                            className="login-input with-icon"
                                            style={{ appearance: 'none', cursor: 'pointer' }}
                                            required
                                        >
                                            {workersList.map(w => <option key={w.id} value={w.name} style={{ background: '#2a0709' }}>{w.name}</option>)}
                                        </select>
                                    </div>
                                ) : (
                                    <div style={{ padding: '14px 16px', background: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.25)', borderRadius: 12, color: '#ffc107', fontSize: 13, textAlign: 'center', lineHeight: 1.5 }}>
                                        ⚠️ No workers registered for this shop yet.<br/>
                                        <span style={{ fontSize: 11, opacity: 0.7 }}>Ask the shop admin to add workers in Boutique Settings.</span>
                                    </div>
                                )}
                                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 8, margin: '8px 0 0' }}>
                                    {username.trim() && workersList.length === 0 && !loadingWorkers
                                        ? 'No workers have been added to this shop yet.'
                                        : 'Select your name to enter the dashboard without a password.'}
                                </p>
                            </div>
                        )}

                        {/* Submit button */}
                        {authMode === 'Worker' ? (
                            <button type="submit" className="login-btn-primary" disabled={loading || !selectedWorker}>
                                <LogIn size={17} />
                                {loading ? 'Logging in...' : 'Enter Worker Dashboard'}
                                {!loading && <ChevronRight size={16} />}
                            </button>
                        ) : (
                            <button type="submit" className="login-btn-primary" disabled={loading}>
                                <LogIn size={17} />
                                {loading ? 'Signing in...' : 'Sign in to Dashboard'}
                                {!loading && <ChevronRight size={16} />}
                            </button>
                        )}

                        {/* Register link */}
                        <div style={{ textAlign: 'center', marginTop: 28 }}>
                            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>New boutique? </span>
                            <Link to="/register" style={{ color: '#d4af37', textDecoration: 'none', fontWeight: 700, fontSize: 13, transition: 'opacity 0.2s' }}>
                                Register your shop →
                            </Link>
                        </div>

                        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 24, margin: '24px 0 0' }}>
                            Smart Tailor v1.2 · Boutique Management Platform
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
}
