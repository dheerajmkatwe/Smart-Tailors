import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Eye, Filter, RefreshCw, Menu, Edit2, Check, X, User, Trash2, AlertTriangle } from 'lucide-react';
import api from '../api/axios';
import { getOfflineOrders } from '../utils/offlineStore';

function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_OPTIONS = ['All', 'Pending', 'Ready', 'Delivered', 'Overdue'];

export default function OrderHistory({ onMenuClick }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const location = useLocation();
    const initStatus = new URLSearchParams(location.search).get('status') || 'All';
    const [statusFilter, setStatusFilter] = useState(STATUS_OPTIONS.includes(initStatus) ? initStatus : 'All');
    const [dateFilter, setDateFilter] = useState('');
    const [updatingId, setUpdatingId] = useState(null);
    const [editingAdvanceId, setEditingAdvanceId] = useState(null);
    const [tempAdvanceValue, setTempAdvanceValue] = useState('');

    // Today's date string (YYYY-MM-DD) for overdue comparison
    const todayStr = new Date().toISOString().split('T')[0];

    function fetchOrders() {
        setLoading(true);
        const params = new URLSearchParams();
        // For Overdue, fetch all non-delivered orders then filter client-side
        const apiStatus = statusFilter === 'Overdue' ? null : statusFilter;
        if (apiStatus && apiStatus !== 'All') params.set('status', apiStatus);
        if (dateFilter) params.set('date', dateFilter);
        if (search) params.set('search', search);
        
        Promise.all([
            api.get(`/orders?${params}`).catch(() => ({ data: [] })), 
            getOfflineOrders().catch(() => [])
        ]).then(([apiRes, offlineOrders]) => {
            let combined = apiRes.data || [];

            if (offlineOrders && offlineOrders.length > 0) {
                let parsedOffline = offlineOrders.map(o => {
                    const p = o.orderPayload;
                    const total = p.services.reduce((s, svc) => s + (parseFloat(svc.price) * parseInt(svc.quantity)), 0);
                    return {
                        order_id: `offline-${o.id}`,
                        customer_id: o.customer_id || `temp-${o.id}`,
                        customer_name: o.customer?.name || 'Unknown',
                        phone_number: o.customer?.phone_number || '',
                        delivery_date: p.delivery_date,
                        total_amount: total,
                        advance_paid: p.advance_paid,
                        balance_amount: total - parseFloat(p.advance_paid),
                        status: 'Pending',
                        isOfflineQueue: true
                    };
                });

                // Apply filters locally to offline items since API missed them
                if (search) {
                    const s = search.toLowerCase();
                    parsedOffline = parsedOffline.filter(o => 
                        o.customer_name?.toLowerCase().includes(s) || 
                        o.phone_number?.includes(s)
                    );
                }
                if (statusFilter !== 'All' && statusFilter !== 'Overdue') {
                    parsedOffline = parsedOffline.filter(o => o.status === statusFilter);
                }
                if (dateFilter) {
                    parsedOffline = parsedOffline.filter(o => o.delivery_date === dateFilter);
                }

                combined = [...parsedOffline, ...combined];
            }

            // Overdue: filter to only non-delivered orders with past delivery date
            if (statusFilter === 'Overdue') {
                combined = combined.filter(o =>
                    o.status !== 'Delivered' && o.delivery_date < todayStr
                );
                // Sort by most overdue first (oldest delivery date first)
                combined.sort((a, b) => new Date(a.delivery_date) - new Date(b.delivery_date));
            } else if (statusFilter === 'Pending' || statusFilter === 'Ready') {
                combined.sort((a, b) => new Date(a.delivery_date) - new Date(b.delivery_date));
            }
            setOrders(combined);
        })
        .finally(() => setLoading(false));
    }

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchOrders();
        }, 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, statusFilter, dateFilter]);

    async function handleStatusChange(orderId, newStatus) {
        // If marking as Delivered and balance is outstanding, ask about payment
        if (newStatus === 'Delivered') {
            const order = orders.find(o => o.order_id === orderId);
            const balance = order ? parseFloat(order.balance_amount) : 0;
            if (balance > 0) {
                const balanceCleared = window.confirm(
                    `Balance of ₹${balance.toLocaleString('en-IN')} is still pending. Has the customer cleared the full payment?`
                );
                
                // If they click cancel, abort the status change entirely
                if (!balanceCleared) {
                    return;
                }

                setUpdatingId(orderId);
                try {
                    await api.put(`/orders/${orderId}/status`, { status: newStatus });
                    await api.put(`/orders/${orderId}`, {
                        advance_paid: order.total_amount,
                        services: order.services
                    });
                    const updated = orders.map(o => {
                        if (o.order_id === orderId) {
                            return {
                                ...o,
                                status: newStatus,
                                advance_paid: order.total_amount,
                                balance_amount: 0
                            };
                        }
                        return o;
                    });
                    setOrders(updated);
                } catch (err) {
                    console.error('Status update failed:', err);
                } finally {
                    setUpdatingId(null);
                }
                return;
            }
        }

        setUpdatingId(orderId);
        try {
            await api.put(`/orders/${orderId}/status`, { status: newStatus });
            const updated = orders.map(o => {
                if (o.order_id === orderId) {
                    return { ...o, status: newStatus };
                }
                return o;
            });
            setOrders(updated);

            // Trigger WhatsApp if status becomes 'Ready'
            if (newStatus === 'Ready') {
                const targetOrder = updated.find(o => o.order_id === orderId);
                if (targetOrder) {
                    handleWhatsAppReady(targetOrder);
                }
            }
        } catch (err) {
            console.error('Status update failed:', err);
        } finally {
            setUpdatingId(null);
        }
    }

    async function handleAdvanceUpdate(orderId) {
        const val = parseFloat(tempAdvanceValue) || 0;
        if (!window.confirm(`Are you sure you want to update the advance to \u20b9${val.toLocaleString('en-IN')}?`)) {
            return;
        }
        setUpdatingId(orderId);
        try {
            const r = await api.put(`/orders/${orderId}/advance`, { advance_paid: val });
            setOrders(prev => prev.map(o => o.order_id === orderId ? { ...o, advance_paid: val, balance_amount: r.data.balance_amount } : o));
            setEditingAdvanceId(null);
        } catch (err) {
            console.error(err);
            alert('Failed to update advance');
        } finally {
            setUpdatingId(null);
        }
    }

    async function handleDelete(orderId) {
        if (!window.confirm("Are you sure you want to delete this order?")) return;
        
        const pwd = window.prompt("Enter the Password :");
        if (pwd !== "LataMagaji") {
            alert("Incorrect password. Deletion aborted.");
            return;
        }

        setUpdatingId(orderId);
        try {
            await api.delete(`/orders/${orderId}`);
            setOrders(prev => prev.filter(o => o.order_id !== orderId));
            alert("Order deleted successfully.");
        } catch (err) {
            console.error(err);
            alert("Failed to delete order.");
        } finally {
            setUpdatingId(null);
        }
    }

    const filtered = orders;

    const handleWhatsAppReady = (order) => {
        let phoneForUrl = order.phone_number.replace(/\D/g, '');
        if (phoneForUrl.length === 10) {
            phoneForUrl = '91' + phoneForUrl;
        }

        const msg = encodeURIComponent(
            `Dear ${order.customer_name},\n\n` +
            `Your blouse is ready to collect!\n\n` +
            `Order No: #${String(order.order_number || order.order_id).padStart(4, '0')}\n` +
            `Balance Amount: ₹${order.balance_amount.toLocaleString('en-IN')}\n\n` +
            `Please visit us soon.`
        );
        window.open(`https://wa.me/${phoneForUrl}?text=${msg}`, '_blank');
    };

    const handleWhatsAppReview = (order) => {
        let phoneForUrl = order.phone_number.replace(/\D/g, '');
        if (phoneForUrl.length === 10) {
            phoneForUrl = '91' + phoneForUrl;
        }

        const msg = encodeURIComponent(
            `Dear ${order.customer_name},\n\n` +
            `Thank you for choosing us! We hope you are satisfied with our stitching.\n\n` +
            `We would love to hear your feedback. Your review helps us improve and also supports our small business.\n\n` +
            `If you have a moment, please leave us a review on Google:\n` +
            `https://g.co/kgs/LUPXvNh\n\n` +
            `Thank you for your support!`
        );
        window.open(`https://wa.me/${phoneForUrl}?text=${msg}`, '_blank');
    };

    return (
        <div>
            <div className="topbar flex-between">
                <div className="flex">
                    <button className="mobile-menu-btn" onClick={onMenuClick}>
                        <Menu size={22} />
                    </button>
                    <div>
                        <div className="topbar-title">Order History</div>
                        <div className="topbar-subtitle">{filtered.length} order(s) found</div>
                    </div>
                </div>
                <div className="flex gap-8" style={{ flexWrap: 'nowrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <button className="btn btn-ghost btn-sm" onClick={fetchOrders} style={{ flexShrink: 0, padding: '4px 8px' }}>
                        <RefreshCw size={14} /> <span className="hide-mobile" style={{ fontSize: '11px' }}>Refresh</span>
                    </button>
                </div>
            </div>

            <div className="page-container">
                {/* Filters */}
                <div className="card mb-24">
                    <div className="card-body" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div style={{ flex: '2 1 240px' }}>
                            <label className="form-label"><Search size={14} style={{ marginRight: 6 }} />Search Customer</label>
                            <input
                                className="form-input"
                                placeholder="Enter name or phone..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && fetchOrders()}
                            />
                        </div>
                        <div style={{ flex: '1 1 150px' }}>
                            <label className="form-label"><Filter size={14} style={{ marginRight: 6 }} />Status</label>
                            <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                                {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                        <div style={{ flex: '1 1 180px' }}>
                            <label className="form-label">Delivery Date</label>
                            <input
                                className="form-input"
                                type="date"
                                value={dateFilter}
                                onChange={e => setDateFilter(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-8">
                            <button className="btn btn-primary" onClick={fetchOrders}>Apply Filters</button>
                            <button className="btn btn-ghost" onClick={() => { setSearch(''); setStatusFilter('All'); setDateFilter(''); }}>Reset</button>
                        </div>
                    </div>
                </div>

                {/* Status filter tabs */}
                <div className="flex gap-8 mb-16" style={{ flexWrap: 'wrap' }}>
                    {STATUS_OPTIONS.map(s => {
                        const isOverdue = s === 'Overdue';
                        // Count overdue orders from current loaded data (only when not already on overdue tab)
                        const overdueCount = isOverdue
                            ? orders.filter(o => o.status !== 'Delivered' && o.delivery_date < todayStr).length
                            : 0;
                        return (
                            <button
                                key={s}
                                className={`btn btn-sm ${statusFilter === s
                                    ? isOverdue ? '' : 'btn-maroon'
                                    : 'btn-ghost'
                                }`}
                                onClick={() => setStatusFilter(s)}
                                style={isOverdue ? {
                                    background: statusFilter === s ? '#B71C1C' : '#FFF0F0',
                                    color: statusFilter === s ? '#fff' : '#B71C1C',
                                    border: '1.5px solid #ef9a9a',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5
                                } : {}}
                            >
                                {isOverdue && <AlertTriangle size={13} />}
                                {s}
                                {isOverdue && overdueCount > 0 && (
                                    <span style={{
                                        background: statusFilter === s ? 'rgba(255,255,255,0.3)' : '#B71C1C',
                                        color: '#fff',
                                        borderRadius: 10,
                                        padding: '1px 7px',
                                        fontSize: 11,
                                        fontWeight: 800,
                                        marginLeft: 2,
                                        lineHeight: 1.5
                                    }}>
                                        {overdueCount}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="card">
                    {loading ? (
                        <div className="card-body">
                            <div className="spinner" />
                        </div>
                    ) : (
                        <div className="card-body" style={{ padding: 0 }}>
                            {/* Card View */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, padding: 16 }}>
                                    {filtered.length === 0 && (
                                        <div className="empty-state" style={{ gridColumn: '1 / -1' }}>No orders found</div>
                                    )}
                                    {filtered.map(o => {
                                        const isOverdue = o.status !== 'Delivered' && o.delivery_date < todayStr;
                                        return (
                                            <div key={o.order_id} className="order-card card p-16" style={{
                                                borderLeft: `4px solid ${isOverdue ? '#B71C1C' : 'var(--maroon)'}`,
                                                background: '#fff'
                                            }}>
                                                <div className="order-card-header flex-between pb-8 mb-12" style={{ borderBottom: '1px solid var(--gray-light)' }}>
                                                    <div className="flex gap-6 items-center">
                                                        <span className="order-card-id" style={{ fontSize: 15, fontWeight: 700, color: 'var(--maroon)' }}>
                                                            #{String(o.order_number || o.order_id).padStart(4, '0')}
                                                        </span>
                                                        {o.isOfflineQueue && (
                                                            <span className="badge badge-warning" style={{ fontSize: 10 }}>Pending Sync</span>
                                                        )}
                                                        {isOverdue && (
                                                            <span className="badge badge-overdue" style={{ fontSize: 10 }}>Overdue</span>
                                                        )}
                                                    </div>
                                                    <select
                                                        className="form-select"
                                                        style={{ padding: '4px 8px', fontSize: 12, width: 110, fontWeight: 600 }}
                                                        value={o.status}
                                                        disabled={updatingId === o.order_id}
                                                        onChange={e => handleStatusChange(o.order_id, e.target.value)}
                                                    >
                                                        <option>Pending</option>
                                                        <option>Ready</option>
                                                        <option>Delivered</option>
                                                    </select>
                                                </div>

                                                <div className="order-card-body">
                                                    <div className="order-card-item" style={{ gridColumn: 'span 2', marginBottom: 6 }}>
                                                        <span className="order-card-label">Customer Name</span>
                                                        <Link to={`/customer/${o.customer_id}`} state={{ from: location.pathname + location.search }} style={{ textDecoration: 'none', color: 'inherit' }}>
                                                            <span className="order-card-value" style={{ fontSize: 16, fontWeight: 700, color: 'var(--maroon-dark)' }}>
                                                                {o.customer_name}
                                                            </span>
                                                        </Link>
                                                    </div>

                                                    <div className="order-card-item">
                                                        <span className="order-card-label">Phone Number</span>
                                                        <span className="order-card-value" style={{ fontWeight: 600 }}>{o.phone_number}</span>
                                                    </div>

                                                    <div className="order-card-item">
                                                        <span className="order-card-label">Delivery Date</span>
                                                        <span className="order-card-value" style={{ color: isOverdue ? '#B71C1C' : 'inherit', fontWeight: 700 }}>
                                                            {formatDate(o.delivery_date)}
                                                        </span>
                                                    </div>

                                                    <div className="order-card-item">
                                                        <span className="order-card-label">Total Amount</span>
                                                        <span className="order-card-value" style={{ fontWeight: 700, fontSize: 15 }}>
                                                            &#8377;{parseFloat(o.total_amount).toLocaleString('en-IN')}
                                                        </span>
                                                    </div>

                                                    <div className="order-card-item">
                                                        <span className="order-card-label">Advance Paid</span>
                                                        <span className="order-card-value" style={{ color: '#2E7D32', fontWeight: 600 }}>
                                                            {editingAdvanceId === o.order_id ? (
                                                                <div className="flex gap-4 items-center mt-2">
                                                                    <input
                                                                        type="number"
                                                                        className="form-input"
                                                                        style={{ width: 75, padding: '2px 6px', fontSize: 12, height: 26 }}
                                                                        value={tempAdvanceValue}
                                                                        onChange={e => setTempAdvanceValue(e.target.value)}
                                                                        onKeyDown={e => e.key === 'Enter' && handleAdvanceUpdate(o.order_id)}
                                                                        autoFocus
                                                                    />
                                                                    <button className="btn btn-sm btn-primary p-4" style={{ minHeight: 'auto' }} onClick={() => handleAdvanceUpdate(o.order_id)}>
                                                                        <Check size={12} />
                                                                    </button>
                                                                    <button className="btn btn-sm btn-ghost p-4" style={{ minHeight: 'auto' }} onClick={() => setEditingAdvanceId(null)}>
                                                                        <X size={12} />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex gap-4 items-center">
                                                                    <span>&#8377;{parseFloat(o.advance_paid).toLocaleString('en-IN')}</span>
                                                                    {!o.isOfflineQueue && (
                                                                        <button
                                                                            className="btn btn-sm btn-ghost p-0"
                                                                            style={{ border: 'none', background: 'transparent' }}
                                                                            onClick={() => { setEditingAdvanceId(o.order_id); setTempAdvanceValue(o.advance_paid); }}
                                                                            title="Edit Advance"
                                                                        >
                                                                            <Edit2 size={12} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </span>
                                                    </div>

                                                    <div className="order-card-item" style={{ gridColumn: 'span 2', background: 'var(--ivory)', padding: '8px 12px', borderRadius: 8, marginTop: 4 }}>
                                                        <div className="flex-between">
                                                            <span className="order-card-label" style={{ margin: 0 }}>Balance Pending</span>
                                                            <span className="order-card-value" style={{ color: parseFloat(o.balance_amount) > 0 ? '#B71C1C' : '#2E7D32', fontWeight: 800, fontSize: 15 }}>
                                                                &#8377;{parseFloat(o.balance_amount).toLocaleString('en-IN')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="order-card-actions flex gap-6 flex-wrap justify-end pt-12 mt-12" style={{ borderTop: '1px solid var(--gray-light)' }}>
                                                    <Link to={`/customer/${o.customer_id}`} state={{ from: location.pathname + location.search }} className="btn btn-sm btn-outline">
                                                        <User size={13} /> Measurements
                                                    </Link>
                                                    <Link to={`/bill/${o.order_id}`} className="btn btn-sm btn-outline">
                                                        <Eye size={13} /> Bill
                                                    </Link>
                                                    {!o.isOfflineQueue && (
                                                        <Link
                                                            to={`/edit-order/${o.order_id}`}
                                                            className="btn btn-sm btn-outline"
                                                            style={{ borderColor: 'var(--maroon)', color: 'var(--maroon)', fontWeight: 600 }}
                                                        >
                                                            <Edit2 size={13} /> Edit Bill
                                                        </Link>
                                                    )}
                                                    {!o.isOfflineQueue && o.status === 'Delivered' && (
                                                        <button
                                                            className="btn btn-sm btn-outline"
                                                            style={{ borderColor: '#2E7D32', color: '#2E7D32' }}
                                                            onClick={() => handleWhatsAppReview(o)}
                                                        >
                                                            Review
                                                        </button>
                                                    )}
                                                    {!o.isOfflineQueue && (
                                                        <button
                                                            className="btn btn-sm btn-danger"
                                                            title="Delete Order"
                                                            onClick={() => handleDelete(o.order_id)}
                                                            disabled={updatingId === o.order_id}
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
