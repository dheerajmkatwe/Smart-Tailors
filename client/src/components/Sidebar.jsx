import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import {
    LayoutDashboard, PlusCircle, Search, ClipboardList,
    Scissors, X, LineChart, LogOut, DollarSign, Wrench, Settings, Crown
} from 'lucide-react';

export default function Sidebar({ isOpen, onClose, auth, setAuth }) {
    const navigate = useNavigate();
    const isAdmin = auth?.role === 'Admin';
    const isPremium = auth?.isPremiumActive;
    const currentSub = auth?.subscription_type || 'Free';
    const isPaidPremium = isPremium && (currentSub === 'Monthly' || currentSub === 'Yearly');

    const [branches, setBranches] = useState([]);
    const [activeBranch, setActiveBranch] = useState(localStorage.getItem('tailor_branch_id') || 'all');
    
    // Domain Switcher (LADIES/MENS)
    const canSwitchMode = auth?.shop_type === 'BOTH' || !auth?.shop_type;
    const [activeMode, setActiveMode] = useState(localStorage.getItem('tailor_active_mode') || 'LADIES');

    useEffect(() => {
        if (!localStorage.getItem('tailor_active_mode') && auth?.shop_type) {
            const initialMode = auth.shop_type === 'BOTH' ? 'LADIES' : auth.shop_type;
            localStorage.setItem('tailor_active_mode', initialMode);
            setActiveMode(initialMode);
        }
    }, [auth]);

    const handleModeChange = (newMode) => {
        localStorage.setItem('tailor_active_mode', newMode);
        setActiveMode(newMode);
        window.location.reload();
    };

    useEffect(() => {
        if (isAdmin) {
            api.get('/auth/branches')
                .then(res => {
                    const list = res.data || [];
                    setBranches(list);
                    const stored = localStorage.getItem('tailor_branch_id');
                    // If nothing is stored yet, default to the first real branch (not 'all')
                    // This ensures new orders always get stamped with the correct branch_id
                    if (!stored || stored === 'null' || stored === 'undefined') {
                        const defaultId = list.length > 0 ? String(list[0].id) : 'all';
                        localStorage.setItem('tailor_branch_id', defaultId);
                        setActiveBranch(defaultId);
                    }
                })
                .catch(err => console.error('Error fetching branches:', err));
        }
    }, [isAdmin]);

    const handleBranchChange = (e) => {
        const val = e.target.value;
        localStorage.setItem('tailor_branch_id', val);
        setActiveBranch(val);
        window.location.reload();
    };

    const navItems = [
        { to: '/',            icon: LayoutDashboard, label: 'Dashboard',       show: true },
        { to: '/new-order',   icon: PlusCircle,      label: 'New Order',       show: true },
        { to: '/search',      icon: Search,          label: 'Customer Search', show: isAdmin },
        { to: '/orders',      icon: ClipboardList,   label: 'Order History',   show: isAdmin },
        { to: '/alterations', icon: Wrench,          label: 'Alterations',     show: isAdmin },
        { to: '/analytics',   icon: LineChart,       label: 'Analytics',       show: isAdmin },
        { to: '/profits',     icon: DollarSign,      label: 'Profits',         show: isAdmin },
        { to: '/settings',    icon: Settings,        label: 'Boutique Settings', show: isAdmin },
        { to: '/subscribe',   icon: Crown,           label: '👑 Subscribe to Premium', show: isAdmin && !isPaidPremium },
    ];

    const handleLogout = () => {
        localStorage.removeItem('tailor_auth');
        localStorage.removeItem('tailor_branch_id');
        setAuth(null);
        navigate('/');
    };

    const initials = auth?.name
        ? auth.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
        : (isAdmin ? 'AD' : 'WK');

    return (
        <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
            {/* Mobile Close Button */}
            <button className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">
                <X size={18} />
            </button>

            {/* Logo */}
            <div className="sidebar-logo">
                {auth?.shop_logo ? (
                    <img src={auth.shop_logo} alt="Shop Logo" style={{ width: 58, height: 58, margin: '0 auto 10px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--gold)', background: '#fff', boxShadow: 'var(--shadow-gold)' }} />
                ) : (
                    <div className="logo-circle">ST</div>
                )}
                <span className="logo-name">{auth?.shop_name || 'SMART TAILOR'}</span>
                <span className="logo-tagline">{isAdmin ? 'Admin Portal' : 'Worker Portal'}</span>
            </div>

            {/* User pill */}
            <div style={{
                margin: '10px 16px 0',
                padding: '10px 14px',
                background: 'rgba(198,167,94,0.07)',
                borderRadius: 10,
                border: '1px solid rgba(198,167,94,0.12)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
            }}>
                <div style={{
                    width: 30, height: 30,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(198,167,94,0.4), rgba(198,167,94,0.2))',
                    border: '1px solid rgba(198,167,94,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: 'var(--gold)',
                    flexShrink: 0,
                }}>
                    {initials}
                </div>
                <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {auth?.name || (isAdmin ? 'Administrator' : 'Worker')}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(198,167,94,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {auth?.role || 'User'}
                    </div>
                </div>
            </div>

            {/* Branch Switcher */}
            {isAdmin && (
                <div style={{
                    margin: '12px 16px 0',
                    padding: '8px 12px 10px',
                    background: 'rgba(26,10,16,0.5)',
                    borderRadius: 10,
                    border: '1px solid rgba(198,167,94,0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                }}>
                    <label style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        color: 'var(--gold)',
                        letterSpacing: '0.08em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                    }}>
                        <Scissors size={10} /> SELECT LOCATION
                    </label>
                    <select
                        value={activeBranch}
                        onChange={handleBranchChange}
                        style={{
                            width: '100%',
                            background: '#1A0A10',
                            border: '1px solid rgba(198,167,94,0.3)',
                            borderRadius: 6,
                            padding: '6px 10px',
                            color: '#F5F0E8',
                            fontSize: 12,
                            fontFamily: 'var(--font-inter)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            outline: 'none',
                        }}
                    >
                        <option value="all">📍 All Locations</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>
                                📍 {b.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* Application Mode Switcher (LADIES / MENS) */}
            {canSwitchMode && (
                <div style={{
                    margin: '12px 16px 0',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    padding: 4
                }}>
                    <button
                        onClick={() => handleModeChange('LADIES')}
                        style={{
                            flex: 1, padding: '6px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                            background: activeMode === 'LADIES' ? 'rgba(212,175,55,0.2)' : 'transparent',
                            color: activeMode === 'LADIES' ? '#d4af37' : 'rgba(255,255,255,0.4)',
                        }}
                    >
                        👗 Ladies
                    </button>
                    <button
                        onClick={() => handleModeChange('MENS')}
                        style={{
                            flex: 1, padding: '6px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                            background: activeMode === 'MENS' ? 'rgba(212,175,55,0.2)' : 'transparent',
                            color: activeMode === 'MENS' ? '#d4af37' : 'rgba(255,255,255,0.4)',
                        }}
                    >
                        👔 Men's
                    </button>
                </div>
            )}

            {/* Navigation */}
            <nav className="sidebar-nav" style={{ flex: 1 }}>
                <p className="nav-section-title">Main Menu</p>
                {navItems.filter(item => item.show).map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                        end={to === '/'}
                        onClick={onClose}
                    >
                        <Icon size={16} strokeWidth={1.75} />
                        {label}
                    </NavLink>
                ))}
            </nav>

            {/* Logout */}
            <div style={{ padding: '0 12px 12px' }}>
                <button
                    onClick={handleLogout}
                    style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '9px 14px',
                        background: 'rgba(211,47,47,0.08)',
                        border: '1px solid rgba(211,47,47,0.18)',
                        borderRadius: 8,
                        color: '#ef9a9a',
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontFamily: 'var(--font-inter)',
                        letterSpacing: '0.01em',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(211,47,47,0.16)';
                        e.currentTarget.style.color = '#ffcdd2';
                        e.currentTarget.style.borderColor = 'rgba(211,47,47,0.3)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(211,47,47,0.08)';
                        e.currentTarget.style.color = '#ef9a9a';
                        e.currentTarget.style.borderColor = 'rgba(211,47,47,0.18)';
                    }}
                >
                    <LogOut size={15} />
                    Logout
                </button>
            </div>

            {/* Footer */}
            <div className="sidebar-footer">
                <Scissors size={11} style={{ display: 'inline', marginRight: 5, opacity: 0.6 }} />
                Billing System&nbsp;·&nbsp;v1.2&nbsp;·&nbsp;2026
            </div>
        </aside>
    );
}
