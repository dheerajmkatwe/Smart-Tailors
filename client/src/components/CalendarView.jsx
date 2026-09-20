import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ChevronLeft, ChevronRight, Calendar as CalendarIcon,
    Clock, CheckCircle, AlertTriangle, Users, Eye, Plus, Package,
    ShoppingBag, DollarSign, ArrowRight, Check, Edit2, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

function formatDateISO(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function StatusBadge({ status }) {
    const cls = {
        Pending: 'badge badge-pending',
        Ready: 'badge badge-ready',
        Delivered: 'badge badge-delivered',
    }[status] || 'badge';
    return <span className={cls}>{status}</span>;
}

export default function CalendarView({ orders = [], onDateSelect, onStatusUpdate }) {
    const todayObj = new Date();
    const todayStr = formatDateISO(todayObj);

    const [currentMonth, setCurrentMonth] = useState(new Date(todayObj.getFullYear(), todayObj.getMonth(), 1));
    const [selectedDateStr, setSelectedDateStr] = useState(todayStr);
    const [showModal, setShowModal] = useState(false);
    const [viewMode, setViewMode] = useState('due'); // 'due' or 'booked'
    const [filterStatus, setFilterStatus] = useState('All');
    const [updatingOrderId, setUpdatingOrderId] = useState(null);

    // Month Navigation
    const handlePrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const handleToday = () => {
        const now = new Date();
        setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
        setSelectedDateStr(todayStr);
    };

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const monthName = currentMonth.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    // Days in Month calculation
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    // Map orders by delivery_date and booking_date
    const ordersByDeliveryDate = React.useMemo(() => {
        const map = {};
        orders.forEach(o => {
            if (!o.delivery_date) return;
            const dStr = o.delivery_date.slice(0, 10);
            if (!map[dStr]) map[dStr] = [];
            map[dStr].push(o);
        });
        return map;
    }, [orders]);

    const ordersByBookingDate = React.useMemo(() => {
        const map = {};
        orders.forEach(o => {
            if (!o.booking_date) return;
            const bStr = o.booking_date.slice(0, 10);
            if (!map[bStr]) map[bStr] = [];
            map[bStr].push(o);
        });
        return map;
    }, [orders]);

    // Construct grid days
    const calendarDays = [];

    // 1. Prev month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const dayNum = prevMonthLastDay - i;
        const pDate = new Date(year, month - 1, dayNum);
        calendarDays.push({
            dayNum,
            dateStr: formatDateISO(pDate),
            isCurrentMonth: false,
        });
    }

    // 2. Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
        const cDate = new Date(year, month, d);
        calendarDays.push({
            dayNum: d,
            dateStr: formatDateISO(cDate),
            isCurrentMonth: true,
        });
    }

    // 3. Next month padding days to complete 35 or 42 grid slots
    const remainingSlots = (calendarDays.length % 7 === 0) ? 0 : 7 - (calendarDays.length % 7);
    for (let n = 1; n <= remainingSlots; n++) {
        const nDate = new Date(year, month + 1, n);
        calendarDays.push({
            dayNum: n,
            dateStr: formatDateISO(nDate),
            isCurrentMonth: false,
        });
    }

    // Comprehensive Stats for selected date
    const dueOrdersForSelected = ordersByDeliveryDate[selectedDateStr] || [];
    const bookedOrdersForSelected = ordersByBookingDate[selectedDateStr] || [];

    const pendingCount = dueOrdersForSelected.filter(o => o.status === 'Pending').length;
    const readyCount = dueOrdersForSelected.filter(o => o.status === 'Ready').length;
    const deliveredCount = dueOrdersForSelected.filter(o => o.status === 'Delivered').length;

    const totalBookedAmount = bookedOrdersForSelected.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
    const totalAdvanceCollected = bookedOrdersForSelected.reduce((sum, o) => sum + (parseFloat(o.advance_paid) || 0), 0);

    // Filter active view list
    const activeList = (viewMode === 'due' ? dueOrdersForSelected : bookedOrdersForSelected).filter(o => {
        if (filterStatus === 'All') return true;
        return o.status === filterStatus;
    });

    const totalMonthDeliveries = React.useMemo(() => {
        let count = 0;
        Object.keys(ordersByDeliveryDate).forEach(dStr => {
            const d = new Date(dStr);
            if (d.getFullYear() === year && d.getMonth() === month) {
                count += ordersByDeliveryDate[dStr].length;
            }
        });
        return count;
    }, [ordersByDeliveryDate, year, month]);

    const formattedSelectedDateDisplay = React.useMemo(() => {
        if (!selectedDateStr) return '';
        const parts = selectedDateStr.split('-');
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }, [selectedDateStr]);

    // Handle Status Change directly
    const handleQuickStatusChange = (orderId, newStatus) => {
        setUpdatingOrderId(orderId);
        api.put(`/orders/${orderId}/status`, { status: newStatus })
            .then(() => {
                toast.success(`Order status updated to ${newStatus}!`);
                if (onStatusUpdate) onStatusUpdate();
            })
            .catch(err => {
                toast.error(err.response?.data?.error || 'Failed to update order status');
            })
            .finally(() => setUpdatingOrderId(null));
    };

    return (
        <>
            <div className="card calendar-card mb-24">
            {/* Calendar Header */}
            <div className="card-header calendar-header flex-between" style={{ flexWrap: 'wrap', gap: 12 }}>
                <div className="flex gap-10 items-center">
                    <div style={{
                        width: 38, height: 38, borderRadius: '10px',
                        background: 'rgba(198,167,94,0.14)', color: 'var(--gold-deep)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <CalendarIcon size={20} />
                    </div>
                    <div>
                        <h3 className="card-title" style={{ fontSize: 18, lineHeight: 1.2 }}>Calendar View</h3>
                        <div style={{ fontSize: 12, color: 'var(--gray)', fontWeight: 500 }}>
                            {monthName} &bull; <span style={{ color: 'var(--maroon)', fontWeight: 600 }}>{totalMonthDeliveries} deliveries scheduled</span>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex gap-8 items-center" style={{ flexWrap: 'wrap' }}>
                    <button onClick={handleToday} className="btn btn-sm btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}>
                        Today
                    </button>
                    <div className="flex gap-4 items-center" style={{ background: 'var(--ivory-dark)', borderRadius: 'var(--radius-md)', padding: '2px 4px', border: '1px solid var(--gray-light)' }}>
                        <button onClick={handlePrevMonth} className="btn btn-sm btn-ghost" style={{ padding: '4px 6px', border: 'none' }} title="Previous Month">
                            <ChevronLeft size={16} />
                        </button>
                        <span style={{ fontSize: 13, fontWeight: 700, padding: '0 8px', color: 'var(--maroon-dark)', minWidth: 120, textAlign: 'center' }}>
                            {monthName}
                        </span>
                        <button onClick={handleNextMonth} className="btn btn-sm btn-ghost" style={{ padding: '4px 6px', border: 'none' }} title="Next Month">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Calendar Grid Container */}
            <div className="card-body p-0">
                {/* Days of Week Header */}
                <div className="calendar-week-header">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                        <div key={day} className={`calendar-week-day ${idx === 0 || idx === 6 ? 'weekend' : ''}`}>
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Grid */}
                <div className="calendar-grid">
                    {calendarDays.map((cell, idx) => {
                        const dayDueOrders = ordersByDeliveryDate[cell.dateStr] || [];
                        const dayBookedOrders = ordersByBookingDate[cell.dateStr] || [];
                        const isToday = cell.dateStr === todayStr;
                        const isSelected = cell.dateStr === selectedDateStr;

                        const pendingC = dayDueOrders.filter(o => o.status === 'Pending').length;
                        const readyC = dayDueOrders.filter(o => o.status === 'Ready').length;
                        const deliveredC = dayDueOrders.filter(o => o.status === 'Delivered').length;

                        return (
                            <div
                                key={idx}
                                onClick={() => {
                                    setSelectedDateStr(cell.dateStr);
                                    setShowModal(true);
                                    if (onDateSelect) onDateSelect(cell.dateStr);
                                }}
                                className={`calendar-day-cell ${!cell.isCurrentMonth ? 'other-month' : ''} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`}
                            >
                                <div className="day-cell-top">
                                    <span className={`day-number ${isToday ? 'today-badge' : ''}`}>
                                        {cell.dayNum}
                                    </span>
                                    {(dayDueOrders.length > 0 || dayBookedOrders.length > 0) && (
                                        <span className="day-total-badge" title={`${dayDueOrders.length} Due, ${dayBookedOrders.length} Booked`}>
                                            {dayDueOrders.length > 0 ? `${dayDueOrders.length} Due` : `${dayBookedOrders.length} Booked`}
                                        </span>
                                    )}
                                </div>

                                {/* Order Status Indicators */}
                                <div className="day-cell-content">
                                    {pendingC > 0 && (
                                        <div className="cal-order-tag pending" title={`${pendingC} Pending Deliveries`}>
                                            <span className="cal-dot pending-dot"></span>
                                            <span className="tag-text">{pendingC} Pending</span>
                                        </div>
                                    )}
                                    {readyC > 0 && (
                                        <div className="cal-order-tag ready" title={`${readyC} Ready for Pickup`}>
                                            <span className="cal-dot ready-dot"></span>
                                            <span className="tag-text">{readyC} Ready</span>
                                        </div>
                                    )}
                                    {deliveredC > 0 && (
                                        <div className="cal-order-tag delivered" title={`${deliveredC} Delivered`}>
                                            <span className="cal-dot delivered-dot"></span>
                                            <span className="tag-text">{deliveredC} Done</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>

            {/* Date Click Overview Modal */}
            {showModal && (
                <div
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.65)', zIndex: 1100,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 16, backdropFilter: 'blur(4px)'
                    }}
                    onClick={() => setShowModal(false)}
                >
                    <div
                        style={{
                            background: '#fff', borderRadius: '16px', width: '100%',
                            maxWidth: '850px', maxHeight: '88vh', display: 'flex',
                            flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                            overflow: 'hidden', border: '1px solid var(--gold)'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div style={{
                            background: 'linear-gradient(135deg, var(--maroon-dark), var(--maroon))',
                            color: '#fff', padding: '16px 20px', display: 'flex',
                            justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <CalendarIcon size={20} color="var(--gold)" />
                                <div>
                                    <h3 style={{ margin: 0, fontSize: 18, color: '#fff' }}>
                                        Overview for {formattedSelectedDateDisplay}
                                    </h3>
                                    <span style={{ fontSize: 12, color: 'var(--gold-light)' }}>
                                        {activeList.length} {viewMode === 'due' ? 'deliveries scheduled' : 'bookings taken'}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{
                                    background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff',
                                    cursor: 'pointer', padding: 6, borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'background 0.2s'
                                }}
                                title="Close Modal"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: 20, overflowY: 'auto', flex: 1, background: 'var(--ivory)' }}>
                            {/* Summary Stats Pills */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
                                <div style={{ background: '#fff', padding: 12, borderRadius: 10, border: '1px solid var(--gray-light)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--gray)', fontWeight: 600 }}>BOOKINGS TAKEN</div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--maroon-dark)' }}>{bookedOrdersForSelected.length}</div>
                                    <div style={{ fontSize: 11, color: 'var(--gold-deep)' }}>&#8377;{totalBookedAmount.toLocaleString('en-IN')}</div>
                                </div>
                                <div style={{ background: '#fff', padding: 12, borderRadius: 10, border: '1px solid var(--gray-light)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--gray)', fontWeight: 600 }}>DELIVERIES DUE</div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--maroon-dark)' }}>{dueOrdersForSelected.length}</div>
                                    <div style={{ fontSize: 11, color: '#C6A75E' }}>{pendingCount} Pending &bull; {readyCount} Ready</div>
                                </div>
                                <div style={{ background: '#fff', padding: 12, borderRadius: 10, border: '1px solid var(--gray-light)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--gray)', fontWeight: 600 }}>READY / DELIVERED</div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: '#2E7D32' }}>{readyCount + deliveredCount}</div>
                                    <div style={{ fontSize: 11, color: '#2E7D32' }}>{deliveredCount} Delivered</div>
                                </div>
                                <div style={{ background: '#fff', padding: 12, borderRadius: 10, border: '1px solid var(--gray-light)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--gray)', fontWeight: 600 }}>ADVANCE COLLECTED</div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: '#1565C0' }}>&#8377;{totalAdvanceCollected.toLocaleString('en-IN')}</div>
                                    <div style={{ fontSize: 11, color: 'var(--gray)' }}>Total Received</div>
                                </div>
                            </div>

                            {/* View Switcher Controls */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        onClick={() => setViewMode('due')}
                                        className={`btn btn-sm ${viewMode === 'due' ? 'btn-maroon' : 'btn-ghost'}`}
                                        style={{ padding: '6px 12px', fontSize: 12 }}
                                    >
                                        🚚 Deliveries Due ({dueOrdersForSelected.length})
                                    </button>
                                    <button
                                        onClick={() => setViewMode('booked')}
                                        className={`btn btn-sm ${viewMode === 'booked' ? 'btn-maroon' : 'btn-ghost'}`}
                                        style={{ padding: '6px 12px', fontSize: 12 }}
                                    >
                                        📝 Bookings Taken ({bookedOrdersForSelected.length})
                                    </button>
                                </div>

                                <div style={{ display: 'flex', gap: 4 }}>
                                    {['All', 'Pending', 'Ready', 'Delivered'].map(st => (
                                        <button
                                            key={st}
                                            onClick={() => setFilterStatus(st)}
                                            className={`btn btn-sm ${filterStatus === st ? 'btn-primary' : 'btn-ghost'}`}
                                            style={{ padding: '3px 8px', fontSize: 11 }}
                                        >
                                            {st}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Orders Card Grid */}
                            {activeList.length === 0 ? (
                                <div className="empty-state" style={{ background: '#fff', padding: 32, borderRadius: 12 }}>
                                    <Package size={32} style={{ opacity: 0.35, margin: '0 auto 8px', display: 'block' }} />
                                    <p style={{ margin: 0, fontWeight: 500 }}>No {viewMode === 'due' ? 'deliveries scheduled' : 'orders booked'} on {formattedSelectedDateDisplay}</p>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                                    {activeList.map(o => {
                                        const isOverdue = o.status !== 'Delivered' && o.delivery_date < todayStr;
                                        return (
                                            <div
                                                key={o.order_id}
                                                className="order-card card"
                                                style={{
                                                    borderLeft: `4px solid ${isOverdue ? '#B71C1C' : 'var(--maroon)'}`,
                                                    background: '#fff',
                                                    padding: '16px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justifyContent: 'space-between',
                                                    boxShadow: 'var(--shadow-sm)'
                                                }}
                                            >
                                                <div>
                                                    <div className="order-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--gray-light)' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--maroon)' }}>
                                                                #{String(o.order_number || o.order_id).padStart(4, '0')}
                                                            </span>
                                                            {isOverdue && (
                                                                <span className="badge badge-overdue" style={{ fontSize: 10 }}>Overdue</span>
                                                            )}
                                                        </div>
                                                        <select
                                                            className="form-select"
                                                            style={{ padding: '4px 8px', fontSize: 12, width: 110, fontWeight: 600 }}
                                                            value={o.status}
                                                            disabled={updatingOrderId === o.order_id}
                                                            onChange={e => handleQuickStatusChange(o.order_id, e.target.value)}
                                                        >
                                                            <option>Pending</option>
                                                            <option>Ready</option>
                                                            <option>Delivered</option>
                                                        </select>
                                                    </div>

                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 12px' }}>
                                                        <div style={{ gridColumn: 'span 2', marginBottom: 2 }}>
                                                            <span style={{ fontSize: 10, color: 'var(--gray)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 2 }}>Customer Name</span>
                                                            <Link to={`/customer/${o.customer_id}`} state={{ from: '/' }} onClick={() => setShowModal(false)} style={{ textDecoration: 'none', color: 'inherit' }}>
                                                                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--maroon-dark)', display: 'block' }}>
                                                                    {o.customer_name}
                                                                </span>
                                                            </Link>
                                                        </div>

                                                        <div>
                                                            <span style={{ fontSize: 10, color: 'var(--gray)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 2 }}>Phone Number</span>
                                                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)' }}>{o.phone_number || '—'}</span>
                                                        </div>

                                                        <div>
                                                            <span style={{ fontSize: 10, color: 'var(--gray)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 2 }}>Delivery Date</span>
                                                            <span style={{ color: isOverdue ? '#B71C1C' : 'var(--charcoal)', fontWeight: 700, fontSize: 13 }}>
                                                                {o.delivery_date ? new Date(o.delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                            </span>
                                                        </div>

                                                        <div>
                                                            <span style={{ fontSize: 10, color: 'var(--gray)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 2 }}>Total Amount</span>
                                                            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--charcoal)' }}>
                                                                &#8377;{parseFloat(o.total_amount).toLocaleString('en-IN')}
                                                            </span>
                                                        </div>

                                                        <div>
                                                            <span style={{ fontSize: 10, color: 'var(--gray)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 2 }}>Advance Paid</span>
                                                            <span style={{ color: '#2E7D32', fontWeight: 600, fontSize: 13 }}>
                                                                &#8377;{parseFloat(o.advance_paid).toLocaleString('en-IN')}
                                                            </span>
                                                        </div>

                                                        <div style={{ gridColumn: 'span 2', background: 'var(--ivory)', padding: '8px 12px', borderRadius: 8, marginTop: 4 }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span style={{ margin: 0, fontSize: 11, color: 'var(--gray)', fontWeight: 600 }}>Balance Pending</span>
                                                                <span style={{ color: parseFloat(o.balance_amount) > 0 ? '#B71C1C' : '#2E7D32', fontWeight: 800, fontSize: 14 }}>
                                                                    &#8377;{parseFloat(o.balance_amount).toLocaleString('en-IN')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--gray-light)', display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                                    {o.status === 'Pending' && (
                                                        <button
                                                            onClick={() => handleQuickStatusChange(o.order_id, 'Ready')}
                                                            disabled={updatingOrderId === o.order_id}
                                                            className="btn btn-sm btn-success"
                                                            style={{ fontSize: 11, padding: '4px 10px' }}
                                                        >
                                                            Mark Ready
                                                        </button>
                                                    )}
                                                    {o.status === 'Ready' && (
                                                        <button
                                                            onClick={() => handleQuickStatusChange(o.order_id, 'Delivered')}
                                                            disabled={updatingOrderId === o.order_id}
                                                            className="btn btn-sm btn-maroon"
                                                            style={{ fontSize: 11, padding: '4px 10px' }}
                                                        >
                                                            Deliver
                                                        </button>
                                                    )}
                                                    <Link to={`/customer/${o.customer_id}`} state={{ from: '/' }} onClick={() => setShowModal(false)} className="btn btn-sm btn-outline" style={{ fontSize: 11, padding: '4px 8px' }}>
                                                        <Users size={13} /> Measurements
                                                    </Link>
                                                    <Link to={`/bill/${o.order_id}`} onClick={() => setShowModal(false)} className="btn btn-sm btn-outline" style={{ fontSize: 11, padding: '4px 8px' }}>
                                                        <Eye size={13} /> Bill
                                                    </Link>
                                                    <Link to={`/edit-order/${o.order_id}`} onClick={() => setShowModal(false)} className="btn btn-sm btn-outline" style={{ borderColor: 'var(--maroon)', color: 'var(--maroon)', fontWeight: 600, fontSize: 11, padding: '4px 8px' }}>
                                                        <Edit2 size={13} /> Edit
                                                    </Link>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div style={{
                            padding: '12px 20px', background: '#fff', borderTop: '1px solid var(--gray-light)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <Link
                                to={`/new-order?booking_date=${selectedDateStr}&delivery_date=${selectedDateStr}`}
                                onClick={() => setShowModal(false)}
                                className="btn btn-sm btn-primary"
                            >
                                <Plus size={14} /> Create Order for {formattedSelectedDateDisplay}
                            </Link>
                            <button onClick={() => setShowModal(false)} className="btn btn-sm btn-outline">
                                Close Overview
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
