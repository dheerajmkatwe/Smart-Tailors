import React, { useState, useEffect } from 'react';
import { Lock, Mail, Users, ShoppingBag, Store, LogOut, Search, MapPin, Hash, UserCheck, Calendar, CreditCard, Gift, Copy, Send, CheckCircle, Info, X, Trash2, Ban, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

export default function SuperAdmin() {
    const [auth, setAuth] = useState(() => {
        const saved = localStorage.getItem('super_admin_auth');
        try { return saved ? JSON.parse(saved) : null; } catch { return null; }
    });

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // Dashboard states
    const [tenants, setTenants] = useState([]);
    const [fetching, setFetching] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal / Subscription states
    const [selectedTenant, setSelectedTenant] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [subType, setSubType] = useState('Free');
    const [saving, setSaving] = useState(false);
    const [generatedCard, setGeneratedCard] = useState(null);

    // Tab and Block states
    const [activeTab, setActiveTab] = useState('boutiques'); // 'boutiques' | 'blocked'
    const [blockedNumbers, setBlockedNumbers] = useState([]);
    const [blockingPhone, setBlockingPhone] = useState('');
    const [blockingReason, setBlockingReason] = useState('');
    const [loadingBlocked, setLoadingBlocked] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!username.trim() || !password) {
            toast.error('Both credentials are required.');
            return;
        }
        setLoading(true);
        try {
            const res = await api.post('/auth/super-admin/login', {
                username: username.trim(),
                password: password
            });
            const superAuth = res.data;
            localStorage.setItem('super_admin_auth', JSON.stringify(superAuth));
            setAuth(superAuth);
            toast.success(`Access Authorized. Welcome back, Kishan!`);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Invalid credentials. Access Denied.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('super_admin_auth');
        setAuth(null);
        toast.success('Logged out from Control Panel.');
        window.location.href = '/';
    };

    const fetchTenants = async () => {
        setFetching(true);
        try {
            const res = await api.get('/auth/super-admin/tenants');
            setTenants(res.data);
        } catch (err) {
            toast.error('Failed to load system tenant registry.');
        } finally {
            setFetching(false);
        }
    };

    const fetchBlockedNumbers = async () => {
        setLoadingBlocked(true);
        try {
            const res = await api.get('/auth/super-admin/blocked-numbers');
            setBlockedNumbers(res.data);
        } catch (err) {
            toast.error('Failed to load blocked numbers registry.');
        } finally {
            setLoadingBlocked(false);
        }
    };

    const handleBlockNumber = async (e) => {
        e.preventDefault();
        if (!blockingPhone.trim()) {
            toast.error('Phone number is required');
            return;
        }
        try {
            await api.post('/auth/super-admin/blocked-numbers', {
                phone_number: blockingPhone.trim(),
                reason: blockingReason.trim()
            });
            toast.success(`Phone number ${blockingPhone} is now blocked.`);
            setBlockingPhone('');
            setBlockingReason('');
            fetchBlockedNumbers();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to block number.');
        }
    };

    const handleUnblockNumber = async (phone) => {
        if (!confirm(`Are you sure you want to unblock ${phone}?`)) return;
        try {
            await api.delete(`/auth/super-admin/blocked-numbers/${phone}`);
            toast.success(`Phone number ${phone} has been unblocked.`);
            fetchBlockedNumbers();
        } catch (err) {
            toast.error('Failed to unblock number.');
        }
    };

    const handleDeleteTenant = async (tenantId, shopName) => {
        const doubleConfirm = confirm(`⚠️ WARNING: Deleting "${shopName}" (${tenantId}) will permanently remove all orders, customers, workers, measurements, expenses, and settings.\n\nThis action CANNOT BE UNDONE.\n\nAre you absolutely sure you want to completely delete this boutique shop account?`);
        if (!doubleConfirm) return;
        
        try {
            await api.delete(`/auth/super-admin/tenants/${tenantId}`);
            toast.success(`Account "${shopName}" deleted successfully.`);
            fetchTenants(); // Reload boutiques registry list
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to delete boutique shop account.');
        }
    };

    const handleBlockTenantPhone = async (phone, shopName) => {
        if (!phone) {
            toast.error('No phone number registered for this shop.');
            return;
        }
        const blockConfirm = confirm(`Do you want to block the phone number ${phone} belonging to "${shopName}"? This will prevent them from logging in or registering again.`);
        if (!blockConfirm) return;
        
        try {
            await api.post('/auth/super-admin/blocked-numbers', {
                phone_number: phone,
                reason: `Owner of ${shopName}`
            });
            toast.success(`Phone number ${phone} has been blocked.`);
            fetchBlockedNumbers();
        } catch (err) {
            toast.error('Failed to block number.');
        }
    };

    useEffect(() => {
        if (auth) {
            fetchTenants();
            fetchBlockedNumbers();
        }
    }, [auth]);

    // Calculate aggregated statistics
    const totalShops = tenants.length;
    const totalOrders = tenants.reduce((acc, t) => acc + (t.total_orders || 0), 0);
    const totalCustomers = tenants.reduce((acc, t) => acc + (t.total_customers || 0), 0);

    const filteredTenants = tenants.filter(t => {
        const query = searchTerm.toLowerCase();
        return (
            (t.shop_name || '').toLowerCase().includes(query) ||
            (t.tenant_id || '').toLowerCase().includes(query) ||
            (t.phone_number || '').toLowerCase().includes(query) ||
            (t.admin_name || '').toLowerCase().includes(query)
        );
    });

    const handleOpenSubscriptionModal = (tenant) => {
        setSelectedTenant(tenant);
        setSubType(tenant.subscription_type || 'Free');
        setGeneratedCard(null);
        setShowModal(true);
    };

    const handleSaveSubscription = async (e) => {
        e.preventDefault();
        if (!selectedTenant) return;
        setSaving(true);
        try {
            const res = await api.post(`/auth/super-admin/tenants/${selectedTenant.tenant_id}/subscription`, {
                subscription_type: subType
            });
            
            toast.success('Subscription plan updated!');
            
            if (subType === 'Monthly' || subType === 'Yearly') {
                setGeneratedCard({
                    subscription_type: res.data.subscription_type,
                    subscription_key: res.data.subscription_key,
                    subscription_pin: res.data.subscription_pin
                });
            } else {
                setShowModal(false);
                fetchTenants();
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update subscription');
        } finally {
            setSaving(false);
        }
    };

    const cleanPhone = (phone) => {
        if (!phone) return '';
        const nums = phone.replace(/\D/g, '');
        if (nums.length === 10) return '91' + nums; // Default to India country code
        return nums;
    };

    if (!auth) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minHeight: '100vh', background: '#0d0d11', padding: '20px', fontFamily: '"Inter", sans-serif'
            }}>
                <div style={{
                    maxWidth: 420, width: '100%', background: '#14141c', border: '1px solid #232330',
                    borderRadius: '16px', padding: '40px 32px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                    textAlign: 'center'
                }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(212, 175, 55, 0.1)',
                        border: '1px solid #d4af37', marginBottom: '24px', color: '#d4af37'
                    }}>
                        <Lock size={28} />
                    </div>

                    <h2 style={{ color: '#fff', fontSize: '24px', fontWeight: '700', margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
                        SYSTEM CONTROL PANEL
                    </h2>
                    <p style={{ color: '#8a8aa3', fontSize: '13px', margin: '0 0 32px 0', lineHeight: 1.5 }}>
                        Authorized Super Administrator Access Only. Please verify security keys to manage Smart Tailor platform.
                    </p>

                    <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', color: '#b5b5c9', fontSize: '12px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Master Username / Email
                            </label>
                            <div style={{
                                display: 'flex', alignItems: 'center', background: '#1c1c27', border: '1px solid #2c2c3e',
                                borderRadius: '10px', padding: '12px 16px', gap: '12px'
                            }}>
                                <Mail size={18} style={{ color: '#6c6c8c' }} />
                                <input
                                    type="text"
                                    placeholder="Enter Master Username or Email"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    required
                                    style={{
                                        border: 'none', background: 'transparent', color: '#fff', outline: 'none',
                                        fontSize: '14px', flex: 1
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '32px' }}>
                            <label style={{ display: 'block', color: '#b5b5c9', fontSize: '12px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Access Key
                            </label>
                            <div style={{
                                display: 'flex', alignItems: 'center', background: '#1c1c27', border: '1px solid #2c2c3e',
                                borderRadius: '10px', padding: '12px 16px', gap: '12px'
                            }}>
                                <Lock size={18} style={{ color: '#6c6c8c' }} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Enter access key"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    style={{
                                        border: 'none', background: 'transparent', color: '#fff', outline: 'none',
                                        fontSize: '14px', flex: 1
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{ background: 'none', border: 'none', color: '#6c6c8c', cursor: 'pointer', padding: 0, display: 'flex' }}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%', padding: '14px', borderRadius: '10px', background: '#d4af37',
                                border: 'none', color: '#0d0d11', fontSize: '14px', fontWeight: '700',
                                cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(212, 175, 55, 0.2)'
                            }}
                        >
                            {loading ? 'Authenticating Key...' : 'Authorize Secure Access'}
                        </button>
                        <div style={{ marginTop: '24px', textAlign: 'center' }}>
                            <a
                                href="/"
                                style={{
                                    color: '#8a8aa3', fontSize: '13px', textDecoration: 'none',
                                    fontWeight: '500', transition: 'color 0.2s', display: 'inline-flex',
                                    alignItems: 'center', gap: '6px'
                                }}
                                onMouseEnter={e => e.currentTarget.style.color = '#d4af37'}
                                onMouseLeave={e => e.currentTarget.style.color = '#8a8aa3'}
                            >
                                ← Go to Shop Portal
                            </a>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#08080c', color: '#f0f0f5', fontFamily: '"Inter", sans-serif', padding: '40px' }}>
            {/* Header section */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderBottom: '1px solid #1a1a26', paddingBottom: '24px', marginBottom: '40px'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }} />
                        <span style={{ fontSize: '11px', color: '#d4af37', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' }}>
                            Main Control Center
                        </span>
                    </div>
                    <h1 style={{ fontSize: '28px', fontWeight: '800', margin: 0, color: '#fff', letterSpacing: '-0.5px' }}>
                        Smart Tailor Platform Platform Administration
                    </h1>
                </div>

                <button
                    onClick={handleLogout}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px',
                        background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#ef4444', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
                        cursor: 'pointer', transition: 'all 0.2s'
                    }}
                >
                    <LogOut size={16} /> Exit Control Panel
                </button>
            </div>

            {/* Quick KPIs Grid */}
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '40px' }}>
                {/* Shops KPI */}
                <div style={{
                    flex: 1, minWidth: '240px', background: '#111118', border: '1px solid #1d1d2b',
                    borderRadius: '16px', padding: '24px', display: 'flex', alignItems: 'center', gap: '20px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
                }}>
                    <div style={{
                        width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(212, 175, 55, 0.08)',
                        border: '1px solid rgba(212, 175, 55, 0.2)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: '#d4af37'
                    }}>
                        <Store size={22} />
                    </div>
                    <div>
                        <div style={{ fontSize: '12px', color: '#8888a0', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                            Registered Shops
                        </div>
                        <div style={{ fontSize: '26px', fontWeight: '800', color: '#fff' }}>
                            {fetching ? '...' : totalShops}
                        </div>
                    </div>
                </div>

                {/* Customers KPI */}
                <div style={{
                    flex: 1, minWidth: '240px', background: '#111118', border: '1px solid #1d1d2b',
                    borderRadius: '16px', padding: '24px', display: 'flex', alignItems: 'center', gap: '20px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
                }}>
                    <div style={{
                        width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.08)',
                        border: '1px solid rgba(56, 189, 248, 0.2)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: '#38bdf8'
                    }}>
                        <Users size={22} />
                    </div>
                    <div>
                        <div style={{ fontSize: '12px', color: '#8888a0', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                            Active Customers Managed
                        </div>
                        <div style={{ fontSize: '26px', fontWeight: '800', color: '#fff' }}>
                            {fetching ? '...' : totalCustomers}
                        </div>
                    </div>
                </div>

                {/* Orders KPI */}
                <div style={{
                    flex: 1, minWidth: '240px', background: '#111118', border: '1px solid #1d1d2b',
                    borderRadius: '16px', padding: '24px', display: 'flex', alignItems: 'center', gap: '20px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
                }}>
                    <div style={{
                        width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(74, 222, 128, 0.08)',
                        border: '1px solid rgba(74, 222, 128, 0.2)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: '#4ade80'
                    }}>
                        <ShoppingBag size={22} />
                    </div>
                    <div>
                        <div style={{ fontSize: '12px', color: '#8888a0', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                            Total Orders Handled
                        </div>
                        <div style={{ fontSize: '26px', fontWeight: '800', color: '#fff' }}>
                            {fetching ? '...' : totalOrders}
                        </div>
                    </div>
                </div>
            </div>

            {/* 🔔 Pending Payment Requests Notification Section */}
            {tenants.some(t => t.pending_request_type) && (
                <div style={{
                    background: 'linear-gradient(135deg, #1e1b12 0%, #161208 100%)',
                    border: '1px solid #d4af37', borderRadius: '16px', padding: '24px',
                    marginBottom: '40px', boxShadow: '0 8px 30px rgba(212, 175, 55, 0.1)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#d4af37', animation: 'pulse 1.5s infinite' }} />
                        <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#ffd54f', fontFamily: '"Outfit", sans-serif' }}>
                            Action Required: Pending Premium Payment Requests
                        </h2>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {tenants.filter(t => t.pending_request_type).map(t => (
                            <div key={t.tenant_id} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                background: '#1c1c18', border: '1px solid rgba(212, 175, 55, 0.2)',
                                borderRadius: '12px', padding: '16px 20px', flexWrap: 'wrap', gap: '16px'
                            }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff' }}>{t.shop_name}</span>
                                        <span style={{ fontSize: '11px', color: '#8888a0' }}>({t.tenant_id})</span>
                                        <span style={{
                                            fontSize: '10px', padding: '2px 8px', background: 'rgba(212,175,55,0.1)',
                                            color: '#ffd54f', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '6px', fontWeight: '700'
                                        }}>
                                            {t.pending_request_type} Pass
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '12.5px', color: '#a0a0c0', marginTop: '6px', display: 'flex', gap: '16px' }}>
                                        <span>👤 Admin: <strong>{t.admin_name}</strong></span>
                                        <span>📞 Contact: <strong>{t.phone_number}</strong></span>
                                        <span>📅 Requested: <strong>{t.pending_request_date}</strong></span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <a
                                        href={`https://wa.me/${cleanPhone(t.phone_number)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
                                            background: '#25D366', color: '#fff', textDecoration: 'none',
                                            borderRadius: '8px', fontSize: '12.5px', fontWeight: 'bold', cursor: 'pointer'
                                        }}
                                    >
                                        <Send size={14} /> Contact on WhatsApp
                                    </a>
                                    <button
                                        onClick={() => handleOpenSubscriptionModal(t)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
                                            background: '#d4af37', border: 'none', color: '#0d0d11',
                                            borderRadius: '8px', fontSize: '12.5px', fontWeight: 'bold', cursor: 'pointer'
                                        }}
                                    >
                                        <Gift size={14} /> Fulfill & Generate Pass Key
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Filter and Registry List Card */}
            <div style={{ background: '#111118', border: '1px solid #1d1d2b', borderRadius: '16px', padding: '32px', boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }}>
                
                {/* Custom Tab Switcher */}
                <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid #1a1a26', marginBottom: '32px', paddingBottom: '12px' }}>
                    <button
                        onClick={() => setActiveTab('boutiques')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px',
                            background: activeTab === 'boutiques' ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                            border: '1px solid',
                            borderColor: activeTab === 'boutiques' ? 'rgba(212, 175, 55, 0.3)' : 'transparent',
                            color: activeTab === 'boutiques' ? '#d4af37' : '#8888a0',
                            borderRadius: '8px', fontSize: '13.5px', fontWeight: '600', cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Store size={15} /> Boutique Shops ({tenants.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('blocked')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px',
                            background: activeTab === 'blocked' ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                            border: '1px solid',
                            borderColor: activeTab === 'blocked' ? 'rgba(239, 68, 68, 0.3)' : 'transparent',
                            color: activeTab === 'blocked' ? '#ef4444' : '#8888a0',
                            borderRadius: '8px', fontSize: '13.5px', fontWeight: '600', cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Ban size={15} /> Blocked Phone Registry ({blockedNumbers.length})
                    </button>
                </div>

                {activeTab === 'boutiques' ? (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '28px' }}>
                            <div>
                                <h2 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 4px 0', color: '#fff' }}>
                                    Boutique Registration Ledger
                                </h2>
                                <p style={{ fontSize: '13px', color: '#8888a0', margin: 0 }}>
                                    Manage, filter, and review dynamic parameters for all registered tenants in the Smart Tailor ecosystem.
                                </p>
                            </div>

                            {/* Search Field */}
                            <div style={{
                                display: 'flex', alignItems: 'center', background: '#181824', border: '1px solid #28283d',
                                borderRadius: '10px', padding: '8px 16px', gap: '10px', width: '320px', maxWidth: '100%'
                            }}>
                                <Search size={16} style={{ color: '#68688d' }} />
                                <input
                                    type="text"
                                    placeholder="Filter by shop name, ID, phone..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    style={{
                                        border: 'none', background: 'transparent', color: '#fff', outline: 'none',
                                        fontSize: '13px', flex: 1
                                    }}
                                />
                            </div>
                        </div>

                        {fetching ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: '#8888a0', gap: '16px' }}>
                                <div style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.05)', borderTop: '3px solid #d4af37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                <span style={{ fontSize: '14px', fontWeight: '500' }}>Retrieving registrations from system ledger...</span>
                            </div>
                        ) : filteredTenants.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '60px 0', border: '1px dashed #232334', borderRadius: '12px', color: '#8888a0' }}>
                                <Store size={40} style={{ color: '#38384f', marginBottom: '16px' }} />
                                <h4 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '15px' }}>No Boutiques Found</h4>
                                <p style={{ margin: 0, fontSize: '13px' }}>Try refining your search terms or verify database registrations.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid #232334' }}>
                                            <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '600', color: '#d4af37', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Boutique Shop / Handle</th>
                                            <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '600', color: '#d4af37', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Owner Details</th>
                                            <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '600', color: '#d4af37', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Location & UPI</th>
                                            <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '600', color: '#d4af37', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Analytics Usage</th>
<th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '600', color: '#d4af37', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Plan Status</th>
                                            <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '600', color: '#d4af37', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Registration Date</th>
                                            <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '600', color: '#d4af37', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTenants.map((t, idx) => {
                                            const hasKey = t.subscription_key && t.subscription_pin;
                                            
                                            // Dynamic calculation: if subscription is Free and registered within 30 days, display "New Free", else "Free"
                                            let displayPlan = t.subscription_type || 'Free';
                                            if (displayPlan === 'Free' || displayPlan === 'New Free') {
                                                const createdAt = new Date(t.created_at || Date.now());
                                                const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
                                                if (new Date() - createdAt <= thirtyDaysInMs) {
                                                    displayPlan = 'New Free';
                                                } else {
                                                    displayPlan = 'Free';
                                                }
                                            }

                                            return (
                                                <tr 
                                                    key={t.tenant_id} 
                                                    style={{ 
                                                        borderBottom: '1px solid #1a1a26', 
                                                        background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                                                        transition: 'background 0.2s'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,175,55,0.02)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                                                >
                                                    {/* Boutique Details */}
                                                    <td style={{ padding: '20px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                            <div style={{
                                                                width: '40px', height: '40px', borderRadius: '10px', background: '#1c1c2a',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d4af37',
                                                                border: '1px solid #2c2c3e', fontWeight: '800', fontSize: '15px'
                                                            }}>
                                                                {t.shop_name?.substring(0, 2).toUpperCase() || 'ST'}
                                                            </div>
                                                            <div>
                                                                <div style={{ fontWeight: '700', fontSize: '14px', color: '#fff', marginBottom: '2px' }}>
                                                                    {t.shop_name || 'Unnamed Shop'}
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#68688d' }}>
                                                                    <Hash size={10} />
                                                                    <span style={{ background: '#1a1a28', padding: '1px 6px', borderRadius: '4px', border: '1px solid #232335' }}>
                                                                        {t.tenant_id}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Owner Details */}
                                                    <td style={{ padding: '20px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                            <UserCheck size={14} style={{ color: '#d4af37' }} />
                                                            <span style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>
                                                                {t.admin_name || 'N/A'}
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: '#8888a0' }}>
                                                            {t.phone_number || 'No Phone'}
                                                        </div>
                                                    </td>

                                                    {/* Location and UPI */}
                                                    <td style={{ padding: '20px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#b5b5c9', marginBottom: '4px' }}>
                                                            <MapPin size={12} style={{ color: '#6c6c8c' }} />
                                                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                                                                {t.address || 'No Address Listed'}
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: '11px', color: '#6c6c8c' }}>
                                                            UPI: <span style={{ color: '#8888a0' }}>{t.upi_id || 'Not Set'}</span>
                                                        </div>
                                                    </td>

                                                    {/* Analytics Usage */}
                                                    <td style={{ padding: '20px' }}>
                                                        <div style={{ display: 'flex', gap: '12px' }}>
                                                            <div style={{ background: '#122512', border: '1px solid #1a3c1a', padding: '4px 8px', borderRadius: '6px', textAlign: 'center', minWidth: '54px' }}>
                                                                <div style={{ fontSize: '8px', color: '#4ade80', fontWeight: '700', textTransform: 'uppercase' }}>Orders</div>
                                                                <div style={{ fontSize: '13px', fontWeight: '800', color: '#4ade80' }}>{t.total_orders || 0}</div>
                                                            </div>
                                                            <div style={{ background: '#132335', border: '1px solid #1c3653', padding: '4px 8px', borderRadius: '6px', textAlign: 'center', minWidth: '54px' }}>
                                                                <div style={{ fontSize: '8px', color: '#38bdf8', fontWeight: '700', textTransform: 'uppercase' }}>Clients</div>
                                                                <div style={{ fontSize: '13px', fontWeight: '800', color: '#38bdf8' }}>{t.total_customers || 0}</div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Plan Status */}
                                                    <td style={{ padding: '20px' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <span style={{
                                                                alignSelf: 'flex-start',
                                                                padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                                                                background: displayPlan === 'Yearly' 
                                                                    ? 'rgba(168, 85, 247, 0.15)' 
                                                                    : displayPlan === 'Monthly' 
                                                                        ? 'rgba(249, 115, 22, 0.15)' 
                                                                        : displayPlan === 'New Free'
                                                                            ? 'rgba(56, 189, 248, 0.15)'
                                                                            : 'rgba(100, 116, 139, 0.15)',
                                                                color: displayPlan === 'Yearly' 
                                                                    ? '#c084fc' 
                                                                    : displayPlan === 'Monthly' 
                                                                        ? '#fb923c' 
                                                                        : displayPlan === 'New Free'
                                                                            ? '#38bdf8'
                                                                            : '#94a3b8',
                                                                border: displayPlan === 'Yearly' 
                                                                    ? '1px solid rgba(168, 85, 247, 0.25)' 
                                                                    : displayPlan === 'Monthly' 
                                                                        ? '1px solid rgba(249, 115, 22, 0.25)' 
                                                                        : displayPlan === 'New Free'
                                                                            ? '1px solid rgba(56, 189, 248, 0.25)'
                                                                            : '1px solid rgba(100, 116, 139, 0.25)'
                                                            }}>
                                                                {displayPlan}
                                                            </span>
                                                            {t.pending_request_type && (
                                                                <span style={{
                                                                    alignSelf: 'flex-start', marginTop: '4px',
                                                                    padding: '2px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: '800',
                                                                    background: 'rgba(212, 175, 55, 0.15)',
                                                                    color: '#ffd54f', border: '1px solid rgba(212, 175, 55, 0.3)',
                                                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                                    animation: 'pulse 1.8s infinite'
                                                                }}>
                                                                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ffd54f' }} />
                                                                    PENDING PAY: {t.pending_request_type.toUpperCase()}
                                                                </span>
                                                            )}
                                                            {hasKey && (
                                                                <span style={{ fontSize: '10px', color: '#68688d', fontFamily: 'monospace' }} title={`Key: ${t.subscription_key} (PIN: ${t.subscription_pin})`}>
                                                                    Key: {t.subscription_key.substring(0, 4)}...{t.subscription_key.substring(8)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Registration Date */}
                                                    <td style={{ padding: '20px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#b5b5c9' }}>
                                                            <Calendar size={13} style={{ color: '#6c6c8c' }} />
                                                            <span>
                                                                {t.created_at ? new Date(t.created_at).toLocaleDateString('en-IN', {
                                                                    day: 'numeric',
                                                                    month: 'short',
                                                                    year: 'numeric'
                                                                }) : 'Legacy'}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* Actions */}
                                                    <td style={{ padding: '20px', textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                            <button
                                                                onClick={() => handleOpenSubscriptionModal(t)}
                                                                title="Manage Premium Subscription Plan"
                                                                style={{
                                                                    padding: '8px 12px', borderRadius: '8px',
                                                                    background: 'rgba(212, 175, 55, 0.1)', border: '1px solid rgba(212, 175, 55, 0.3)',
                                                                    color: '#d4af37', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                                                                    transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: '4px'
                                                                }}
                                                                onMouseEnter={e => {
                                                                    e.currentTarget.style.background = '#d4af37';
                                                                    e.currentTarget.style.color = '#000';
                                                                }}
                                                                onMouseLeave={e => {
                                                                    e.currentTarget.style.background = 'rgba(212, 175, 55, 0.1)';
                                                                    e.currentTarget.style.color = '#d4af37';
                                                                }}
                                                            >
                                                                <Gift size={11} /> Plan
                                                            </button>

                                                            <button
                                                                onClick={() => handleBlockTenantPhone(t.phone_number, t.shop_name)}
                                                                title="Block Phone Number from Access"
                                                                disabled={!t.phone_number}
                                                                style={{
                                                                    padding: '8px 12px', borderRadius: '8px',
                                                                    background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.3)',
                                                                    color: '#fb923c', fontSize: '11px', fontWeight: '600', cursor: t.phone_number ? 'pointer' : 'not-allowed',
                                                                    transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                                    opacity: t.phone_number ? 1 : 0.5
                                                                }}
                                                                onMouseEnter={e => {
                                                                    if (t.phone_number) {
                                                                        e.currentTarget.style.background = '#fb923c';
                                                                        e.currentTarget.style.color = '#000';
                                                                    }
                                                                }}
                                                                onMouseLeave={e => {
                                                                    if (t.phone_number) {
                                                                        e.currentTarget.style.background = 'rgba(249, 115, 22, 0.1)';
                                                                        e.currentTarget.style.color = '#fb923c';
                                                                    }
                                                                }}
                                                            >
                                                                <Ban size={11} /> Block
                                                            </button>

                                                            <button
                                                                onClick={() => handleDeleteTenant(t.tenant_id, t.shop_name)}
                                                                title="Delete Boutique Shop and All Data"
                                                                disabled={t.tenant_id === 'default'}
                                                                style={{
                                                                    padding: '8px 12px', borderRadius: '8px',
                                                                    background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
                                                                    color: '#ef4444', fontSize: '11px', fontWeight: '600', cursor: t.tenant_id !== 'default' ? 'pointer' : 'not-allowed',
                                                                    transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                                    opacity: t.tenant_id !== 'default' ? 1 : 0.5
                                                                }}
                                                                onMouseEnter={e => {
                                                                    if (t.tenant_id !== 'default') {
                                                                        e.currentTarget.style.background = '#ef4444';
                                                                        e.currentTarget.style.color = '#fff';
                                                                    }
                                                                }}
                                                                onMouseLeave={e => {
                                                                    if (t.tenant_id !== 'default') {
                                                                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                                                                        e.currentTarget.style.color = '#ef4444';
                                                                    }
                                                                }}
                                                            >
                                                                <Trash2 size={11} /> Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                ) : (
                    <div>
                        {/* Add Block Form */}
                        <form onSubmit={handleBlockNumber} style={{
                            background: '#151522', border: '1px solid #232335', borderRadius: '12px',
                            padding: '24px', marginBottom: '32px', display: 'flex', gap: '20px', alignItems: 'flex-end',
                            flexWrap: 'wrap'
                        }}>
                            <div style={{ flex: 1, minWidth: '240px' }}>
                                <label style={{ display: 'block', color: '#b5b5c9', fontSize: '11px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    Phone Number to Block
                                </label>
                                <input
                                    type="text"
                                    placeholder="Enter registered mobile number..."
                                    value={blockingPhone}
                                    onChange={e => setBlockingPhone(e.target.value)}
                                    style={{
                                        width: '100%', padding: '12px 16px', background: '#101018', border: '1px solid #28283d',
                                        borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none'
                                    }}
                                />
                            </div>

                            <div style={{ flex: 2, minWidth: '320px' }}>
                                <label style={{ display: 'block', color: '#b5b5c9', fontSize: '11px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    Reason for Suspension (Optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Terms violation, spam account, unpaid bills..."
                                    value={blockingReason}
                                    onChange={e => setBlockingReason(e.target.value)}
                                    style={{
                                        width: '100%', padding: '12px 16px', background: '#101018', border: '1px solid #28283d',
                                        borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none'
                                    }}
                                />
                            </div>

                            <button
                                type="submit"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px',
                                    borderRadius: '8px', background: '#ef4444', border: 'none', color: '#fff',
                                    fontSize: '13px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s',
                                    boxShadow: '0 4px 15px rgba(239, 68, 68, 0.2)', height: '45px'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#dc2626'}
                                onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}
                            >
                                <ShieldAlert size={16} /> Block Number
                            </button>
                        </form>

                        {/* Blocked numbers table */}
                        {loadingBlocked ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: '#8888a0', gap: '16px' }}>
                                <div style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.05)', borderTop: '3px solid #ef4444', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                <span style={{ fontSize: '14px', fontWeight: '500' }}>Retrieving blocked directory...</span>
                            </div>
                        ) : blockedNumbers.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '60px 0', border: '1px dashed #232334', borderRadius: '12px', color: '#8888a0' }}>
                                <ShieldAlert size={40} style={{ color: '#38384f', marginBottom: '16px' }} />
                                <h4 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '15px' }}>No Blocked Phone Numbers</h4>
                                <p style={{ margin: 0, fontSize: '13px' }}>The system access ledger is fully authorized and clean.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid #232334' }}>
                                            <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '600', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Blocked Mobile Number</th>
                                            <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '600', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Suspension Reason</th>
                                            <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '600', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date Blocked</th>
                                            <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '600', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {blockedNumbers.map((b, idx) => (
                                            <tr
                                                key={b.phone_number}
                                                style={{
                                                    borderBottom: '1px solid #1a1a26',
                                                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                                                    transition: 'background 0.2s'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.02)'}
                                                onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                                            >
                                                <td style={{ padding: '20px', fontSize: '14px', fontWeight: '700', color: '#fff' }}>
                                                    {b.phone_number}
                                                </td>
                                                <td style={{ padding: '20px', fontSize: '13px', color: '#b5b5c9' }}>
                                                    {b.reason || <span style={{ color: '#4a4a5e', fontStyle: 'italic' }}>No reason provided</span>}
                                                </td>
                                                <td style={{ padding: '20px', fontSize: '13px', color: '#8888a0' }}>
                                                    {b.created_at ? new Date(b.created_at).toLocaleDateString('en-IN', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        year: 'numeric',
                                                        hour: 'numeric',
                                                        minute: '2-digit'
                                                    }) : 'N/A'}
                                                </td>
                                                <td style={{ padding: '20px', textAlign: 'center' }}>
                                                    <button
                                                        onClick={() => handleUnblockNumber(b.phone_number)}
                                                        style={{
                                                            padding: '8px 16px', borderRadius: '8px',
                                                            background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.3)',
                                                            color: '#4ade80', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={e => {
                                                            e.currentTarget.style.background = '#4ade80';
                                                            e.currentTarget.style.color = '#000';
                                                        }}
                                                        onMouseLeave={e => {
                                                            e.currentTarget.style.background = 'rgba(74, 222, 128, 0.1)';
                                                            e.currentTarget.style.color = '#4ade80';
                                                        }}
                                                    >
                                                        Unblock Number
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Subscription Modal overlay */}
            {showModal && selectedTenant && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(5, 5, 8, 0.85)', backdropFilter: 'blur(12px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, padding: '20px', transition: 'all 0.3s'
                }}>
                    <div style={{
                        background: '#12121a', border: '1px solid #28283c', borderRadius: '20px',
                        maxWidth: '520px', width: '100%', padding: '32px', boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
                        position: 'relative'
                    }}>
                        {/* Close Button */}
                        <button 
                            onClick={() => { setShowModal(false); setGeneratedCard(null); }}
                            style={{
                                position: 'absolute', top: '24px', right: '24px', background: 'transparent',
                                border: 'none', color: '#8888a0', cursor: 'pointer', transition: 'color 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                            onMouseLeave={e => e.currentTarget.style.color = '#8888a0'}
                        >
                            <X size={20} />
                        </button>

                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            <div style={{
                                width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(212, 175, 55, 0.1)',
                                border: '1px solid rgba(212, 175, 55, 0.3)', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', color: '#d4af37'
                            }}>
                                <CreditCard size={20} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#fff' }}>
                                    Manage Boutique Plan
                                </h3>
                                <p style={{ margin: 0, fontSize: '12px', color: '#8888a0' }}>
                                    Platform authorization and premium access controls
                                </p>
                            </div>
                        </div>

                        {/* Shop Context Info */}
                        <div style={{
                            background: '#181824', border: '1px solid #232335', borderRadius: '12px',
                            padding: '16px 20px', marginBottom: '28px'
                        }}>
                            <div style={{ fontSize: '10px', color: '#8888a0', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>
                                Shop Target
                            </div>
                            <div style={{ fontSize: '16px', fontWeight: '700', color: '#fff', marginBottom: '6px' }}>
                                {selectedTenant.shop_name}
                            </div>
                            <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: '#b5b5c9', flexWrap: 'wrap' }}>
                                <div>Owner: <strong>{selectedTenant.admin_name}</strong></div>
                                <div style={{ color: '#38384f' }}>|</div>
                                <div>Phone: <strong>{selectedTenant.phone_number}</strong></div>
                            </div>
                        </div>

                        {/* Current details / Generation output */}
                        {generatedCard ? (
                            /* Generated Card Success View */
                            <div style={{ animation: 'fadeIn 0.3s ease' }}>
                                <div style={{
                                    background: 'rgba(74, 222, 128, 0.05)', border: '1px dashed #4ade80',
                                    borderRadius: '12px', padding: '16px 20px', textAlign: 'center', marginBottom: '24px'
                                }}>
                                    <div style={{ color: '#4ade80', display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center', marginBottom: '8px', fontWeight: '700', fontSize: '14px' }}>
                                        <CheckCircle size={18} /> Gift Card Activated!
                                    </div>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#a3a3c2', lineHeight: 1.5 }}>
                                        Premium access config has been registered. Please distribute these credentials to the client.
                                    </p>
                                </div>

                                {/* Card details box */}
                                <div style={{
                                    background: 'linear-gradient(135deg, #1d1d2b 0%, #151520 100%)',
                                    border: '1px solid #33334c', borderRadius: '16px', padding: '24px',
                                    position: 'relative', overflow: 'hidden', marginBottom: '24px'
                                }}>
                                    <div style={{
                                        position: 'absolute', top: '-40px', right: '-40px', width: '120px', height: '120px',
                                        background: 'rgba(212, 175, 55, 0.1)', filter: 'blur(40px)', borderRadius: '50%'
                                    }} />

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                        <span style={{ fontSize: '11px', color: '#d4af37', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase' }}>
                                            Smart Pass
                                        </span>
                                        <span style={{
                                            padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                                            background: generatedCard.subscription_type === 'Yearly' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(249, 115, 22, 0.2)',
                                            color: generatedCard.subscription_type === 'Yearly' ? '#c084fc' : '#fb923c',
                                            border: generatedCard.subscription_type === 'Yearly' ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(249, 115, 22, 0.3)'
                                        }}>
                                            {generatedCard.subscription_type} Plan
                                        </span>
                                    </div>

                                    {/* Code Grid */}
                                    <div style={{ display: 'flex', gap: '16px', marginBottom: '4px' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '10px', color: '#8888a0', textTransform: 'uppercase', fontWeight: '600', marginBottom: '6px' }}>
                                                Gift Pass Key
                                            </div>
                                            <div style={{
                                                background: '#111118', border: '1px solid #232335', borderRadius: '8px',
                                                padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                            }}>
                                                <code style={{ fontSize: '14px', fontWeight: '700', color: '#fff', letterSpacing: '1px', fontFamily: 'monospace' }}>
                                                    {generatedCard.subscription_key}
                                                </code>
                                                <button 
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(generatedCard.subscription_key);
                                                        toast.success('Key copied!');
                                                    }}
                                                    style={{ background: 'transparent', border: 'none', color: '#68688d', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                    title="Copy Key"
                                                >
                                                    <Copy size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        <div style={{ width: '130px' }}>
                                            <div style={{ fontSize: '10px', color: '#8888a0', textTransform: 'uppercase', fontWeight: '600', marginBottom: '6px' }}>
                                                Security PIN
                                            </div>
                                            <div style={{
                                                background: '#111118', border: '1px solid #232335', borderRadius: '8px',
                                                padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                            }}>
                                                <code style={{ fontSize: '14px', fontWeight: '700', color: '#fff', letterSpacing: '2px', fontFamily: 'monospace' }}>
                                                    {generatedCard.subscription_pin}
                                                </code>
                                                <button 
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(generatedCard.subscription_pin);
                                                        toast.success('PIN copied!');
                                                    }}
                                                    style={{ background: 'transparent', border: 'none', color: '#68688d', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                    title="Copy PIN"
                                                >
                                                    <Copy size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Action buttons */}
                                <div style={{ display: 'flex', gap: '16px' }}>
                                    <button
                                        onClick={() => {
                                            const msg = `Hello *${selectedTenant.admin_name}*,\n\nYour premium *Smart Tailor* Gift Card is ready for *${selectedTenant.shop_name}*!\n\n🔹 *Plan:* ${generatedCard.subscription_type}\n🔹 *Card Code:* ${generatedCard.subscription_key}\n🔹 *PIN Code:* ${generatedCard.subscription_pin}\n\nSimply input this key in your dashboard to activate full platform access. Welcome to the Premium Club! ✨`;
                                            window.open(`https://wa.me/${cleanPhone(selectedTenant.phone_number)}?text=${encodeURIComponent(msg)}`, '_blank');
                                        }}
                                        style={{
                                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                            padding: '14px', borderRadius: '10px', background: '#25D366', border: 'none',
                                            color: '#fff', fontSize: '14px', fontWeight: '700', cursor: 'pointer',
                                            transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(37, 211, 102, 0.2)'
                                        }}
                                    >
                                        <Send size={16} /> Send via WhatsApp
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowModal(false);
                                            setGeneratedCard(null);
                                            fetchTenants();
                                        }}
                                        style={{
                                            padding: '14px 20px', borderRadius: '10px', background: 'transparent',
                                            border: '1px solid #28283c', color: '#b5b5c9', fontSize: '14px', fontWeight: '600',
                                            cursor: 'pointer', transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Select Subscription Type View */
                            <form onSubmit={handleSaveSubscription}>
                                <div style={{ marginBottom: '28px' }}>
                                    <label style={{ display: 'block', color: '#b5b5c9', fontSize: '11px', fontWeight: '700', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                        Select Subscription Tier
                                    </label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {/* Free Tier */}
                                        <label style={{
                                            display: 'flex', alignItems: 'center', gap: '14px',
                                            padding: '14px 18px', borderRadius: '12px', border: subType === 'Free' ? '2px solid #64748b' : '1px solid #232335',
                                            background: subType === 'Free' ? 'rgba(100, 116, 139, 0.05)' : '#161622',
                                            cursor: 'pointer', transition: 'all 0.2s'
                                        }}>
                                            <input 
                                                type="radio" 
                                                name="subType" 
                                                value="Free" 
                                                checked={subType === 'Free'}
                                                onChange={e => setSubType(e.target.value)}
                                                style={{ accentColor: '#64748b', width: '16px', height: '16px' }}
                                            />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: '700', fontSize: '14px', color: subType === 'Free' ? '#fff' : '#b5b5c9' }}>
                                                    Free Access
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#8888a0', marginTop: '2px' }}>
                                                    Basic platform features only. No Gift passes.
                                                </div>
                                            </div>
                                        </label>

                                        {/* New Free Tier */}
                                        <label style={{
                                            display: 'flex', alignItems: 'center', gap: '14px',
                                            padding: '14px 18px', borderRadius: '12px', border: subType === 'New Free' ? '2px solid #38bdf8' : '1px solid #232335',
                                            background: subType === 'New Free' ? 'rgba(56, 189, 248, 0.05)' : '#161622',
                                            cursor: 'pointer', transition: 'all 0.2s'
                                        }}>
                                            <input 
                                                type="radio" 
                                                name="subType" 
                                                value="New Free" 
                                                checked={subType === 'New Free'}
                                                onChange={e => setSubType(e.target.value)}
                                                style={{ accentColor: '#38bdf8', width: '16px', height: '16px' }}
                                            />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: '700', fontSize: '14px', color: subType === 'New Free' ? '#fff' : '#b5b5c9' }}>
                                                    New Free Access
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#8888a0', marginTop: '2px' }}>
                                                    Assigned to newly registered boutique accounts.
                                                </div>
                                            </div>
                                        </label>

                                        {/* Monthly Tier */}
                                        <label style={{
                                            display: 'flex', alignItems: 'center', gap: '14px',
                                            padding: '14px 18px', borderRadius: '12px', border: subType === 'Monthly' ? '2px solid #fb923c' : '1px solid #232335',
                                            background: subType === 'Monthly' ? 'rgba(251, 146, 60, 0.05)' : '#161622',
                                            cursor: 'pointer', transition: 'all 0.2s'
                                        }}>
                                            <input 
                                                type="radio" 
                                                name="subType" 
                                                value="Monthly" 
                                                checked={subType === 'Monthly'}
                                                onChange={e => setSubType(e.target.value)}
                                                style={{ accentColor: '#fb923c', width: '16px', height: '16px' }}
                                            />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: '700', fontSize: '14px', color: subType === 'Monthly' ? '#fff' : '#b5b5c9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    Monthly Premium <span style={{ fontSize: '9px', padding: '2px 6px', background: 'rgba(251, 146, 60, 0.1)', color: '#fb923c', borderRadius: '4px', fontWeight: '700' }}>Popular</span>
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#8888a0', marginTop: '2px' }}>
                                                    Generates unique 12-char gift card pass + 6-digit PIN.
                                                </div>
                                            </div>
                                        </label>

                                        {/* Yearly Tier */}
                                        <label style={{
                                            display: 'flex', alignItems: 'center', gap: '14px',
                                            padding: '14px 18px', borderRadius: '12px', border: subType === 'Yearly' ? '2px solid #c084fc' : '1px solid #232335',
                                            background: subType === 'Yearly' ? 'rgba(192, 132, 252, 0.05)' : '#161622',
                                            cursor: 'pointer', transition: 'all 0.2s'
                                        }}>
                                            <input 
                                                type="radio" 
                                                name="subType" 
                                                value="Yearly" 
                                                checked={subType === 'Yearly'}
                                                onChange={e => setSubType(e.target.value)}
                                                style={{ accentColor: '#c084fc', width: '16px', height: '16px' }}
                                            />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: '700', fontSize: '14px', color: subType === 'Yearly' ? '#fff' : '#b5b5c9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    Yearly Elite Pass <span style={{ fontSize: '9px', padding: '2px 6px', background: 'rgba(192, 132, 252, 0.1)', color: '#c084fc', borderRadius: '4px', fontWeight: '700' }}>Best Value</span>
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#8888a0', marginTop: '2px' }}>
                                                    Generates high tier 12-char gift card pass + 6-digit PIN.
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                {/* Footer buttons */}
                                <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', borderTop: '1px solid #1a1a26', paddingTop: '20px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        style={{
                                            padding: '12px 20px', borderRadius: '10px', background: 'transparent',
                                            border: '1px solid #28283c', color: '#b5b5c9', fontSize: '14px', fontWeight: '600',
                                            cursor: 'pointer', transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px',
                                            borderRadius: '10px', background: '#d4af37', border: 'none', color: '#0d0d11',
                                            fontSize: '14px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s',
                                            boxShadow: '0 4px 15px rgba(212, 175, 55, 0.2)'
                                        }}
                                    >
                                        <Gift size={16} /> {saving ? 'Saving...' : subType === 'Free' ? 'Save Changes' : 'Generate Gift Pass'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
