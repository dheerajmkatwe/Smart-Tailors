import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    Package, Clock, CheckCircle, DollarSign,
    Users, ShoppingBag, AlertTriangle, TrendingUp,
    Eye, Plus, PlusCircle, ClipboardList, Menu, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import CalendarView from '../components/CalendarView';
import KpiOverviewModal from '../components/KpiOverviewModal';

/* ─── Free Trial Pill (compact topbar badge) ───────────────────────────── */
const TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days full trial access

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('sub-banner-styles')) {
    const s = document.createElement('style');
    s.id = 'sub-banner-styles';
    s.textContent = `
        @keyframes shimmerMove { 0%{left:-60%} 100%{left:120%} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
    `;
    document.head.appendChild(s);
}

function normalizeIsoDate(dateStr) {
    if (!dateStr) return null;
    let s = String(dateStr).trim();
    if (s.includes(' ') && !s.includes('T')) {
        s = s.replace(' ', 'T');
    }
    if (!s.endsWith('Z') && !s.includes('+') && !s.includes('-')) {
        s = s + 'Z';
    }
    return s;
}

function getTimeLeftFromExpiry(expiresAt) {
    if (!expiresAt) return null;
    const normalized = normalizeIsoDate(expiresAt);
    const end  = new Date(normalized).getTime();
    const diff = end - Date.now();
    if (isNaN(diff) || diff <= 0) return null;
    const days    = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours   = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return { days, hours, minutes, seconds };
}

function resolveExpiresAt(auth) {
    if (auth?.subscription_expires_at) {
        return auth.subscription_expires_at;
    }
    if (auth?.created_at) {
        const t = new Date(normalizeIsoDate(auth.created_at) || auth.created_at).getTime() + TRIAL_DURATION_MS;
        return new Date(t).toISOString();
    }
    return new Date(Date.now() + TRIAL_DURATION_MS).toISOString();
}

/* ─── Subscription Status Banner ────────────────────────────────────────── */
function FreeTrialPopup({ auth }) {
    const expiresAt = resolveExpiresAt(auth);
    const [timeLeft, setTimeLeft] = useState(() => getTimeLeftFromExpiry(expiresAt));

    useEffect(() => {
        if (!expiresAt) return;
        setTimeLeft(getTimeLeftFromExpiry(expiresAt));
        const id = setInterval(() => setTimeLeft(getTimeLeftFromExpiry(expiresAt)), 1000);
        return () => clearInterval(id);
    }, [expiresAt]);

    if (!timeLeft) return null;

    const subType = auth?.subscription_type || 'Free';
    const isFree = subType === 'Free';
    const isMonthly = subType === 'Monthly';

    const theme = isFree
        ? { accent: '#38bdf8', glow: 'rgba(56,189,248,0.4)', label: 'FREE TRIAL', sub: 'Time Remaining', darkBg: 'linear-gradient(135deg, #0c2233 0%, #0a1e2e 100%)' }
        : isMonthly
            ? { accent: '#fb923c', glow: 'rgba(251,146,60,0.4)', label: '₹1 MONTHLY TRIAL', sub: '30-Day Access Active', darkBg: 'linear-gradient(135deg, #1f1208 0%, #160e06 100%)' }
            : { accent: '#c084fc', glow: 'rgba(192,132,252,0.4)', label: '₹9,999 ANNUAL PLAN', sub: '365-Day Access Active', darkBg: 'linear-gradient(135deg, #1a0e24 0%, #130a1b 100%)' };

    const urgency = timeLeft.days < 3;
    const totalMs = isFree ? TRIAL_DURATION_MS : (isMonthly ? 30*24*60*60*1000 : 365*24*60*60*1000);
    const remainMs = timeLeft.days*86400000 + timeLeft.hours*3600000 + timeLeft.minutes*60000 + timeLeft.seconds*1000;
    const pct = Math.max(0, Math.min(100, (remainMs / totalMs) * 100));

    const digitBox = (val, label, red = false) => (
        <div style={{ textAlign: 'center' }}>
            <div style={{
                background: 'rgba(255,255,255,0.12)', border: `1.5px solid ${urgency && red ? '#ef4444' : theme.accent}`,
                borderRadius: 10, padding: '6px 12px', minWidth: 52, fontSize: 26, fontWeight: 900,
                color: urgency && red ? '#ef4444' : '#ffffff', fontFamily: '"Courier New", monospace',
                letterSpacing: '0.05em', textShadow: `0 0 12px ${urgency && red ? '#ef4444' : theme.accent}77`
            }}>{String(val).padStart(2,'0')}</div>
            <div style={{ fontSize: 10, color: '#ffffff', opacity: 0.9, marginTop: 4, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
        </div>
    );

    const sep = <span style={{ color: theme.accent, fontWeight: 900, fontSize: 22, marginBottom: 18, opacity: 0.9 }}>:</span>;

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
            background: theme.darkBg,
            border: `2px solid ${theme.accent}`,
            borderRadius: 16, padding: '14px 20px', marginBottom: 20,
            position: 'relative', overflow: 'hidden',
            boxShadow: `0 6px 28px ${theme.glow}, 0 4px 12px rgba(0,0,0,0.5)`
        }}>
            {/* Shimmer sweep */}
            <div style={{ position: 'absolute', top: 0, left: '-80%', width: '50%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)', animation: 'shimmerMove 3s infinite', pointerEvents: 'none' }} />

            {/* LEFT — plan label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 150 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: theme.accent, boxShadow: `0 0 10px ${theme.accent}`, animation: `blink ${urgency ? '0.7s' : '2s'} infinite`, flexShrink: 0 }} />
                <div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: theme.accent, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{theme.label}</div>
                    <div style={{ fontSize: 11, color: '#ffffff', opacity: 0.8, marginTop: 2, fontWeight: 600 }}>{theme.sub}</div>
                </div>
            </div>

            {/* CENTER — digit countdown (seconds included for ALL plans) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center' }}>
                {digitBox(timeLeft.days, 'Days')}
                {sep}
                {digitBox(timeLeft.hours, 'Hours')}
                {sep}
                {digitBox(timeLeft.minutes, 'Mins')}
                {sep}
                {digitBox(timeLeft.seconds, 'Secs', true)}
            </div>

            {/* RIGHT — progress bar + badge */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, minWidth: 120 }}>
                <div style={{ width: '100%', height: 7, background: 'rgba(255,255,255,0.15)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent}dd)`, borderRadius: 4, transition: 'width 1s linear', boxShadow: `0 0 6px ${theme.glow}` }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 900, color: urgency ? '#ffffff' : theme.accent, background: urgency ? '#dc2626' : 'rgba(255,255,255,0.12)', border: `1.5px solid ${urgency ? '#ef4444' : theme.accent}`, padding: '4px 12px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                    {urgency ? '⚠️ ' : ''}{timeLeft.days > 0 ? `${timeLeft.days}d ${timeLeft.hours}h left` : timeLeft.hours > 0 ? `${timeLeft.hours}h ${timeLeft.minutes}m left` : `${timeLeft.minutes}m ${timeLeft.seconds}s left`}
                </span>
            </div>
        </div>
    );
}


function EnhancedStatCard({ value, label, icon: Icon, colorTheme, active, onClick }) {
    const themes = {
        gold: {
            borderTop: '4px solid #C6A75E',
            iconBg: '#FFF6DF',
            iconColor: '#A8893C',
            accentColor: '#A8893C',
            bgGradient: 'linear-gradient(135deg, rgba(255, 248, 230, 0.6) 0%, #FFFFFF 100%)',
        },
        maroon: {
            borderTop: '4px solid #6A1E2E',
            iconBg: '#FDF0F2',
            iconColor: '#6A1E2E',
            accentColor: '#6A1E2E',
            bgGradient: 'linear-gradient(135deg, rgba(253, 240, 242, 0.6) 0%, #FFFFFF 100%)',
        },
        green: {
            borderTop: '4px solid #2E7D32',
            iconBg: '#EAF5EA',
            iconColor: '#2E7D32',
            accentColor: '#2E7D32',
            bgGradient: 'linear-gradient(135deg, rgba(234, 245, 234, 0.6) 0%, #FFFFFF 100%)',
        },
        blue: {
            borderTop: '4px solid #1565C0',
            iconBg: '#EDF4FC',
            iconColor: '#1565C0',
            accentColor: '#1565C0',
            bgGradient: 'linear-gradient(135deg, rgba(237, 244, 252, 0.6) 0%, #FFFFFF 100%)',
        },
    };

    const style = themes[colorTheme] || themes.gold;

    return (
        <div
            onClick={onClick}
            className={`stat-card enhanced-kpi-card ${active ? 'active-stat' : ''}`}
            style={{
                background: style.bgGradient,
                borderTop: style.borderTop,
                borderRadius: 'var(--radius-lg)',
                padding: '16px 18px',
                cursor: 'pointer',
                transition: 'all 0.22s ease-in-out',
                boxShadow: active ? '0 8px 24px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.04)',
                borderLeft: '1px solid rgba(0,0,0,0.06)',
                borderRight: '1px solid rgba(0,0,0,0.06)',
                borderBottom: '1px solid rgba(0,0,0,0.06)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '125px',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            <div className="flex-between" style={{ alignItems: 'flex-start' }}>
                <div className="stat-icon-wrap" style={{
                    width: 40, height: 40, borderRadius: '12px',
                    background: style.iconBg, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
                }}>
                    <Icon size={22} color={style.iconColor} />
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{
                        fontSize: 30, fontWeight: 700, fontFamily: 'var(--font-serif)',
                        color: 'var(--charcoal)', lineHeight: 1
                    }}>
                        {value ?? 0}
                    </div>
                </div>
            </div>

            <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--maroon-dark)', letterSpacing: '0.01em' }}>
                    {label}
                </div>
                <div className="flex items-center gap-4" style={{ fontSize: 11, color: style.accentColor, fontWeight: 600, marginTop: 4 }}>
                    <span>View Details Overview</span>
                    <ArrowRight size={12} />
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }) {
    const cls = {
        Pending: 'badge badge-pending',
        Ready: 'badge badge-ready',
        Delivered: 'badge badge-delivered',
    }[status] || 'badge';
    return <span className={cls}>{status}</span>;
}

function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Dashboard({ onMenuClick, auth }) {
    const [data, setData] = useState(null);
    const [allOrders, setAllOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeKpiCategory, setActiveKpiCategory] = useState(null);
    const [isOverviewModalOpen, setIsOverviewModalOpen] = useState(false);
    const [trialInfo, setTrialInfo] = useState({
        subscription_type: auth?.subscription_type || 'Free',
        subscription_expires_at: auth?.subscription_expires_at || null,
        created_at: auth?.created_at || null,
    });

    // Always fetch fresh trial info from server on mount — never trust stale localStorage
    useEffect(() => {
        api.get('/auth/premium-status')
            .then(res => {
                setTrialInfo({
                    subscription_type: res.data.subscription_type || 'Free',
                    subscription_expires_at: res.data.subscription_expires_at || null,
                    created_at: res.data.created_at || null,
                });
            })
            .catch(() => {}); // silently fail — pill simply won't show
    }, []);

    const loadDashboardData = useCallback(() => {
        return Promise.all([
            api.get('/dashboard'),
            api.get('/orders')
        ])
            .then(([dashRes, ordersRes]) => {
                setData(dashRes.data);
                setAllOrders(ordersRes.data || []);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        loadDashboardData().then(() => {
            // Notifications throttled
            const lastNotified = localStorage.getItem('dashboard_toast_time');
            const now = new Date().getTime();
            const threeHours = 3 * 60 * 60 * 1000;

            if (!lastNotified || now - parseInt(lastNotified) > threeHours) {
                if (data?.dueTodayOrders?.length > 0) {
                    data.dueTodayOrders.forEach(order => {
                        toast(`🚚 ${order.customer_name}'s delivery is due today!`, {
                            icon: '🗓️',
                            style: { borderRadius: '10px', background: '#6A1E2E', color: '#fff', fontSize: '14px', fontWeight: '600' },
                        });
                    });
                }
                localStorage.setItem('dashboard_toast_time', now.toString());
            }
        });
    }, []);

    const handleKpiCardClick = (categoryKey) => {
        setActiveKpiCategory(categoryKey);
        setIsOverviewModalOpen(true);
    };

    if (loading) return (
        <div>
            <div className="topbar flex-between">
                <div className="flex">
                    <button className="mobile-menu-btn" onClick={onMenuClick}>
                        <Menu size={22} />
                    </button>
                    <div>
                        <div className="topbar-title">Dashboard</div>
                        <div className="topbar-subtitle">Loading shop overview...</div>
                    </div>
                </div>
            </div>
            <div className="page-container"><div className="spinner" /></div>
        </div>
    );

    const todayStr = new Date().toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    return (
        <div>
            {/* Topbar */}
            <div className="topbar flex-between">
                <div className="flex items-center gap-10">
                    <button className="mobile-menu-btn" onClick={onMenuClick}>
                        <Menu size={22} />
                    </button>
                    <div>
                        <div className="topbar-title">Dashboard</div>
                        <div className="topbar-subtitle">{todayStr}</div>
                    </div>
                </div>



                {/* Create New Order Button */}
                <Link to="/new-order" className="btn btn-primary topbar-create-order-btn" style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 16px',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: 600,
                    fontSize: 13.5,
                    boxShadow: '0 4px 12px rgba(106,30,46,0.25)',
                    whiteSpace: 'nowrap'
                }}>
                    <PlusCircle size={18} />
                    <span>Create New Order</span>
                </Link>
            </div>

            <div className="page-container">
                {/* ─── FREE TRIAL LIVE POPUP BANNER ─── */}
                <FreeTrialPopup auth={trialInfo} />

                {/* Overdue alert banner */}
                {data?.overdueCount > 0 && (
                    <div className="alert alert-warning flex gap-8 mb-16" onClick={() => handleKpiCardClick('overdue')} style={{ cursor: 'pointer' }}>
                        <AlertTriangle size={16} />
                        <strong>{data.overdueCount} order(s)</strong>&nbsp;are overdue and not yet delivered! Click to view details.
                    </div>
                )}

                {/* 1. TOP SECTION: ENHANCED KPI CARDS (2 per row on mobile & desktop in 2-col grid) */}
                <div className="kpi-grid mb-24">
                    <EnhancedStatCard
                        value={data?.dueToday}
                        label="Due Today"
                        icon={Clock}
                        colorTheme="gold"
                        active={activeKpiCategory === 'dueToday'}
                        onClick={() => handleKpiCardClick('dueToday')}
                    />
                    <EnhancedStatCard
                        value={data?.pendingCount}
                        label="Pending Orders"
                        icon={Package}
                        colorTheme="maroon"
                        active={activeKpiCategory === 'pending'}
                        onClick={() => handleKpiCardClick('pending')}
                    />
                    <EnhancedStatCard
                        value={data?.readyCount}
                        label="Ready for Pickup"
                        icon={CheckCircle}
                        colorTheme="green"
                        active={activeKpiCategory === 'ready'}
                        onClick={() => handleKpiCardClick('ready')}
                    />
                    <EnhancedStatCard
                        value={data?.dueTomorrow}
                        label="Due Tomorrow"
                        icon={AlertTriangle}
                        colorTheme="blue"
                        active={activeKpiCategory === 'dueTomorrow'}
                        onClick={() => handleKpiCardClick('dueTomorrow')}
                    />
                </div>

                {/* KPI Overview Modal / Details Box */}
                <KpiOverviewModal
                    isOpen={isOverviewModalOpen}
                    onClose={() => setIsOverviewModalOpen(false)}
                    categoryKey={activeKpiCategory}
                    allOrders={allOrders}
                    onStatusUpdate={loadDashboardData}
                />

                {/* 2. CENTER SECTION: CALENDAR VIEW */}
                <CalendarView
                    orders={allOrders}
                    onStatusUpdate={loadDashboardData}
                />

                {/* 3. QUICK STATS & QUICK ACTIONS */}
                <div className="grid-2 gap-16 mb-24">
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Quick Stats</h3>
                        </div>
                        <div className="card-body">
                            {[
                                { icon: Users, color: 'var(--gold)', label: 'Total Customers', val: data?.totalCustomers },
                                { icon: ShoppingBag, color: 'var(--maroon)', label: 'Total Orders', val: data?.totalOrders },
                                { icon: DollarSign, color: '#2E7D32', label: 'Advance Collected', val: `\u20b9${(data?.totalAdvance || 0).toLocaleString('en-IN')}` },
                                { icon: AlertTriangle, color: '#E65100', label: 'Overdue Orders', val: data?.overdueCount, clickable: true, key: 'overdue' },
                            ].map(({ icon: Ic, color, label, val, clickable, key }, i) => (
                                <div
                                    key={i}
                                    className="flex-between"
                                    style={{
                                        padding: '10px 0', borderBottom: i < 3 ? '1px solid var(--gray-light)' : 'none',
                                        cursor: clickable ? 'pointer' : 'default'
                                    }}
                                    onClick={() => clickable ? handleKpiCardClick(key) : null}
                                >
                                    <span className="flex gap-8"><Ic size={16} color={color} />{label}</span>
                                    <strong>{val}</strong>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Quick Actions</h3>
                        </div>
                        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <Link to="/new-order" className="btn btn-primary" style={{ justifyContent: 'center', padding: '11px 16px' }}>
                                <PlusCircle size={16} /> Create New Order
                            </Link>
                            <Link to="/search" className="btn btn-outline" style={{ justifyContent: 'center', padding: '11px 16px' }}>
                                <Users size={16} /> Search Customer
                            </Link>
                            <Link to="/orders" className="btn btn-ghost" style={{ justifyContent: 'center', padding: '11px 16px' }}>
                                <ClipboardList size={16} /> View All Orders
                            </Link>
                        </div>
                    </div>
                </div>

                {/* 4. BOTTOM SECTION: RECENT ORDERS */}
                <div className="card">
                    <div className="card-header flex-between">
                        <h3 className="card-title">Recent Orders</h3>
                        <Link to="/orders" className="btn btn-sm btn-ghost">View All</Link>
                    </div>
                    <div className="table-container hide-on-mobile" style={{ border: 'none', maxHeight: 380, overflowY: 'auto' }}>
                        <table>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                                <tr>
                                    <th>#</th><th>Customer</th><th>Phone</th>
                                    <th>Booking</th><th>Delivery</th><th>Amount</th><th>Status</th><th>Bill</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!data?.recentOrders?.length && (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--gray)' }}>
                                            No orders yet
                                        </td>
                                    </tr>
                                )}
                                {data?.recentOrders?.map(o => (
                                    <tr key={o.order_id}>
                                        <td><span style={{ fontWeight: 600, color: 'var(--maroon)' }}>#{String(o.order_number || o.order_id).padStart(4, '0')}</span></td>
                                        <td>
                                            <Link to={`/customer/${o.customer_id}`} state={{ from: '/' }} style={{ color: 'inherit', textDecoration: 'none' }}>
                                                <strong>{o.customer_name}</strong>
                                            </Link>
                                        </td>
                                        <td style={{ fontSize: 13 }}>{o.phone_number}</td>
                                        <td style={{ fontSize: 13 }}>{formatDate(o.booking_date)}</td>
                                        <td style={{ fontSize: 13 }}>{formatDate(o.delivery_date)}</td>
                                        <td><strong>{`\u20b9${parseFloat(o.total_amount).toLocaleString('en-IN')}`}</strong></td>
                                        <td><StatusBadge status={o.status} /></td>
                                        <td>
                                            <div className="flex gap-8">
                                                <Link to={`/customer/${o.customer_id}`} state={{ from: '/' }} className="btn btn-sm btn-ghost p-4" title="View Measurements">
                                                    <Users size={14} />
                                                </Link>
                                                <Link to={`/bill/${o.order_id}`} className="btn btn-sm btn-outline">
                                                    <Eye size={12} /> Bill
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="mobile-cards show-on-mobile" style={{ padding: '16px' }}>
                        {!data?.recentOrders?.length && (
                            <div className="empty-state">No orders yet</div>
                        )}
                        {data?.recentOrders?.map(o => (
                            <div className="order-card" key={o.order_id}>
                                <div className="order-card-header">
                                    <div className="order-card-id" style={{ color: 'var(--maroon)' }}>
                                        #{String(o.order_number || o.order_id).padStart(4, '0')}
                                    </div>
                                    <StatusBadge status={o.status} />
                                </div>
                                <div className="order-card-body">
                                    <div className="order-card-item">
                                        <span className="order-card-label">Customer</span>
                                        <Link to={`/customer/${o.customer_id}`} state={{ from: '/' }} className="order-card-value" style={{ fontWeight: 600 }}>
                                            {o.customer_name}
                                        </Link>
                                    </div>
                                    <div className="order-card-item">
                                        <span className="order-card-label">Phone</span>
                                        <span className="order-card-value">{o.phone_number}</span>
                                    </div>
                                    <div className="order-card-item">
                                        <span className="order-card-label">Booking Date</span>
                                        <span className="order-card-value">{formatDate(o.booking_date)}</span>
                                    </div>
                                    <div className="order-card-item">
                                        <span className="order-card-label">Delivery Date</span>
                                        <span className="order-card-value" style={{ fontWeight: 600 }}>{formatDate(o.delivery_date)}</span>
                                    </div>
                                    <div className="order-card-item" style={{ gridColumn: 'span 2' }}>
                                        <span className="order-card-label">Amount</span>
                                        <span className="order-card-value" style={{ fontSize: 15, fontWeight: 700, color: 'var(--maroon-dark)' }}>
                                            {`\u20b9${parseFloat(o.total_amount).toLocaleString('en-IN')}`}
                                        </span>
                                    </div>
                                </div>
                                <div className="order-card-actions">
                                    <Link to={`/customer/${o.customer_id}`} state={{ from: '/' }} className="btn btn-sm btn-ghost">
                                        <Users size={14} /> Measurements
                                    </Link>
                                    <Link to={`/bill/${o.order_id}`} className="btn btn-sm btn-outline">
                                        <Eye size={12} /> View Bill
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <style>{`
                .enhanced-kpi-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 10px 24px rgba(0,0,0,0.1) !important;
                }
                .active-stat {
                    box-shadow: 0 0 0 3px var(--gold-light), 0 8px 24px rgba(0,0,0,0.12) !important;
                    transform: translateY(-2px);
                }
            `}</style>
        </div>
    );
}
