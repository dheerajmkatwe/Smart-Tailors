import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DollarSign, Menu, Eye, Edit2, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

export default function Profits({ onMenuClick }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState('');

    const fetchOrders = () => {
        api.get('/orders')
            .then(res => setOrders(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    const handleSaveExpense = async (orderId) => {
        try {
            await api.put(`/orders/${orderId}/expense`, { stitching_expense: parseFloat(editValue) || 0 });
            toast.success('Expense updated');
            setEditingId(null);
            fetchOrders();
        } catch (err) {
            toast.error('Failed to update expense');
        }
    };

    if (loading) return (
        <div>
            <div className="topbar">
                <div className="flex">
                    <button className="mobile-menu-btn" onClick={onMenuClick}>
                        <Menu size={22} />
                    </button>
                    <div>
                        <div className="topbar-title">Profits</div>
                        <div className="topbar-subtitle">Loading data...</div>
                    </div>
                </div>
            </div>
            <div className="page-container"><div className="spinner" /></div>
        </div>
    );

    // Calculate total sums for the footer
    const totals = orders.reduce((acc, o) => {
        const totalAmount = parseFloat(o.total_amount) || 0;
        const stitchingEx = parseFloat(o.stitching_expense) || 0;
        acc.totalPrice += totalAmount;
        acc.totalExpense += stitchingEx;
        acc.totalProfit += (totalAmount - stitchingEx);
        return acc;
    }, { totalPrice: 0, totalExpense: 0, totalProfit: 0 });

    return (
        <div>
            <div className="topbar">
                <div className="flex">
                    <button className="mobile-menu-btn" onClick={onMenuClick}>
                        <Menu size={22} />
                    </button>
                    <div>
                        <div className="topbar-title">Profits Details</div>
                        <div className="topbar-subtitle">Breakdown of orders vs expenses</div>
                    </div>
                </div>
            </div>

            <div className="page-container">
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title flex gap-8"><DollarSign size={18} color="var(--gold)" /> Order Profit Table</h3>
                    </div>
                    <>
                        <div className="table-container hide-on-mobile" style={{ border: 'none' }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Order ID</th>
                                        <th>Customer Name</th>
                                        <th>Total Price (₹)</th>
                                        <th>Stitching Expense (₹)</th>
                                        <th>Total Profit (₹)</th>
                                        <th>Bill</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--gray)' }}>No orders found</td>
                                        </tr>
                                    ) : (
                                        orders.map(o => {
                                            const totalPrice = parseFloat(o.total_amount) || 0;
                                            const expense = parseFloat(o.stitching_expense) || 0;
                                            const profit = totalPrice - expense;

                                            return (
                                                <tr key={o.order_id}>
                                                    <td><span style={{ fontWeight: 600, color: 'var(--maroon)' }}>#{String(o.order_number || o.order_id).padStart(4, '0')}</span></td>
                                                    <td>
                                                        <Link to={`/customer/${o.customer_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                                            <strong>{o.customer_name}</strong>
                                                        </Link>
                                                    </td>
                                                    <td>₹{totalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                                    <td>
                                                        {editingId === o.order_id ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                <div className="input-prefix" style={{ width: 100, padding: 0 }}>
                                                                    <span className="prefix-symbol" style={{ padding: '4px 8px' }}>₹</span>
                                                                    <input
                                                                        type="number"
                                                                        className="form-input"
                                                                        value={editValue}
                                                                        onChange={e => setEditValue(e.target.value)}
                                                                        style={{ padding: '4px', border: 'none', height: 30 }}
                                                                        autoFocus
                                                                    />
                                                                </div>
                                                                <button className="btn btn-sm btn-ghost" style={{ padding: 4, color: '#2E7D32' }} onClick={() => handleSaveExpense(o.order_id)}>
                                                                    <Check size={16} />
                                                                </button>
                                                                <button className="btn btn-sm btn-ghost" style={{ padding: 4, color: '#D32F2F' }} onClick={() => setEditingId(null)}>
                                                                    <X size={16} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#E65100' }}>
                                                                <span>₹{expense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                                <button className="btn btn-ghost" style={{ padding: 4 }} onClick={() => {
                                                                    setEditingId(o.order_id);
                                                                    setEditValue(expense);
                                                                }}>
                                                                    <Edit2 size={12} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ color: profit >= 0 ? '#2E7D32' : '#D32F2F', fontWeight: 600 }}>
                                                        ₹{profit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td>
                                                        <Link to={`/bill/${o.order_id}`} className="btn btn-sm btn-outline">
                                                            <Eye size={12} /> View
                                                        </Link>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                                {orders.length > 0 && (
                                    <tfoot>
                                        <tr style={{ background: '#f5f5f5', fontWeight: 700 }}>
                                            <td colSpan={2} style={{ textAlign: 'right' }}>Total:</td>
                                            <td>₹{totals.totalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td style={{ color: '#E65100' }}>₹{totals.totalExpense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td style={{ color: totals.totalProfit >= 0 ? '#2E7D32' : '#D32F2F' }}>
                                                ₹{totals.totalProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        <div className="mobile-cards show-on-mobile" style={{ padding: '12px' }}>
                            {orders.length > 0 && (
                                <div className="profits-kpi-grid" style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: 10,
                                    marginBottom: 14
                                }}>
                                    <div style={{
                                        background: 'var(--ivory-dark)',
                                        padding: '10px 12px',
                                        borderRadius: 10,
                                        border: '1px solid var(--gray-light)',
                                        minWidth: 0
                                    }}>
                                        <span style={{ fontSize: 10, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, display: 'block', marginBottom: 3 }}>Total Price</span>
                                        <strong style={{ display: 'block', fontSize: 15, color: 'var(--maroon)', wordBreak: 'break-all' }}>₹{totals.totalPrice.toLocaleString('en-IN')}</strong>
                                    </div>
                                    <div style={{
                                        background: 'var(--ivory-dark)',
                                        padding: '10px 12px',
                                        borderRadius: 10,
                                        border: '1px solid var(--gray-light)',
                                        minWidth: 0
                                    }}>
                                        <span style={{ fontSize: 10, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, display: 'block', marginBottom: 3 }}>Total Expenses</span>
                                        <strong style={{ display: 'block', fontSize: 15, color: '#E65100', wordBreak: 'break-all' }}>₹{totals.totalExpense.toLocaleString('en-IN')}</strong>
                                    </div>
                                    <div style={{
                                        background: 'linear-gradient(135deg, var(--ivory-dark), #f0ebe3)',
                                        padding: '12px 16px',
                                        borderRadius: 10,
                                        border: '1px solid var(--gray-light)',
                                        gridColumn: 'span 2',
                                        textAlign: 'center'
                                    }}>
                                        <span style={{ fontSize: 10, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, display: 'block', marginBottom: 3 }}>Net Profit</span>
                                        <strong style={{ display: 'block', fontSize: 20, color: totals.totalProfit >= 0 ? '#2E7D32' : '#D32F2F' }}>
                                            ₹{totals.totalProfit.toLocaleString('en-IN')}
                                        </strong>
                                    </div>
                                </div>
                            )}

                            {orders.length === 0 ? (
                                <div className="empty-state">No orders found</div>
                            ) : (
                                orders.map(o => {
                                    const totalPrice = parseFloat(o.total_amount) || 0;
                                    const expense = parseFloat(o.stitching_expense) || 0;
                                    const profit = totalPrice - expense;

                                    return (
                                        <div key={o.order_id} style={{
                                            background: 'var(--white)',
                                            border: '1px solid rgba(229,231,235,0.9)',
                                            borderRadius: 12,
                                            padding: '14px',
                                            boxShadow: '0 1px 4px rgba(26,10,16,0.06)',
                                            marginBottom: 2
                                        }}>
                                            {/* Card Header */}
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginBottom: 12,
                                                paddingBottom: 10,
                                                borderBottom: '1px solid var(--gray-light)'
                                            }}>
                                                <div style={{ fontWeight: 700, color: 'var(--maroon)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)', display: 'inline-block', flexShrink: 0 }} />
                                                    #{String(o.order_number || o.order_id).padStart(4, '0')}
                                                </div>
                                                <Link to={`/bill/${o.order_id}`} className="btn btn-sm btn-outline" style={{ flexShrink: 0 }}>
                                                    <Eye size={12} /> View Bill
                                                </Link>
                                            </div>

                                            {/* Card Body: responsive 2-col grid */}
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr 1fr',
                                                gap: '10px 12px'
                                            }}>
                                                {/* Customer — spans full width */}
                                                <div style={{ gridColumn: 'span 2' }}>
                                                    <span style={{ fontSize: 10, color: 'var(--gray-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, display: 'block', marginBottom: 2 }}>Customer</span>
                                                    <Link to={`/customer/${o.customer_id}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', textDecoration: 'none', wordBreak: 'break-word' }}>
                                                        {o.customer_name}
                                                    </Link>
                                                </div>

                                                {/* Total Price */}
                                                <div>
                                                    <span style={{ fontSize: 10, color: 'var(--gray-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, display: 'block', marginBottom: 2 }}>Total Price</span>
                                                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--charcoal)', wordBreak: 'break-all' }}>₹{totalPrice.toLocaleString('en-IN')}</span>
                                                </div>

                                                {/* Net Profit */}
                                                <div>
                                                    <span style={{ fontSize: 10, color: 'var(--gray-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, display: 'block', marginBottom: 2 }}>Net Profit</span>
                                                    <span style={{ fontSize: 13, fontWeight: 700, color: profit >= 0 ? '#2E7D32' : '#D32F2F', wordBreak: 'break-all' }}>
                                                        ₹{profit.toLocaleString('en-IN')}
                                                    </span>
                                                </div>

                                                {/* Expense — spans full width to give edit input room */}
                                                <div style={{ gridColumn: 'span 2' }}>
                                                    <span style={{ fontSize: 10, color: 'var(--gray-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, display: 'block', marginBottom: 2 }}>Expense</span>
                                                    {editingId === o.order_id ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                                                            <div className="input-prefix" style={{ flex: 1, padding: 0, minWidth: 0 }}>
                                                                <span className="prefix-symbol" style={{ padding: '6px 10px', fontSize: 13 }}>₹</span>
                                                                <input
                                                                    type="number"
                                                                    className="form-input"
                                                                    value={editValue}
                                                                    onChange={e => setEditValue(e.target.value)}
                                                                    style={{ padding: '6px 8px', border: 'none', height: 36, minWidth: 0 }}
                                                                    autoFocus
                                                                />
                                                            </div>
                                                            <button className="btn btn-sm btn-ghost" style={{ padding: '6px 8px', color: '#2E7D32', flexShrink: 0 }} onClick={() => handleSaveExpense(o.order_id)}>
                                                                <Check size={16} />
                                                            </button>
                                                            <button className="btn btn-sm btn-ghost" style={{ padding: '6px 8px', color: '#D32F2F', flexShrink: 0 }} onClick={() => setEditingId(null)}>
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#E65100' }}>
                                                            <span style={{ fontSize: 13, fontWeight: 500 }}>₹{expense.toLocaleString('en-IN')}</span>
                                                            <button className="btn btn-ghost" style={{ padding: '3px 6px', minWidth: 28, minHeight: 28 }} onClick={() => {
                                                                setEditingId(o.order_id);
                                                                setEditValue(expense);
                                                            }}>
                                                                <Edit2 size={13} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </>
                </div>
            </div>
        </div>
    );
}
