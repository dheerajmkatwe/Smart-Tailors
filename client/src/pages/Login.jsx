import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Scissors, Lock, User, LogIn, Eye, EyeOff, ChevronRight, Sparkles, QrCode, Copy, CheckCircle, AlertTriangle, RefreshCw, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import QRCode from 'react-qr-code';
import api from '../api/axios';

export default function Login({ setAuth }) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [username, setUsername] = useState(searchParams.get('tenant_id') || '');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const [authMode, setAuthMode] = useState('Password');

    const [workersList, setWorkersList] = useState([]);
    const [selectedWorker, setSelectedWorker] = useState('');
    const [loadingWorkers, setLoadingWorkers] = useState(false);

    // Trial Expiry & Renewal State
    const [expiredData, setExpiredData] = useState(null);
    const [renewing, setRenewing] = useState(false);
    const [copiedUpi, setCopiedUpi] = useState(false);
    const [renewSuccessMsg, setRenewSuccessMsg] = useState('');

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
        setRenewSuccessMsg('');
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
            if (err.response?.data?.trial_expired) {
                setExpiredData(err.response.data);
                toast.error('Your 1-month free trial has expired! Please pay ₹1 to continue.');
            } else {
                toast.error(err.response?.data?.error || err.message || 'Login failed');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRenewSubscription = async () => {
        if (!expiredData?.tenant_id) return;
        setRenewing(true);
        try {
            const res = await api.post('/auth/renew-subscription', {
                tenant_id: expiredData.tenant_id,
                plan: expiredData.next_plan
            });
            if (res.data.success) {
                toast.success('🎉 Subscription renewed successfully!');
                setRenewSuccessMsg(res.data.message || 'Your account has been reactivated! You can now log in.');
                setUsername(expiredData.tenant_id);
                setExpiredData(null);
            }
        } catch (err) {
            toast.error(err.response?.data?.error || err.message || 'Failed to activate subscription. Please try again.');
        } finally {
            setRenewing(false);
        }
    };

    const handleRazorpayPay = async () => {
        if (!expiredData?.tenant_id) return;
        setRenewing(true);
        try {
            const orderRes = await api.post('/auth/razorpay-create-subscription-order', {
                tenant_id: expiredData.tenant_id,
                amount: expiredData.amount,
                plan: expiredData.next_plan
            });

            const { order_id, amount, currency, key } = orderRes.data;

            const options = {
                key: key,
                amount: amount,
                currency: currency,
                name: 'Smart Tailors',
                description: expiredData.next_plan === 'Yearly' ? 'Annual Subscription (365 Days)' : '1-Month Trial Extension (30 Days)',
                image: '/logo.png',
                order_id: order_id,
                handler: async (response) => {
                    try {
                        const verifyRes = await api.post('/auth/razorpay-verify-subscription-payment', {
                            tenant_id: expiredData.tenant_id,
                            plan: expiredData.next_plan,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_signature: response.razorpay_signature
                        });
                        if (verifyRes.data.success) {
                            toast.success('🎉 Payment Verified via Razorpay!');
                            setRenewSuccessMsg(verifyRes.data.message || 'Your account is reactivated! You can now log in.');
                            setUsername(expiredData.tenant_id);
                            setExpiredData(null);
                        }
                    } catch (err) {
                        toast.error(err.response?.data?.error || 'Payment verification failed');
                    }
                },
                prefill: {
                    name: expiredData.admin_name || '',
                    contact: expiredData.phone_number || ''
                },
                theme: {
                    color: '#6A1E2E'
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response) {
                toast.error(response.error.description || 'Payment Failed');
            });
            rzp.open();
        } catch (err) {
            toast.error(err.response?.data?.error || err.message || 'Failed to initialize Razorpay checkout');
        } finally {
            setRenewing(false);
        }
    };

    const copyUpiId = () => {
        const upi = expiredData?.upi_id || '9113565802@ibl';
        navigator.clipboard.writeText(upi);
        setCopiedUpi(true);
        toast.success('UPI ID copied to clipboard!');
        setTimeout(() => setCopiedUpi(false), 2500);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        handleLogin(e);
    };

    const modes = [
        { id: 'Password', label: '🔒 Password', sub: 'Admin access' },
        { id: 'Worker', label: '👷 Worker', sub: 'Passwordless' },
    ];

    const upiPayUrl = `upi://pay?pa=9113565802@ibl&pn=Smart%20Tailors&am=${expiredData?.amount || 1}&cu=INR&tn=Renewal-${encodeURIComponent(expiredData?.tenant_id || 'Shop')}`;

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
                    @media(max-width:768px) { .login-brand-panel { display: none !important; } .login-right { border-radius: 0 !important; min-height: 100vh !important; } .login-mobile-logo { display: flex !important; } }
                    .login-mobile-logo { display: none; justify-content: center; margin-bottom: 20px; }
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

                    {/* IF TRIAL EXPIRED — SHOW TRIAL EXPIRED RENEWAL PAGE */}
                    {expiredData ? (
                        <div style={{ animation: 'fadeUp 0.4s ease both' }}>
                            {/* Alert Header */}
                            <div style={{
                                background: 'rgba(239,83,80,0.12)', border: '1.5px solid rgba(239,83,80,0.3)',
                                borderRadius: 16, padding: '20px 18px', textAlign: 'center', marginBottom: 20
                            }}>
                                <div style={{
                                    width: 54, height: 54, borderRadius: '50%', background: 'rgba(239,83,80,0.2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
                                    border: '2px solid #ef5350'
                                }}>
                                    <AlertTriangle size={28} style={{ color: '#ef5350' }} />
                                </div>
                                <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: 22, color: '#fff', margin: '0 0 6px', fontWeight: 600 }}>
                                    {expiredData.title || 'Subscription Expired 🔒'}
                                </h2>
                                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                                    {expiredData.error || `Your trial period for ${expiredData.shop_name} has ended.`}
                                </p>
                            </div>

                            {/* Details Box */}
                            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '16px', marginBottom: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                                    <span>Boutique Admin:</span>
                                    <strong style={{ color: '#fff' }}>{expiredData.admin_name}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                                    <span>Shop ID / Username:</span>
                                    <strong style={{ color: '#d4af37', fontFamily: 'monospace' }}>{expiredData.tenant_id}</strong>
                                </div>
                                <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '10px 0' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
                                    <span style={{ color: '#fff', fontWeight: 600 }}>
                                        {expiredData.next_plan === 'Yearly' ? 'Annual Renewal Fee:' : 'Extension Fee:'}
                                    </span>
                                    <span style={{ background: 'linear-gradient(135deg, #d4af37, #f5e17c)', color: '#2a0709', padding: '4px 12px', borderRadius: 20, fontWeight: 800, fontSize: 15 }}>
                                        ₹{expiredData.amount} / {expiredData.next_plan === 'Yearly' ? '365 Days' : '30 Days'}
                                    </span>
                                </div>
                            </div>

                            {/* UPI QR Code Section */}
                            <div style={{
                                background: 'rgba(212,175,55,0.08)', border: '1.5px solid rgba(212,175,55,0.25)',
                                borderRadius: 16, padding: '20px 16px', textAlign: 'center', marginBottom: 20
                            }}>
                                <div style={{ fontSize: 13, color: '#d4af37', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                    <QrCode size={16} /> Scan QR Code to Pay ₹{expiredData.amount}
                                </div>
                                <div style={{ display: 'inline-block', background: '#fff', padding: 12, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', marginBottom: 12 }}>
                                    <QRCode value={upiPayUrl} size={150} />
                                </div>
                                <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)', margin: '0 0 12px' }}>
                                    Scan with GPay, PhonePe, Paytm, BHIM, or any UPI App
                                </p>

                                {/* Direct Mobile UPI Link Button */}
                                <a
                                    href={upiPayUrl}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        width: '100%', padding: '12px', background: 'linear-gradient(135deg, #2e7d32, #4caf50)',
                                        color: '#fff', textDecoration: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14,
                                        boxShadow: '0 4px 14px rgba(76,175,80,0.3)', marginBottom: 10, boxSizing: 'border-box'
                                    }}
                                >
                                    <CreditCard size={17} /> Direct Pay ₹{expiredData.amount} via UPI App
                                </a>

                                {/* Razorpay Payment Button */}
                                <button
                                    type="button"
                                    onClick={handleRazorpayPay}
                                    disabled={renewing}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        width: '100%', padding: '12px', background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                        color: '#fff', border: 'none', cursor: 'pointer', borderRadius: 10, fontWeight: 700, fontSize: 14,
                                        boxShadow: '0 4px 14px rgba(2,132,199,0.3)', marginBottom: 12, boxSizing: 'border-box'
                                    }}
                                >
                                    <Sparkles size={16} /> Pay ₹{expiredData.amount} via Razorpay (Card / Netbanking / UPI)
                                </button>

                                {/* UPI ID display with Copy Button */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)'
                                }}>
                                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>UPI ID:</span>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>9113565802@ibl</span>
                                    <button
                                        type="button"
                                        onClick={copyUpiId}
                                        style={{ background: 'none', border: 'none', color: '#d4af37', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
                                        title="Copy UPI ID"
                                    >
                                        {copiedUpi ? <CheckCircle size={15} style={{ color: '#4caf50' }} /> : <Copy size={15} />}
                                    </button>
                                </div>
                            </div>

                            {/* Activation Action Button */}
                            <button
                                type="button"
                                className="login-btn-primary"
                                onClick={handleRenewSubscription}
                                disabled={renewing}
                                style={{ marginBottom: 12 }}
                            >
                                {renewing ? (
                                    <>
                                        <span style={{ width: 16, height: 16, border: '2px solid rgba(42,7,9,0.3)', borderTop: '2px solid #2a0709', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                        Activating Subscription...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle size={18} /> I Have Paid ₹{expiredData.amount} — Activate Now
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => setExpiredData(null)}
                                style={{
                                    width: '100%', padding: '10px', background: 'transparent',
                                    border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)',
                                    borderRadius: 10, fontSize: 13, cursor: 'pointer'
                                }}
                            >
                                ← Back to Login
                            </button>
                        </div>
                    ) : (
                        /* NORMAL LOGIN FORM */
                        <>
                            {/* Header */}
                            <div style={{ marginBottom: 32, textAlign: 'center' }}>
                                <div className="login-mobile-logo">
                                    <img src="/logo.png" alt="Smart Tailor Logo" style={{ width: 80, height: 80, objectFit: 'contain', filter: 'drop-shadow(0 6px 20px rgba(212,175,55,0.35))' }} />
                                </div>
                                <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: 26, color: '#fff', margin: '0 0 6px', fontWeight: 400 }}>
                                    Welcome Back
                                </h2>
                                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: 0 }}>
                                    Sign in to your boutique dashboard
                                </p>
                            </div>

                            {/* Renewal Success Notification */}
                            {renewSuccessMsg && (
                                <div style={{
                                    background: 'rgba(76,175,80,0.12)', border: '1px solid rgba(76,175,80,0.3)',
                                    borderRadius: 12, padding: '14px', marginBottom: 20, textAlign: 'left',
                                    animation: 'fadeUp 0.3s ease both'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                        <CheckCircle size={18} style={{ color: '#4caf50', flexShrink: 0, marginTop: 2 }} />
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: '#4caf50', marginBottom: 2 }}>Subscription Active! 🎉</div>
                                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>{renewSuccessMsg}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

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
                                            onClick={() => setAuthMode(m.id)}
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
                        </>
                    )}

                </div>
            </div>
        </div>
    );
}
