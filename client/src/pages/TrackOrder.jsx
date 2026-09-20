import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'react-qr-code';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '/api');

function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

function isOverdue(deliveryDate, status) {
    if (status === 'Delivered') return false;
    return new Date(deliveryDate) < new Date(new Date().toDateString());
}

const STAGES = [
    { key: 'Pending',   label: 'Order Booked',      icon: '📋', desc: 'Your order has been registered.' },
    { key: 'Cutting',   label: 'Cutting Fabric',     icon: '✂️', desc: 'Fabric is being cut to shape.' },
    { key: 'Stitching', label: 'Stitching',          icon: '🧵', desc: 'Our expert is stitching your outfit.' },
    { key: 'Ready',     label: 'Ready for Pickup',   icon: '✅', desc: 'Your outfit is ready! Please collect it.' },
    { key: 'Delivered', label: 'Delivered',           icon: '🎉', desc: 'Order complete. Enjoy your outfit!' },
];

function getStageIndex(status) {
    if (status === 'Pending') return 0;
    if (status === 'Ready')   return 3;
    if (status === 'Delivered') return 4;
    return 0;
}

export default function TrackOrder() {
    const { orderId } = useParams();
    const [order, setOrder] = useState(null);
    // Verification states
    const [phone, setPhone] = useState(() => sessionStorage.getItem(`track_phone_${orderId}`) || '');
    const [loading, setLoading] = useState(() => Boolean(sessionStorage.getItem(`track_phone_${orderId}`)));
    const [error, setError] = useState(null);
    const [isVerified, setIsVerified] = useState(false);
    const [phoneInput, setPhoneInput] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [verificationError, setVerificationError] = useState('');

    useEffect(() => {
        if (!orderId || !phone) return;

        let isMounted = true;
        fetch(`${API_BASE}/track/${orderId}?phone=${encodeURIComponent(phone)}`)
            .then(async r => {
                if (r.status === 403 || r.status === 400) {
                    sessionStorage.removeItem(`track_phone_${orderId}`);
                    if (isMounted) setPhone('');
                    throw new Error('Incorrect phone number. Access denied.');
                }
                if (!r.ok) throw new Error('Order not found');
                return r.json();
            })
            .then(data => {
                if (!isMounted) return;
                setOrder(data);
                setIsVerified(true);
                setLoading(false);
            })
            .catch(e => {
                if (!isMounted) return;
                if (e.message === 'Incorrect phone number. Access denied.') {
                    setVerificationError(e.message);
                    setIsVerified(false);
                } else {
                    setError(e.message);
                }
                setLoading(false);
            });

        return () => { isMounted = false; };
    }, [orderId, phone]);

    const handleVerify = (e) => {
        e.preventDefault();
        const cleanInput = phoneInput.replace(/\D/g, '');
        if (cleanInput.length < 10) {
            setVerificationError('Please enter a valid 10-digit mobile number.');
            return;
        }
        setVerifying(true);
        setVerificationError('');

        fetch(`${API_BASE}/track/${orderId}?phone=${encodeURIComponent(cleanInput)}`)
            .then(async r => {
                if (r.status === 403 || r.status === 400) {
                    throw new Error('Incorrect phone number. Access denied.');
                }
                if (!r.ok) throw new Error('Order not found');
                return r.json();
            })
            .then(data => {
                sessionStorage.setItem(`track_phone_${orderId}`, cleanInput);
                setOrder(data);
                setPhone(cleanInput);
                setIsVerified(true);
                setVerifying(false);
            })
            .catch(e => {
                setVerificationError(e.message);
                setVerifying(false);
            });
    };

    const stageIdx = order ? getStageIndex(order.status) : -1;
    const overdue = order ? isOverdue(order.delivery_date, order.status) : false;

    if (loading) return (
        <div style={styles.page}>
            <div style={styles.brand}>
                <div style={styles.brandCircle}>ST</div>
                <div style={styles.brandName}>Smart Tailor</div>
            </div>
            <div style={styles.card}>
                <div style={styles.spinnerWrap}><div style={styles.spinner} /></div>
                <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 12 }}>Fetching order details…</p>
            </div>
        </div>
    );

    // If not verified yet, show the phone verification form
    if (!isVerified) return (
        <div style={styles.page}>
            <div style={styles.brand}>
                <div style={styles.brandCircle}>ST</div>
                <div style={styles.brandName}>Smart Tailor</div>
            </div>
            <div style={styles.card}>
                <h3 style={{ ...styles.sectionTitle, textAlign: 'center', fontSize: 18, marginBottom: 8 }}>🔒 Verify Your Identity</h3>
                <p style={{ textAlign: 'center', color: '#6B7280', fontSize: 13, lineHeight: 1.5, marginBottom: 20 }}>
                    Please enter the 10-digit mobile number associated with your order to view details.
                </p>

                <form onSubmit={handleVerify}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                            Mobile Number
                        </label>
                        <div style={{ display: 'flex', borderRadius: 8, border: '1px solid #D1D5DB', overflow: 'hidden', height: 46 }}>
                            <span style={{ display: 'flex', alignItems: 'center', padding: '0 12px', background: '#F3F4F6', color: '#6B7280', fontSize: 14, fontWeight: 600, borderRight: '1px solid #E5E7EB' }}>
                                +91
                            </span>
                            <input
                                type="tel"
                                placeholder="10-digit number"
                                value={phoneInput}
                                onChange={e => {
                                    setPhoneInput(e.target.value.slice(0, 10));
                                    setVerificationError('');
                                }}
                                style={{ flex: 1, border: 'none', padding: '0 12px', outline: 'none', fontSize: 16, color: '#1A0A10' }}
                                required
                            />
                        </div>
                    </div>

                    {verificationError && (
                        <div style={{ background: '#FDF2F2', border: '1px solid #FDE8E8', color: '#E02424', padding: '10px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 500, marginBottom: 16 }}>
                            ⚠️ {verificationError}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={verifying}
                        style={{
                            width: '100%',
                            height: 46,
                            background: 'linear-gradient(135deg, #6A1E2E 0%, #4A101C 100%)',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: 8,
                            fontWeight: 700,
                            fontSize: 14.5,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            boxShadow: '0 4px 12px rgba(106,30,46,0.15)',
                            transition: 'opacity 0.2s'
                        }}
                    >
                        {verifying ? 'Verifying…' : 'Verify & Track Order'}
                    </button>
                </form>
            </div>
        </div>
    );

    if (error || !order) return (
        <div style={styles.page}>
            <div style={styles.brand}>
                <div style={styles.brandCircle}>ST</div>
                <div style={styles.brandName}>Smart Tailor</div>
            </div>
            <div style={styles.card}>
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <div style={{ fontSize: 48 }}>🔍</div>
                    <h2 style={{ ...styles.cardTitle, marginTop: 12, fontSize: 20 }}>Order Not Found</h2>
                    <p style={{ color: '#6B7280', marginTop: 8, fontSize: 14 }}>
                        The order #{orderId} could not be found. Please check the link or contact the boutique.
                    </p>
                </div>
            </div>
        </div>
    );

    const upiString = order.shop_upi
        ? `upi://pay?pa=${order.shop_upi}&pn=${encodeURIComponent(order.shop_name || 'Smart Tailor')}&am=${order.balance_amount.toFixed(2)}&cu=INR`
        : null;

    return (
        <div style={styles.page}>
            {/* ── Brand Header ── */}
            <div style={styles.brand}>
                <div style={styles.brandCircle}>{(order.shop_name || 'ST').substring(0, 2).toUpperCase()}</div>
                <div>
                    <div style={styles.brandName}>{order.shop_name || 'Smart Tailor'}</div>
                    {order.shop_address && <div style={styles.brandSub}>{order.shop_address}</div>}
                </div>
            </div>

            {/* ── Order Identity Card ── */}
            <div style={styles.card}>
                <div style={styles.orderHeader}>
                    <div>
                        <div style={styles.orderNum}>Order #{String(order.order_number || order.order_id).padStart(4, '0')}</div>
                        <div style={styles.customerName}>{order.customer_name}</div>
                    </div>
                    <div style={{ ...styles.statusBadge, ...(styles['badge_' + order.status] || styles.badge_Pending) }}>
                        {order.status === 'Pending' ? '🕐' : order.status === 'Ready' ? '✅' : '🎉'} {order.status}
                    </div>
                </div>
                <div style={styles.orderMeta}>
                    <div style={styles.metaItem}>
                        <span style={styles.metaLabel}>Booked</span>
                        <span style={styles.metaValue}>{formatDate(order.booking_date)}</span>
                    </div>
                    <div style={styles.metaItem}>
                        <span style={styles.metaLabel}>Delivery</span>
                        <span style={{ ...styles.metaValue, color: overdue ? '#D32F2F' : order.status === 'Ready' ? '#1B5E20' : '#6A1E2E', fontWeight: 700 }}>
                            {formatDate(order.delivery_date)} {overdue ? '⚠️ Overdue' : ''}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Progress Timeline ── */}
            <div style={styles.card}>
                <h3 style={styles.sectionTitle}>📍 Stitching Progress</h3>
                <div style={styles.timeline}>
                    {STAGES.map((stage, i) => {
                        const done = i < stageIdx;
                        const active = i === stageIdx;
                        const upcoming = i > stageIdx;
                        return (
                            <div key={stage.key} style={styles.timelineItem}>
                                {/* Connector line */}
                                {i < STAGES.length - 1 && (
                                    <div style={{ ...styles.connector, background: done || active ? '#C6A75E' : '#E5E7EB' }} />
                                )}
                                {/* Dot */}
                                <div style={{
                                    ...styles.dot,
                                    background: active ? 'linear-gradient(135deg,#D4B97A,#A8893C)' : done ? '#C6A75E' : '#E5E7EB',
                                    border: active ? '3px solid #6A1E2E' : done ? '2px solid #A8893C' : '2px solid #D1D5DB',
                                    boxShadow: active ? '0 0 0 4px rgba(198,167,94,0.2)' : 'none',
                                    transform: active ? 'scale(1.2)' : 'scale(1)',
                                }}>
                                    {done ? '✓' : active ? stage.icon : ''}
                                </div>
                                {/* Label */}
                                <div style={{ marginLeft: 16 }}>
                                    <div style={{ fontSize: 14, fontWeight: active ? 700 : done ? 600 : 400, color: upcoming ? '#9CA3AF' : '#1A0A10' }}>
                                        {stage.label}
                                    </div>
                                    {active && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{stage.desc}</div>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Services ── */}
            <div style={styles.card}>
                <h3 style={styles.sectionTitle}>🧾 Your Order</h3>
                <div>
                    {order.services.map((svc, i) => (
                        <div key={i} style={styles.serviceRow}>
                            <span style={{ fontSize: 14, color: '#1C1C1E', fontWeight: 500 }}>{svc.service_type} × {svc.quantity}</span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#6A1E2E' }}>₹{(svc.price * svc.quantity).toFixed(2)}</span>
                        </div>
                    ))}
                    <div style={styles.divider} />
                    <div style={{ ...styles.serviceRow, fontWeight: 700 }}>
                        <span style={{ color: '#6B7280' }}>Total</span>
                        <span>₹{order.total_amount.toFixed(2)}</span>
                    </div>
                    <div style={styles.serviceRow}>
                        <span style={{ color: '#2E7D32', fontSize: 13 }}>Advance Paid</span>
                        <span style={{ color: '#2E7D32', fontWeight: 600 }}>− ₹{order.advance_paid.toFixed(2)}</span>
                    </div>
                    <div style={{ ...styles.serviceRow, background: 'rgba(198,167,94,0.08)', borderRadius: 10, padding: '10px 14px', marginTop: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>Balance Due</span>
                        <span style={{ fontWeight: 800, fontSize: 18, color: order.balance_amount > 0 ? '#BF360C' : '#2E7D32' }}>
                            {order.balance_amount > 0 ? `₹${order.balance_amount.toFixed(2)}` : '✓ Cleared'}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── UPI QR Code ── */}
            {order.balance_amount > 0 && upiString && order.status !== 'Delivered' && (
                <div style={{ ...styles.card, textAlign: 'center' }}>
                    <h3 style={styles.sectionTitle}>💳 Pay Balance Online</h3>
                    <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
                        Scan with PhonePe, Google Pay, or Paytm to pay ₹{order.balance_amount.toFixed(2)}
                    </p>
                    <div style={{ display: 'inline-block', background: '#fff', padding: 12, borderRadius: 12, border: '1px solid #E5E7EB', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                        <QRCode value={upiString} size={160} level="L" />
                    </div>
                    <div style={{ marginTop: 12, fontSize: 12, color: '#9CA3AF' }}>{order.shop_upi}</div>
                </div>
            )}

            {/* ── Notes ── */}
            {order.notes && (
                <div style={{ ...styles.card, background: 'rgba(255,243,224,0.7)', border: '1px solid #FFB74D' }}>
                    <h3 style={{ ...styles.sectionTitle, color: '#E65100' }}>📝 Boutique Note</h3>
                    <p style={{ fontSize: 14, color: '#4E342E', lineHeight: 1.6 }}>{order.notes}</p>
                </div>
            )}

            {/* ── Contact Boutique ── */}
            {order.shop_phone && (
                <div style={{ ...styles.card, textAlign: 'center' }}>
                    <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 10 }}>Need help? Contact the boutique directly</p>
                    <a
                        href={`https://wa.me/${order.shop_phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}?text=${encodeURIComponent(`Hi! I'm enquiring about my order #${String(order.order_number || order.order_id).padStart(4,'0')}.`)}`}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.whatsappBtn}
                    >
                        💬 WhatsApp Boutique
                    </a>
                </div>
            )}

            {/* ── Footer ── */}
            <div style={styles.footer}>
                <div style={{ marginBottom: 4 }}>Powered by <strong>Smart Tailor</strong> — Luxury in Every Stitch ✦</div>
                <div style={{ opacity: 0.6, fontSize: 11 }}>We are not responsible for garments left over 3 months.</div>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
                * { box-sizing: border-box; }
            `}</style>
        </div>
    );
}

/* ── Styles ─────────────────────────────────────────────────── */
const styles = {
    page: {
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #FAF7F2 0%, #F3EEE7 60%, #EDD5A3 100%)',
        padding: '24px 16px 48px',
        fontFamily: "'Inter', -apple-system, sans-serif",
        animation: 'fadeIn 0.4s ease',
    },
    brand: {
        display: 'flex', alignItems: 'center', gap: 14,
        maxWidth: 480, margin: '0 auto 24px',
    },
    brandCircle: {
        width: 52, height: 52, borderRadius: '50%',
        background: 'linear-gradient(135deg, #D4B97A, #A8893C)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 800, color: '#1A0A10',
        boxShadow: '0 4px 16px rgba(198,167,94,0.35)',
        flexShrink: 0,
    },
    brandName: {
        fontSize: 20, fontWeight: 700, color: '#6A1E2E',
        letterSpacing: '0.04em',
    },
    brandSub: {
        fontSize: 12, color: '#9CA3AF', marginTop: 2,
    },
    card: {
        background: '#FFFFFF',
        borderRadius: 16,
        padding: '20px 20px',
        marginBottom: 16,
        maxWidth: 480, margin: '0 auto 16px',
        boxShadow: '0 2px 12px rgba(26,10,16,0.07)',
        border: '1px solid rgba(229,231,235,0.8)',
    },
    orderHeader: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 16,
    },
    orderNum: {
        fontSize: 13, color: '#9CA3AF', letterSpacing: '0.05em', marginBottom: 4,
    },
    customerName: {
        fontSize: 22, fontWeight: 700, color: '#1A0A10',
    },
    statusBadge: {
        padding: '6px 14px', borderRadius: 999,
        fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
        flexShrink: 0,
    },
    badge_Pending:  { background: '#FBE9E7', color: '#BF360C', border: '1px solid #FFAB91' },
    badge_Ready:    { background: '#E3F2FD', color: '#0D47A1', border: '1px solid #90CAF9' },
    badge_Delivered:{ background: '#E8F5E9', color: '#1B5E20', border: '1px solid #A5D6A7' },
    orderMeta: {
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
        background: '#FAF7F2', borderRadius: 10, padding: '12px 14px',
    },
    metaItem: { display: 'flex', flexDirection: 'column', gap: 3 },
    metaLabel: { fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em' },
    metaValue:  { fontSize: 13, fontWeight: 600, color: '#1C1C1E' },
    sectionTitle: {
        fontSize: 15, fontWeight: 700, color: '#1A0A10',
        marginBottom: 16, letterSpacing: '0.01em',
    },
    timeline: {
        display: 'flex', flexDirection: 'column', gap: 0,
        paddingLeft: 8,
    },
    timelineItem: {
        display: 'flex', alignItems: 'flex-start',
        position: 'relative', paddingBottom: 24, minHeight: 44,
    },
    connector: {
        position: 'absolute', left: 17, top: 36,
        width: 2, height: 'calc(100% - 16px)',
        borderRadius: 2,
        transition: 'background 0.3s',
    },
    dot: {
        width: 36, height: 36, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, fontWeight: 700, color: '#1A0A10',
        flexShrink: 0, transition: 'all 0.3s', zIndex: 1,
    },
    serviceRow: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 0', borderBottom: '1px solid rgba(229,231,235,0.5)',
    },
    divider: {
        height: 1, background: 'linear-gradient(90deg, transparent, #C6A75E, transparent)',
        margin: '8px 0',
    },
    whatsappBtn: {
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: '#25D366', color: '#fff',
        padding: '10px 22px', borderRadius: 10,
        fontWeight: 700, fontSize: 14, textDecoration: 'none',
        boxShadow: '0 4px 12px rgba(37,211,102,0.3)',
    },
    footer: {
        textAlign: 'center', padding: '24px 0 0',
        fontSize: 12, color: '#9CA3AF', maxWidth: 480, margin: '0 auto',
    },
    spinnerWrap: { display: 'flex', justifyContent: 'center', padding: '32px 0' },
    spinner: {
        width: 36, height: 36, borderRadius: '50%',
        border: '3px solid #E5E7EB', borderTopColor: '#C6A75E',
        animation: 'spin 0.7s linear infinite',
    },
};
