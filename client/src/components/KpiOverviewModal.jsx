import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    X, Search, Clock, Package, CheckCircle, AlertTriangle,
    Users, Eye, DollarSign, ArrowRight, Filter, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

function StatusBadge({ status }) {
    const cls = {
        Pending: 'badge badge-pending',
        Ready: 'badge badge-ready',
        Delivered: 'badge badge-delivered',
    }[status] || 'badge';
    return <span className={cls}>{status}</span>;
}

export default function KpiOverviewModal({ isOpen, onClose, categoryKey, allOrders = [], onStatusUpdate }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [updatingOrderId, setUpdatingOrderId] = useState(null);

    if (!isOpen || !categoryKey) return null;

    const todayStr = new Date().toISOString().slice(0, 10);
    const tomorrowObj = new Date();
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrowStr = tomorrowObj.toISOString().slice(0, 10);

    let config = {
        title: 'KPI Category Overview',
        icon: Package,
        color: 'var(--maroon)',
        bgColor: 'rgba(106,30,46,0.1)',
        filterFn: () => true,
    };

    if (categoryKey === 'dueToday') {
        config = {
            title: 'Due Today Orders Overview',
            icon: Clock,
            color: '#C6A75E',
            bgColor: 'rgba(198,167,94,0.12)',
            filterFn: o => o.delivery_date && o.delivery_date.slice(0, 10) === todayStr && o.status !== 'Delivered',
        };
    } else if (categoryKey === 'pending') {
        config = {
            title: 'Pending Orders Overview',
            icon: Package,
            color: '#6A1E2E',
            bgColor: 'rgba(106,30,46,0.12)',
            filterFn: o => o.status === 'Pending',
        };
    } else if (categoryKey === 'ready') {
        config = {
            title: 'Ready for Pickup Overview',
            icon: CheckCircle,
            color: '#2E7D32',
            bgColor: 'rgba(46,125,50,0.12)',
            filterFn: o => o.status === 'Ready',
        };
    } else if (categoryKey === 'dueTomorrow') {
        config = {
            title: 'Due Tomorrow Orders Overview',
            icon: AlertTriangle,
            color: '#1565C0',
            bgColor: 'rgba(21,101,192,0.12)',
            filterFn: o => o.delivery_date && o.delivery_date.slice(0, 10) === tomorrowStr && o.status !== 'Delivered',
        };
    } else if (categoryKey === 'overdue') {
        config = {
            title: 'Overdue Orders Overview',
            icon: AlertTriangle,
            color: '#E65100',
            bgColor: 'rgba(230,81,0,0.12)',
            filterFn: o => {
                if (!o.delivery_date || o.status === 'Delivered') return false;
                const dStr = o.delivery_date.slice(0, 10);
                return dStr < todayStr;
            },
        };
    }

    const IconComp = config.icon;

    // Filter orders by category & search
    const categoryOrders = allOrders.filter(config.filterFn);
    const filteredOrders = categoryOrders.filter(o => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (
            (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
            (o.phone_number && o.phone_number.includes(q)) ||
            (String(o.order_number || o.order_id).includes(q))
        );
    });

    // Aggregates
    const totalCount = categoryOrders.length;
    const totalValue = categoryOrders.reduce((acc, o) => acc + (parseFloat(o.total_amount) || 0), 0);
    const totalBalance = categoryOrders.reduce((acc, o) => acc + (parseFloat(o.balance_amount) || 0), 0);

    const handleQuickStatusChange = (orderId, newStatus) => {
        setUpdatingOrderId(orderId);
        api.put(`/orders/${orderId}/status`, { status: newStatus })
            .then(() => {
                toast.success(`Order #${orderId} marked as ${newStatus}!`);
                if (onStatusUpdate) onStatusUpdate();
            })
            .catch(err => {
                toast.error(err.response?.data?.error || 'Failed to update order status');
            })
            .finally(() => setUpdatingOrderId(null));
    };

    return (
        <div className="modal-backdrop" onClick={onClose} style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 16
        }}>
            <div className="modal-content card" onClick={e => e.stopPropagation()} style={{
                maxWidth: 840, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                animation: 'modalSlideIn 0.25s ease-out'
            }}>
                {/* Modal Header */}
                <div className="card-header flex-between" style={{
                    background: 'linear-gradient(135deg, var(--maroon-dark) 0%, #2A0913 100%)',
                    color: '#fff', padding: '16px 20px'
                }}>
                    <div className="flex gap-10 items-center">
                        <div style={{
                            width: 36, height: 36, borderRadius: 10,
                            background: config.bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <IconComp size={20} color={config.color} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: 18, margin: 0, color: '#F5F0E8', fontFamily: 'var(--font-serif)' }}>{config.title}</h3>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                                Detailed overview & quick management
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost p-4" style={{ color: '#fff', borderRadius: '50%' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="card-body p-20" style={{ overflowY: 'auto', flex: 1, background: 'var(--ivory)' }}>
                    {/* Summary Cards */}
                    <div className="grid-3 gap-12 mb-16" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                        <div className="stat-card p-12" style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--gray-light)' }}>
                            <div style={{ fontSize: 11, color: 'var(--gray)', fontWeight: 600 }}>TOTAL ORDERS</div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: config.color, marginTop: 4 }}>
                                {totalCount} <span style={{ fontSize: 12, color: 'var(--gray-muted)', fontWeight: 500 }}>orders</span>
                            </div>
                        </div>
                        <div className="stat-card p-12" style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--gray-light)' }}>
                            <div style={{ fontSize: 11, color: 'var(--gray)', fontWeight: 600 }}>TOTAL CATEGORY VALUE</div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--maroon-dark)', marginTop: 4 }}>
                                &#8377;{totalValue.toLocaleString('en-IN')}
                            </div>
                        </div>
                        <div className="stat-card p-12" style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--gray-light)' }}>
                            <div style={{ fontSize: 11, color: 'var(--gray)', fontWeight: 600 }}>PENDING BALANCE TO COLLECT</div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: totalBalance > 0 ? '#B71C1C' : '#2E7D32', marginTop: 4 }}>
                                &#8377;{totalBalance.toLocaleString('en-IN')}
                            </div>
                        </div>
                    </div>

                    {/* Search filter bar */}
                    <div className="flex-between mb-16 gap-12 flex-wrap">
                        <div className="search-bar" style={{ flex: 1, minWidth: 220, position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray)' }} />
                            <input
                                type="text"
                                placeholder="Search customer name, phone, or order #..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{
                                    width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                                    borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-light)', fontSize: 13
                                }}
                            />
                        </div>
                    </div>

                    {/* Orders Card View */}
                    {filteredOrders.length === 0 ? (
                        <div className="empty-state" style={{ padding: '36px 16px', background: '#fff', borderRadius: 12 }}>
                            <Package size={32} style={{ opacity: 0.3, margin: '0 auto 8px', display: 'block' }} />
                            <p style={{ fontSize: 14, fontWeight: 500 }}>No orders found in this overview category</p>
                        </div>
                    ) : (
                        <div className="kpi-orders-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                            {filteredOrders.map(o => {
                                const isOverdue = o.delivery_date && o.status !== 'Delivered' && o.delivery_date.slice(0, 10) < todayStr;
                                return (
                                    <div key={o.order_id} className="order-kpi-card" style={{
                                        background: '#fff',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--gray-light)',
                                        padding: 14,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                                        transition: 'all 0.2s ease',
                                        borderLeft: `4px solid ${isOverdue ? '#E65100' : config.color}`
                                    }}>
                                        <div>
                                            {/* Top Bar of Card */}
                                            <div className="flex-between mb-8" style={{ alignItems: 'flex-start' }}>
                                                <div>
                                                    <span style={{ fontWeight: 700, color: 'var(--maroon)', fontSize: 14 }}>
                                                        #{String(o.order_number || o.order_id).padStart(4, '0')}
                                                    </span>
                                                    <Link
                                                        to={`/customer/${o.customer_id}`}
                                                        state={{ from: '/' }}
                                                        onClick={onClose}
                                                        style={{ textDecoration: 'none', color: 'var(--charcoal)', fontWeight: 700, fontSize: 15, display: 'block', marginTop: 2 }}
                                                    >
                                                        {o.customer_name}
                                                    </Link>
                                                </div>
                                                <StatusBadge status={o.status} />
                                            </div>

                                            {/* Order info details */}
                                            <div className="grid-2 gap-8 mb-12" style={{ background: 'var(--ivory)', padding: 10, borderRadius: 8, fontSize: 12 }}>
                                                <div>
                                                    <div style={{ color: 'var(--gray)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>Phone</div>
                                                    <div style={{ fontWeight: 600, color: 'var(--charcoal-soft)' }}>{o.phone_number || '—'}</div>
                                                </div>
                                                <div>
                                                    <div style={{ color: 'var(--gray)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>Delivery Date</div>
                                                    <div style={{ fontWeight: 700, color: isOverdue ? '#B71C1C' : 'var(--maroon-dark)' }}>
                                                        {o.delivery_date ? new Date(o.delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div style={{ color: 'var(--gray)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>Total Amount</div>
                                                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--maroon-dark)' }}>
                                                        &#8377;{parseFloat(o.total_amount).toLocaleString('en-IN')}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div style={{ color: 'var(--gray)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>Balance</div>
                                                    <div style={{ fontWeight: 700, fontSize: 14, color: parseFloat(o.balance_amount) > 0 ? '#B71C1C' : '#2E7D32' }}>
                                                        &#8377;{parseFloat(o.balance_amount || 0).toLocaleString('en-IN')}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card Actions */}
                                        <div className="flex-between pt-8" style={{ borderTop: '1px solid var(--gray-light)', gap: 8, flexWrap: 'wrap' }}>
                                            <div className="flex gap-6">
                                                {o.status === 'Pending' && (
                                                    <button
                                                        onClick={() => handleQuickStatusChange(o.order_id, 'Ready')}
                                                        disabled={updatingOrderId === o.order_id}
                                                        className="btn btn-sm btn-success"
                                                        style={{ fontSize: 11, padding: '4px 10px' }}
                                                    >
                                                        <Check size={13} /> Mark Ready
                                                    </button>
                                                )}
                                                {o.status === 'Ready' && (
                                                    <button
                                                        onClick={() => handleQuickStatusChange(o.order_id, 'Delivered')}
                                                        disabled={updatingOrderId === o.order_id}
                                                        className="btn btn-sm btn-maroon"
                                                        style={{ fontSize: 11, padding: '4px 10px' }}
                                                    >
                                                        <Check size={13} /> Deliver
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex gap-6" style={{ marginLeft: 'auto' }}>
                                                <Link to={`/customer/${o.customer_id}`} state={{ from: '/' }} onClick={onClose} className="btn btn-sm btn-ghost p-6" title="View Measurements">
                                                    <Users size={14} />
                                                </Link>
                                                <Link to={`/bill/${o.order_id}`} onClick={onClose} className="btn btn-sm btn-outline" style={{ padding: '4px 8px', fontSize: 11 }}>
                                                    <Eye size={12} /> Bill
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Modal Footer (No bottom-right close button as requested) */}
                <div className="card-footer p-16 flex-between" style={{ background: '#fff', borderTop: '1px solid var(--gray-light)' }}>
                    <div style={{ fontSize: 12, color: 'var(--gray)', fontWeight: 500 }}>
                        Showing {filteredOrders.length} of {totalCount} orders
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes modalSlideIn {
                    from { opacity: 0; transform: translateY(12px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
}

