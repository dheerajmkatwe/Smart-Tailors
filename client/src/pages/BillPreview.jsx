import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { Download, Share2, Printer, ChevronLeft, CheckCircle, Clock, Menu, Image as ImageIcon, X, Mic, Edit2 } from 'lucide-react';
import QRCode from 'react-qr-code';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { getOfflineOrders } from '../utils/offlineStore';

function StatusBadge({ status }) {
    const cls = { Pending: 'badge badge-pending', Ready: 'badge badge-ready', Delivered: 'badge badge-delivered' }[status] || 'badge';
    return <span className={cls}>{status}</span>;
}

function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function BillPreview({ onMenuClick }) {
    const auth = (() => {
        try {
            return JSON.parse(localStorage.getItem('tailor_auth') || '{}');
        } catch {
            return {};
        }
    })();
    const isPremium = auth?.isPremiumActive;

    const { orderId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [order, setOrder] = useState(null);
    const [images, setImages] = useState([]);
    const [voiceNotes, setVoiceNotes] = useState([]);
    const [previewImage, setPreviewImage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statusUpdating, setStatusUpdating] = useState(false);
    const [processingRazorpay, setProcessingRazorpay] = useState(false);

    useEffect(() => {
        if (orderId && orderId.toString().startsWith('offline-')) {
            const queueId = parseInt(orderId.replace('offline-', ''), 10);
            getOfflineOrders().then(orders => {
                const queuedOrder = orders.find(o => o.id === queueId);
                if (!queuedOrder) {
                    toast.error('Offline order not found');
                    setLoading(false);
                    return;
                }
                
                const p = queuedOrder.orderPayload;
                const total = p.services.reduce((s, svc) => s + (parseFloat(svc.price) * parseInt(svc.quantity)), 0);
                const pseudoOrder = {
                    order_id: 'Offline Pending',
                    customer_name: queuedOrder.customer?.name || 'Unknown',
                    phone_number: queuedOrder.customer?.phone_number || '',
                    booking_date: p.booking_date,
                    delivery_date: p.delivery_date,
                    total_amount: total,
                    advance_paid: p.advance_paid,
                    balance_amount: total - p.advance_paid,
                    status: 'Pending',
                    measurement_type: p.measurement_type,
                    notes: p.notes,
                    services: p.services,
                    created_at: new Date(queuedOrder.timestamp || Date.now()).toISOString()
                };

                setOrder(pseudoOrder);
                setImages(queuedOrder.images ? queuedOrder.images.map((img, i) => ({ id: `img-${i}`, image_data: img })) : []);
                setVoiceNotes(queuedOrder.audioData ? [{ id: 'vn-1', audio_data: queuedOrder.audioData, duration: queuedOrder.recordingTime }] : []);
                setLoading(false);
            }).catch(() => {
                toast.error('Failed to load offline order');
                setLoading(false);
            });
            return;
        }

        Promise.all([
            api.get(`/orders/${orderId}`),
            api.get(`/orders/${orderId}/images`).catch(() => ({ data: [] })), 
            api.get(`/orders/${orderId}/voice-notes`).catch(() => ({ data: [] }))
        ])
            .then(([orderRes, imgRes, voiceRes]) => {
                setOrder(orderRes.data);
                setImages(imgRes.data);
                setVoiceNotes(voiceRes.data);
            })
            .catch(() => toast.error('Order not found'))
            .finally(() => setLoading(false));
    }, [orderId]);

    async function handleClearBalance() {
        if (!window.confirm('Is the amount cleared? Settle the remaining bill?')) return;
        setStatusUpdating(true);
        try {
            await api.put(`/orders/${orderId}`, {
                advance_paid: order.total_amount,
                services: order.services
            });
            const res = await api.get(`/orders/${orderId}`);
            setOrder(res.data);
            toast.success('Balance cleared successfully');
        } catch {
            toast.error('Failed to clear balance');
        } finally {
            setStatusUpdating(false);
        }
    }

    async function settleBalanceInDB() {
        await api.put(`/orders/${orderId}`, {
            advance_paid: order.total_amount,
            services: order.services
        });
        const res = await api.get(`/orders/${orderId}`);
        setOrder(res.data);
    }

    async function handleCollectBalance() {
        if (!order || parseFloat(order.balance_amount) <= 0) return;

        const shopGst = auth?.gst_id;
        const shopRazorpayKey = auth?.razorpay_key_id;
        const balanceAmt = parseFloat(order.balance_amount);

        // If GST + Razorpay credentials are configured → use Razorpay
        if (shopGst && shopGst.trim() && shopRazorpayKey && shopRazorpayKey.trim()) {
            setProcessingRazorpay(true);
            try {
                // Create Razorpay order on backend
                const createRes = await api.post('/auth/razorpay-create-advance-order', { amount: balanceAmt });
                const { order_id: razorOrderId, amount: amountPaise, key } = createRes.data;

                // Load Razorpay SDK dynamically if not already present
                if (!window.Razorpay) {
                    await new Promise((resolve, reject) => {
                        const s = document.createElement('script');
                        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
                        s.onload = resolve;
                        s.onerror = reject;
                        document.body.appendChild(s);
                    });
                }

                const rzp = new window.Razorpay({
                    key,
                    amount: amountPaise,
                    currency: 'INR',
                    name: order.shop_name || 'Smart Tailor',
                    description: `Balance for Order #${String(order.order_number || order.order_id).padStart(4, '0')}`,
                    order_id: razorOrderId,
                    prefill: {
                        name: order.customer_name,
                        contact: order.phone_number,
                    },
                    theme: { color: '#6A1E2E' },
                    handler: async (response) => {
                        try {
                            // Verify signature on backend
                            await api.post('/auth/razorpay-verify-advance-payment', {
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_order_id:   response.razorpay_order_id,
                                razorpay_signature:  response.razorpay_signature,
                            });
                            // Settle the order in DB
                            await settleBalanceInDB();
                            toast.success(`✔ Balance of ₹${balanceAmt.toFixed(2)} collected via Razorpay!`);
                        } catch {
                            toast.error('Payment verified but order settle failed. Please manually clear balance.');
                        } finally {
                            setProcessingRazorpay(false);
                        }
                    },
                    modal: {
                        ondismiss: () => {
                            setProcessingRazorpay(false);
                            toast.error('Payment cancelled.');
                        }
                    }
                });
                rzp.open();
            } catch (err) {
                setProcessingRazorpay(false);
                toast.error('Failed to initiate Razorpay. Please collect manually.');
            }
        } else {
            // Fallback: manual confirmation
            handleClearBalance();
        }
    }

    function handlePrint() {
        if (!order) return;
        const originalTitle = document.title;

        // Format the customer name for a clean filename (e.g. "Jane_Doe_Bill_0012")
        const safeName = (order.customer_name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
        const displayId = order.order_number || order.order_id;
        const oIdStr = displayId === 'Offline Pending' ? 'Offline' : String(displayId).padStart(4, '0');
        document.title = `${safeName}_Bill_${oIdStr}`;

        window.print();

        // Restore original title after a slight delay to ensure the print dialog catches the new title
        setTimeout(() => {
            document.title = originalTitle;
        }, 1000);
    }

    function handleWhatsApp() {
        if (!order) return;
        let phoneForUrl = order.phone_number.replace(/\D/g, '');
        if (phoneForUrl.length === 10) phoneForUrl = '91' + phoneForUrl;

        const msg = encodeURIComponent(
            `*Bill*\n\n` +
            `Customer: ${order.customer_name}\n` +
            `Phone: ${order.phone_number}\n` +
            `Order #${String(order.order_number || order.order_id).padStart(4, '0')}\n` +
            `Booking: ${formatDate(order.booking_date)}\n` +
            `Delivery: ${formatDate(order.delivery_date)}\n\n` +
            `*Services:*\n` +
            order.services.map(s => `• ${s.service_type} x${s.quantity} = \u20b9${(parseFloat(s.price) * s.quantity).toFixed(2)}`).join('\n') +
            (order.has_embroidery ? `\n• Embroidery Work = \u20b9${parseFloat(order.embroidery_cost || 0).toFixed(2)}` : '') +
            `\n\n*Total: \u20b9${parseFloat(order.total_amount).toFixed(2)}*\n` +
            `Advance Paid: \u20b9${parseFloat(order.advance_paid).toFixed(2)}\n` +
            `*Balance Due: \u20b9${parseFloat(order.balance_amount).toFixed(2)}*\n\n` +
            `*Note: We are not responsible for clothes left over 3 months.*`
        );
        window.open(`https://wa.me/${phoneForUrl}?text=${msg}`, '_blank');
    }

    function handleWhatsAppReview() {
        if (!order) return;
        let phoneForUrl = order.phone_number.replace(/\D/g, '');
        if (phoneForUrl.length === 10) phoneForUrl = '91' + phoneForUrl;

        const msg = encodeURIComponent(
            `Dear ${order.customer_name},\n\n` +
            `Thank you for choosing us! We hope you are satisfied with our stitching.\n\n` +
            `We would love to hear your feedback. Your review helps us improve and also supports our small business.\n\n` +
            `If you have a moment, please leave us a review on Google:\n` +
            `https://g.co/kgs/LUPXvNh\n\n` +
            `Thank you for your support!`
        );
        window.open(`https://wa.me/${phoneForUrl}?text=${msg}`, '_blank');
    }

    function handleShareTracker() {
        if (!order) return;
        let phoneForUrl = order.phone_number.replace(/\D/g, '');
        if (phoneForUrl.length === 10) phoneForUrl = '91' + phoneForUrl;

        const trackUrl = `${window.location.origin}/track/${order.order_id}`;
        const orderNum = String(order.order_number || order.order_id).padStart(4, '0');
        const msg = encodeURIComponent(
            `Dear ${order.customer_name},\n\n` +
            `Your order #${orderNum} has been registered at ${order.shop_name || 'our boutique'}.\n\n` +
            `Track your stitching progress live here:\n` +
            `${trackUrl}\n\n` +
            `Expected Delivery: ${formatDate(order.delivery_date)}\n` +
            `Balance Due: \u20b9${parseFloat(order.balance_amount).toFixed(2)}\n\n` +
            `Thank you for choosing us!`
        );
        window.open(`https://wa.me/${phoneForUrl}?text=${msg}`, '_blank');
    }

    const handleWhatsAppReady = (order) => {
        let phoneForUrl = order.phone_number.replace(/\D/g, '');
        if (phoneForUrl.length === 10) phoneForUrl = '91' + phoneForUrl;

        const msg = encodeURIComponent(
            `Dear ${order.customer_name},\n\n` +
            `Your blouse is ready to collect!\n\n` +
            `Order No: #${String(order.order_number || order.order_id).padStart(4, '0')}\n` +
            `Balance Amount: ₹${order.balance_amount.toLocaleString('en-IN')}\n\n` +
            `Please visit us soon.`
        );
        window.open(`https://wa.me/${phoneForUrl}?text=${msg}`, '_blank');
    };

    async function handleStatusChange(newStatus) {
        setStatusUpdating(true);
        try {
            await api.put(`/orders/${orderId}/status`, { status: newStatus });
            setOrder(o => {
                const updated = { ...o, status: newStatus };
                if (newStatus === 'Ready') {
                    handleWhatsAppReady(updated);
                }
                return updated;
            });
            toast.success(`Status updated to ${newStatus}`);
        } catch {
            toast.error('Status update failed');
        } finally {
            setStatusUpdating(false);
        }
    }

    if (loading) return (
        <div>
            <div className="topbar">
                <div className="topbar-title">Bill Preview</div>
            </div>
            <div className="page-container"><div className="spinner" /></div>
        </div>
    );

    if (!order) return (
        <div className="page-container">
            <div className="empty-state">Order not found. <Link to="/">Go to Dashboard</Link></div>
        </div>
    );

    const subtotal = order.services?.reduce((s, svc) => s + parseFloat(svc.price) * svc.quantity, 0) || 0;

    return (
        <div>
            {/* Top bar */}
            <div className="topbar flex-between no-print">
                <div className="flex gap-12">
                    <button className="mobile-menu-btn" onClick={onMenuClick}>
                        <Menu size={22} />
                    </button>
                    <button className="btn btn-ghost hide-mobile" onClick={() => navigate(-1)}>
                        <ChevronLeft size={16} /> Back
                    </button>
                    <div>
                        <div className="topbar-title">Bill {order.order_id === 'Offline Pending' ? '(Offline)' : `#${String(order.order_number || order.order_id).padStart(4, '0')}`}</div>
                        <div className="topbar-subtitle">{order.customer_name}</div>
                    </div>
                </div>
                <div className="flex gap-8">
                    {/* Status updater */}
                    <select
                        className="form-select hide-mobile"
                        style={{ width: 130, padding: '8px 12px', fontSize: 13 }}
                        value={order.status}
                        disabled={statusUpdating}
                        onChange={e => handleStatusChange(e.target.value)}
                    >
                        <option>Pending</option>
                        <option>Ready</option>
                        <option>Delivered</option>
                    </select>
                    <button className="btn btn-outline" onClick={handleWhatsApp}><Share2 size={16} /> <span className="hide-mobile">WhatsApp</span></button>
                    <button
                        className="btn btn-success hide-mobile"
                        onClick={handleShareTracker}
                        title="Send order tracking link to customer via WhatsApp"
                    >
                        📍 <span>Share Tracker</span>
                    </button>
                    <button className="btn btn-primary" onClick={handlePrint}><Printer size={16} /> <span className="hide-mobile">Print / Save PDF</span></button>
                </div>
            </div>

            <div className="page-container">
                <div className="bill-preview-layout">

                    {/* ── Bill Preview ─────────────────────── */}
                    <div style={{ flex: 1, maxWidth: 580 }}>
                        <div className="bill-preview" id="bill-content" style={{ position: 'relative', overflow: 'hidden' }}>
                            {/* Watermark for Free plan in HTML */}
                            {!isPremium && (
                                <div style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%) rotate(-25deg)',
                                    fontSize: '180px',
                                    fontWeight: 'bold',
                                    color: 'var(--maroon)',
                                    opacity: 0.06,
                                    pointerEvents: 'none',
                                    userSelect: 'none',
                                    zIndex: 0
                                }}>
                                    ST
                                </div>
                            )}
                            {/* Header */}
                            <div className="bill-header">
                                <div style={{ borderBottom: '1px solid rgba(198,167,94,0.3)', paddingBottom: 12, marginBottom: 12, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    {order.shop_logo && (
                                        <img src={order.shop_logo} alt="Shop Logo" style={{ maxWidth: 80, maxHeight: 80, objectFit: 'contain', marginBottom: 8, borderRadius: 8 }} />
                                    )}
                                    <div style={{ fontSize: 11, letterSpacing: '0.3em', color: 'rgba(198,167,94,0.6)', marginBottom: 6, textTransform: 'uppercase' }}>
                                        Receipt
                                    </div>
                                    <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--gold)', letterSpacing: '0.1em', textAlign: 'center' }}>
                                        {order.shop_name ? order.shop_name.toUpperCase() : 'SMART TAILOR'}
                                    </h1>
                                    <p style={{ fontSize: 11, marginTop: 4, textAlign: 'center' }}>✦ Luxury in Every Stitch ✦</p>
                                </div>
                                <p style={{ fontSize: 11, color: 'rgba(198,167,94,0.7)' }}>
                                    {order.shop_address || ''}
                                </p>
                                <p style={{ fontSize: 11, color: 'rgba(198,167,94,0.7)', marginTop: 3 }}>
                                    {order.shop_phone ? `Phone: ${order.shop_phone}` : (auth?.phone_number ? `Phone: ${auth.phone_number}` : '')}
                                </p>
                                {order.shop_gst && (
                                    <p style={{ fontSize: 9, color: 'rgba(198,167,94,0.5)', marginTop: 3 }}>
                                        GSTIN: {order.shop_gst}
                                    </p>
                                )}
                            </div>

                            {/* Bill Meta */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px', background: 'var(--blush)', borderBottom: '1px solid var(--gray-light)', fontSize: 12 }}>
                                <span><strong>Bill #:</strong> {order.order_id === 'Offline Pending' ? 'Pending Sync' : String(order.order_number || order.order_id).padStart(4, '0')}</span>
                                <span><strong>Date:</strong> {new Date().toLocaleDateString('en-IN')}</span>
                                {order.order_id === 'Offline Pending' ? (
                                    <span className="badge" style={{ background: '#FFF3E0', color: '#E65100' }}>Pending Sync</span>
                                ) : (
                                    <StatusBadge status={order.status} />
                                )}
                            </div>

                            {/* Customer Details */}
                            <div className="bill-section">
                                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 700, color: 'var(--maroon)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Customer Details
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 13 }}>
                                    <div>
                                        <span style={{ color: 'var(--gray)', fontSize: 11 }}>Name</span>
                                        <div style={{ fontWeight: 600 }}>{order.customer_name}</div>
                                    </div>
                                    <div>
                                        <span style={{ color: 'var(--gray)', fontSize: 11 }}>Phone</span>
                                        <div style={{ fontWeight: 600 }}>{order.phone_number}</div>
                                    </div>
                                    <div>
                                        <span style={{ color: 'var(--gray)', fontSize: 11 }}>Order Date</span>
                                        <div>{formatDate(order.booking_date)}</div>
                                    </div>
                                    <div>
                                        <span style={{ color: 'var(--gray)', fontSize: 11 }}>Delivery Date</span>
                                        <div style={{ fontWeight: 600, color: 'var(--maroon)' }}>{formatDate(order.delivery_date)}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="gold-divider" style={{ margin: 0 }} />

                            {/* Services Table */}
                            <div style={{ padding: '0 0' }}>
                                <div style={{ padding: '10px 20px 6px', fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 700, color: 'var(--maroon)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Services
                                </div>
                                <table className="bill-table">
                                    <thead>
                                        <tr>
                                            <th>Service</th>
                                            <th style={{ textAlign: 'center' }}>Qty</th>
                                            <th style={{ textAlign: 'right' }}>Price</th>
                                            <th style={{ textAlign: 'right' }}>Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {order.services?.map((svc, i) => {
                                            const sub = parseFloat(svc.price) * svc.quantity;
                                            return (
                                                <tr key={i}>
                                                    <td style={{ fontWeight: 500 }}>{svc.service_type}</td>
                                                    <td style={{ textAlign: 'center' }}>{svc.quantity}</td>
                                                    <td style={{ textAlign: 'right' }}>{`\u20b9${parseFloat(svc.price).toFixed(2)}`}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{`\u20b9${sub.toFixed(2)}`}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Embroidery Details (if any) */}
                            {order.has_embroidery === 1 && order.embroidery && (
                                <div style={{ padding: '0 0' }}>
                                    <div className="gold-divider" style={{ margin: 0 }} />
                                    <div style={{ padding: '10px 20px 6px', fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 700, color: 'var(--maroon)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Embroidery Details
                                    </div>
                                    <div style={{ padding: '0 20px 12px 20px', fontSize: 12 }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                                            {order.embroidery.work_type && (
                                                <div><span style={{ color: 'var(--gray)' }}>Work Type:</span> <strong style={{color: '#111'}}>{order.embroidery.work_type}</strong></div>
                                            )}
                                            {order.embroidery.neck_depth && (
                                                <div><span style={{ color: 'var(--gray)' }}>Neck Depth:</span> <strong style={{color: '#111'}}>{order.embroidery.neck_depth} inches</strong></div>
                                            )}
                                            {order.embroidery.matching_colors && (
                                                <div><span style={{ color: 'var(--gray)' }}>Colors/Thread:</span> <strong style={{color: '#111'}}>{order.embroidery.matching_colors}</strong></div>
                                            )}
                                            {order.embroidery.placement_area && (
                                                <div><span style={{ color: 'var(--gray)' }}>Placement:</span> <strong style={{color: '#111'}}>{order.embroidery.placement_area}</strong></div>
                                            )}
                                            {order.embroidery.embellishments && (
                                                <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--gray)' }}>Embellishments:</span> <strong style={{color: '#111'}}>{order.embroidery.embellishments}</strong></div>
                                            )}
                                            {order.embroidery.work_area_size && (
                                                <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--gray)' }}>Size:</span> <strong style={{color: '#111'}}>{order.embroidery.work_area_size}</strong></div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Payment Summary */}
                            <div className="bill-totals">
                                <div className="bill-total-row">
                                    <span style={{ color: 'var(--gray)' }}>Subtotal</span>
                                    <span>{`\u20b9${subtotal.toFixed(2)}`}</span>
                                </div>
                                <div className="bill-total-row">
                                    <span style={{ color: '#2E7D32' }}>Advance Paid</span>
                                    <span style={{ color: '#2E7D32', fontWeight: 600 }}>{`- \u20b9${parseFloat(order.advance_paid).toFixed(2)}`}</span>
                                </div>
                                <div className="gold-divider" style={{ margin: '8px 0' }} />
                                <div className="bill-total-row highlight">
                                    <span>Balance Due</span>
                                    <span>{`\u20b9${parseFloat(order.balance_amount).toFixed(2)}`}</span>
                                </div>
                            </div>

                            {/* Notes */}
                            {order.notes && (
                                <div className="bill-section" style={{ borderTop: '1px solid var(--gray-light)' }}>
                                    <span style={{ fontSize: 11, color: 'var(--gray)', fontStyle: 'italic' }}>
                                        Note: {order.notes}
                                    </span>
                                </div>
                            )}

                            {/* Dynamic UPI QR Code for Pending Balance */}
                            {parseFloat(order.balance_amount) > 0 && order.status !== 'Delivered' && (() => {
                                if (!isPremium) {
                                    return (
                                        <div className="bill-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderTop: '1px dashed var(--gray-light)', padding: '16px 0', borderBottom: '1px solid transparent' }}>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: '#E65100', marginBottom: 8, textAlign: 'center' }}>
                                                Pending Balance: {`\u20b9${parseFloat(order.balance_amount).toFixed(2)}`}
                                            </div>
                                            <div style={{ padding: '12px 18px', background: 'rgba(106,30,46,0.03)', border: '1px dashed var(--maroon)', borderRadius: 8, textAlign: 'center', maxWidth: 280 }}>
                                                <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--maroon-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                                    🔒 UPI QR Code Locked
                                                </div>
                                                <div style={{ fontSize: 10, color: 'var(--gray)', marginTop: 4 }}>
                                                    Dynamic UPI payment QR codes are a Premium feature. Upgrade to Premium in Boutique Settings to enable!
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                const shopUpi = order.shop_upi || auth?.upi_id || '8095284779@ybl';
                                const shopName = order.shop_name || 'SMART TAILOR';
                                return (
                                    <div className="bill-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderTop: '1px dashed var(--gray-light)', padding: '16px 0', borderBottom: '1px solid transparent' }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: '#E65100', marginBottom: 8, textAlign: 'center' }}>
                                            Pending Balance: {`\u20b9${parseFloat(order.balance_amount).toFixed(2)}`}
                                        </div>
                                        <div style={{ background: '#fff', padding: 8, borderRadius: 8, border: '1px solid var(--gray-light)' }}>
                                            <QRCode 
                                                value={`upi://pay?pa=${shopUpi}&pn=${encodeURIComponent(shopName)}&am=${parseFloat(order.balance_amount).toFixed(2)}&cu=INR`} 
                                                size={100} 
                                                level="L" 
                                            />
                                        </div>
                                        <div style={{ fontSize: 10, color: 'var(--gray)', marginTop: 8, textAlign: 'center' }}>
                                            Scan with PhonePe, GPay, or Paytm to pay
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Footer */}
                            <div style={{ background: 'var(--maroon-dark)', color: 'rgba(198,167,94,0.6)', textAlign: 'center', padding: '14px 20px', fontSize: 11, borderTop: '2px solid var(--gold)' }}>
                                <div style={{ fontWeight: 600, color: '#e5c158', marginBottom: 8, fontSize: 10, letterSpacing: '0.02em' }}>Note: We are not responsible for clothes left over 3 months.</div>
                                <div>Thank you for choosing {order.shop_name || 'SMART TAILOR'}!</div>
                                <div style={{ marginTop: 3, fontSize: 10 }}>This is a computer-generated receipt. No signature required.</div>
                            </div>
                        </div>

                        {/* Attached Images (Not Printed) */}
                        {images.length > 0 && (
                            <div className="no-print" style={{ marginTop: 24, background: '#fff', padding: 20, borderRadius: 12, border: '1px solid var(--gray-light)' }}>
                                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--maroon-dark)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <ImageIcon size={18} /> Reference Images
                                </h3>
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                    {images.map(img => (
                                        <div key={img.id}
                                            onClick={() => setPreviewImage(img.image_data)}
                                            style={{ width: 80, height: 80, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--gray-light)' }}>
                                            <img src={img.image_data} alt="Design Reference" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Voice Notes — Standalone Card (Not Printed) */}
                        {voiceNotes.length > 0 && (
                            <div className="no-print" style={{ marginTop: 24, background: '#fff', padding: 20, borderRadius: 12, border: '2px solid #FFCDD2' }}>
                                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#B71C1C', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Mic size={18} color="#D32F2F" /> Voice Instructions
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {voiceNotes.map((vn, idx) => (
                                        <div key={vn.id} style={{ background: '#FFEBEE', borderRadius: 10, padding: '10px 14px', border: '1px solid #FFCDD2' }}>
                                            <div style={{ fontSize: 12, color: '#B71C1C', marginBottom: 6, fontWeight: 600 }}>
                                                🎙️ Recording {voiceNotes.length > 1 ? `#${idx + 1}` : ''}
                                                {vn.duration ? ` · ${Math.floor(vn.duration / 60)}:${String(vn.duration % 60).padStart(2, '0')}` : ''}
                                            </div>
                                            <audio
                                                src={vn.audio_data}
                                                controls
                                                style={{ width: '100%', height: 40, outline: 'none', borderRadius: 8 }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Action buttons below bill */}
                        <div className="flex gap-8 mt-16 no-print" style={{ justifyContent: 'center' }}>
                            <button className="btn btn-outline" onClick={handleWhatsApp}><Share2 size={15} /> WhatsApp Bill</button>
                            <button className="btn btn-success" onClick={handleShareTracker} style={{ background: '#E8F5E9', color: '#1B5E20', borderColor: '#A5D6A7' }}>📍 Share Tracker</button>
                            <button className="btn btn-primary" onClick={handlePrint}><Printer size={15} /> Print / Save PDF</button>
                            {order.status === 'Delivered' && (
                                <button className="btn btn-outline" style={{ borderColor: '#2E7D32', color: '#2E7D32' }} onClick={handleWhatsAppReview}>
                                    <CheckCircle size={15} /> Request Review
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ── Order Summary Sidebar ───────────────── */}
                    <div className="bill-sidebar no-print">
                        <div className="card mb-16">
                            <div className="card-header">
                                <h3 className="card-title">Order Status</h3>
                            </div>
                            <div className="card-body">
                                {['Pending', 'Ready', 'Delivered'].map((s, i) => (
                                    <div key={s} className="flex gap-12" style={{ marginBottom: i < 2 ? 14 : 0, alignItems: 'center' }}>
                                        <div style={{
                                            width: 28, height: 28, borderRadius: '50%',
                                            background: order.status === s ? 'var(--gold)' : order.status === 'Delivered' && i < 2 ? 'var(--gold)' : order.status === 'Ready' && i < 1 ? 'var(--gold)' : 'var(--gray-light)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                        }}>
                                            {(order.status === s || (order.status === 'Delivered' && i < 2) || (order.status === 'Ready' && i < 1))
                                                ? <CheckCircle size={16} color="var(--maroon-dark)" />
                                                : <Clock size={14} color="var(--gray)" />}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: order.status === s ? 700 : 400 }}>{s}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="card mb-16">
                            <div className="card-header"><h3 className="card-title">Payment</h3></div>
                            <div className="card-body">
                                <div className="flex-between" style={{ marginBottom: 8 }}>
                                    <span style={{ color: 'var(--gray)', fontSize: 13 }}>Total</span>
                                    <strong>{`\u20b9${parseFloat(order.total_amount).toLocaleString('en-IN')}`}</strong>
                                </div>
                                <div className="flex-between" style={{ marginBottom: 8 }}>
                                    <span style={{ color: '#2E7D32', fontSize: 13 }}>Advance</span>
                                    <span style={{ color: '#2E7D32', fontWeight: 600 }}>{`\u20b9${parseFloat(order.advance_paid).toLocaleString('en-IN')}`}</span>
                                </div>
                                <div className="gold-divider" style={{ margin: '8px 0' }} />
                                <div className="flex-between">
                                    <span style={{ fontWeight: 700 }}>Balance</span>
                                    <strong style={{ fontSize: 18, color: parseFloat(order.balance_amount) > 0 ? '#E65100' : '#2E7D32' }}>
                                        {`\u20b9${parseFloat(order.balance_amount).toLocaleString('en-IN')}`}
                                    </strong>
                                </div>
                                {order.status !== 'Pending' && parseFloat(order.balance_amount) > 0 && (
                                    <button
                                        className="btn btn-primary mt-12 w-full"
                                        onClick={handleClearBalance}
                                        disabled={statusUpdating}
                                        style={{ width: '100%', marginTop: 16 }}
                                    >
                                        <CheckCircle size={15} /> Clear Balance
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header"><h3 className="card-title">Quick Links</h3></div>
                            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <Link to="/" className="btn btn-ghost" style={{ justifyContent: 'center' }}>Dashboard</Link>
                                <Link to="/new-order" className="btn btn-outline" style={{ justifyContent: 'center' }}>New Order</Link>
                                <Link to="/orders" className="btn btn-ghost" style={{ justifyContent: 'center' }}>All Orders</Link>
                                {order.order_id !== 'Offline Pending' && (
                                    <Link
                                        to={`/edit-order/${order.order_id}`}
                                        className="btn btn-outline"
                                        style={{ justifyContent: 'center', borderColor: 'var(--maroon)', color: 'var(--maroon)', fontWeight: 600 }}
                                    >
                                        <Edit2 size={14} /> Edit Bill
                                    </Link>
                                )}
                                {order.customer_id && (
                                    <Link to={`/customer/${order.customer_id}`} state={{ from: location.pathname }} className="btn btn-outline" style={{ justifyContent: 'center' }}>📏 Measurements</Link>
                                )}
                                {/* Collect Balance button — Razorpay if GST+Key set, else manual */}
                                {parseFloat(order.balance_amount) > 0 && order.status !== 'Delivered' && (
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleCollectBalance}
                                        disabled={processingRazorpay || statusUpdating}
                                        style={{ justifyContent: 'center', width: '100%', background: processingRazorpay ? undefined : 'linear-gradient(135deg,#2E7D32,#1B5E20)', borderColor: 'transparent', color: '#fff', boxShadow: '0 4px 12px rgba(46,125,50,0.25)' }}
                                    >
                                        {processingRazorpay ? (
                                            <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />&nbsp;Processing...</>
                                        ) : (
                                            <>💳 Collect ₹{parseFloat(order.balance_amount).toLocaleString('en-IN')}</>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
        @media print {
          .no-print { display: none !important; }
          .main-content { margin-left: 0 !important; }
          .sidebar { display: none !important; }
          .page-container { padding: 0 !important; }
          .topbar { display: none !important; }
          body { 
            background: white !important; 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
            text-rendering: optimizeLegibility !important;
            -webkit-font-smoothing: antialiased !important;
          }
          .bill-preview { box-shadow: none !important; max-width: 100% !important; border: none !important; }
        }
      `}</style>

            {/* Image Preview Modal */}
            {previewImage && (
                <div
                    onClick={() => setPreviewImage(null)}
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out' }}
                >
                    <img src={previewImage} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, objectFit: 'contain' }} />
                </div>
            )}
        </div>
    );
}
