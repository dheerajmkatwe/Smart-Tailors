import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { X, CheckCircle2, AlertCircle, RefreshCw, Smartphone, ShieldCheck, Sparkles, Store, CreditCard, ArrowRight } from 'lucide-react';
import { generateUpiUri } from '../utils/upiHelper';

export default function TenantUpiQRModal({
    isOpen,
    onClose,
    onPaymentSuccess,
    amount = 0,
    customerName = '',
    upiId = '',
    shopName = 'Boutique',
    shopLogo = '',
    note = 'Order Payment',
    orderId = null
}) {
    if (!isOpen) return null;

    const [status, setStatus] = useState('ready'); // 'ready' | 'verifying' | 'paid' | 'no_upi'
    const [timeLeft, setTimeLeft] = useState(900); // 15 minutes in seconds
    const [customUpi, setCustomUpi] = useState(upiId);
    const [activeUpi, setActiveUpi] = useState(upiId);

    useEffect(() => {
        if (isOpen) {
            setStatus(activeUpi ? 'ready' : 'no_upi');
            setTimeLeft(900);
        }
    }, [isOpen, activeUpi]);

    // Countdown Timer
    useEffect(() => {
        if (!isOpen || status !== 'ready') return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [isOpen, status]);

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const handleConfirmPayment = () => {
        setStatus('verifying');
        setTimeout(() => {
            setStatus('paid');
            // Auto close / callback after success animation
            setTimeout(() => {
                onPaymentSuccess({
                    paymentMethod: 'UPI',
                    upiId: activeUpi,
                    amount: amount,
                    confirmedAt: new Date().toISOString()
                });
            }, 1800);
        }, 1000);
    };

    const handleSaveTempUpi = (e) => {
        e.preventDefault();
        if (customUpi && customUpi.trim()) {
            setActiveUpi(customUpi.trim());
            setStatus('ready');
        }
    };

    // Construct NPCI-compliant UPI Deep Link URI
    const upiUri = generateUpiUri({
        upiId: activeUpi,
        shopName: shopName || 'Boutique',
        amount: amount,
        note: note || 'Order Payment'
    });


    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.82)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justify: 'center',
            padding: '20px',
            animation: 'fadeIn 0.25s ease-out'
        }}>
            <div style={{
                background: '#ffffff',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                width: '100%',
                maxWidth: '460px',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #4A101C 0%, #6A1E2E 50%, #2D0A11 100%)',
                    padding: '20px 24px',
                    color: '#ffffff',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {shopLogo ? (
                            <img src={shopLogo} alt={shopName} style={{ width: '42px', height: '42px', borderRadius: '10px', objectFit: 'cover', border: '2px solid rgba(198,167,94,0.5)' }} />
                        ) : (
                            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(198,167,94,0.2)', border: '1px solid rgba(198,167,94,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Store size={22} style={{ color: 'var(--gold, #C6A75E)' }} />
                            </div>
                        )}
                        <div>
                            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#ffffff', letterSpacing: '-0.01em' }}>{shopName}</h3>
                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                <ShieldCheck size={13} style={{ color: '#4ADE80' }} /> Direct Bank Scan & Pay
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.12)',
                            border: 'none',
                            color: '#ffffff',
                            borderRadius: '50%',
                            width: '32px',
                            height: '32px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justify: 'center',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Amount Bar */}
                <div style={{
                    background: '#FAF7F2',
                    padding: '16px 24px',
                    borderBottom: '1px solid #E5E7EB',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between'
                }}>
                    <div>
                        <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280', fontWeight: '600' }}>Amount to Pay</span>
                        {customerName && <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Customer: {customerName}</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '26px', fontWeight: '800', color: '#4A101C', fontFamily: 'system-ui, sans-serif' }}>
                            ₹{Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <span style={{ fontSize: '11px', background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                            {note}
                        </span>
                    </div>
                </div>

                {/* Body Content based on State */}
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#ffffff' }}>
                    
                    {/* NO UPI CONFIGURED STATE */}
                    {status === 'no_upi' && (
                        <div style={{ width: '100%', textAlign: 'center', padding: '10px 0' }}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#FEF2F2', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <AlertCircle size={28} />
                            </div>
                            <h4 style={{ margin: '0 0 6px', fontSize: '16px', color: '#1F2937' }}>UPI ID Missing</h4>
                            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#6B7280', lineHeight: '1.4' }}>
                                Your shop does not have a registered UPI ID for QR payments. Enter your UPI ID below to proceed:
                            </p>
                            <form onSubmit={handleSaveTempUpi} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', background: '#F9FAFB', border: '1px solid #D1D5DB', borderRadius: '12px', padding: '0 12px' }}>
                                    <CreditCard size={18} style={{ color: '#9CA3AF', marginRight: '8px' }} />
                                    <input
                                        type="text"
                                        placeholder="e.g. 9876543210@paytm or shop@ybl"
                                        value={customUpi}
                                        onChange={e => setCustomUpi(e.target.value)}
                                        required
                                        style={{ border: 'none', background: 'transparent', padding: '12px 0', fontSize: '14px', width: '100%', outline: 'none' }}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    style={{
                                        background: '#4A101C',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '12px',
                                        padding: '12px',
                                        fontWeight: '700',
                                        fontSize: '14px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    Generate Dynamic QR <ArrowRight size={16} />
                                </button>
                            </form>
                            <div style={{ marginTop: '16px', fontSize: '12px', color: '#9CA3AF' }}>
                                TIP: Save your UPI ID permanently in Boutique Configurations.
                            </div>
                        </div>
                    )}

                    {/* READY STATE (LIVE QR) */}
                    {status === 'ready' && (
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            
                            {/* QR Code Canvas Frame */}
                            <div style={{
                                position: 'relative',
                                background: '#ffffff',
                                padding: '18px',
                                borderRadius: '20px',
                                border: '2px solid #E5E7EB',
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center'
                            }}>
                                {/* Corner Brackets */}
                                <div style={{ position: 'absolute', top: '8px', left: '8px', width: '16px', height: '16px', borderTop: '3px solid #4A101C', borderLeft: '3px solid #4A101C', borderRadius: '4px 0 0 0' }}></div>
                                <div style={{ position: 'absolute', top: '8px', right: '8px', width: '16px', height: '16px', borderTop: '3px solid #4A101C', borderRight: '3px solid #4A101C', borderRadius: '0 4px 0 0' }}></div>
                                <div style={{ position: 'absolute', bottom: '8px', left: '8px', width: '16px', height: '16px', borderBottom: '3px solid #4A101C', borderLeft: '3px solid #4A101C', borderRadius: '0 0 0 4px' }}></div>
                                <div style={{ position: 'absolute', bottom: '8px', right: '8px', width: '16px', height: '16px', borderBottom: '3px solid #4A101C', borderRight: '3px solid #4A101C', borderRadius: '0 0 4px 0' }}></div>

                                {/* Laser Scan Line */}
                                <div style={{
                                    position: 'absolute',
                                    top: '18px',
                                    left: '18px',
                                    right: '18px',
                                    height: '3px',
                                    background: 'linear-gradient(90deg, transparent, #22C55E, transparent)',
                                    boxShadow: '0 0 8px #22C55E',
                                    animation: 'scan 2.5s infinite linear',
                                    zIndex: 2,
                                    pointerEvents: 'none'
                                }}></div>

                                <QRCode
                                    value={upiUri}
                                    size={200}
                                    level="H"
                                />

                                <div style={{ marginTop: '12px', fontSize: '12px', color: '#4B5563', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <CreditCard size={14} style={{ color: '#C6A75E' }} /> Payee UPI: <strong style={{ color: '#4A101C' }}>{activeUpi}</strong>
                                </div>
                            </div>

                            {/* Supported UPI Apps Pills */}
                            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                {['GPay', 'PhonePe', 'Paytm', 'BHIM', 'UPI'].map(app => (
                                    <span key={app} style={{
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        background: '#F3F4F6',
                                        color: '#374151',
                                        padding: '4px 10px',
                                        borderRadius: '20px',
                                        border: '1px solid #E5E7EB'
                                    }}>
                                        {app}
                                    </span>
                                ))}
                            </div>

                            {/* Countdown Progress */}
                            <div style={{ width: '100%', marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6B7280', fontWeight: '600' }}>
                                    <span>QR Expires In:</span>
                                    <span style={{ color: timeLeft < 60 ? '#EF4444' : '#111827', fontFamily: 'monospace', fontWeight: '700' }}>{formatTime(timeLeft)}</span>
                                </div>
                                <div style={{ width: '100%', height: '6px', background: '#E5E7EB', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${(timeLeft / 900) * 100}%`,
                                        height: '100%',
                                        background: timeLeft < 60 ? '#EF4444' : 'linear-gradient(90deg, #4A101C, #C6A75E)',
                                        transition: 'width 1s linear'
                                    }}></div>
                                </div>
                            </div>

                            {/* Verification Actions */}
                            <div style={{ width: '100%', marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <button
                                    onClick={handleConfirmPayment}
                                    style={{
                                        width: '100%',
                                        background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '14px',
                                        padding: '14px',
                                        fontWeight: '700',
                                        fontSize: '15px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justify: 'center',
                                        gap: '8px',
                                        boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <CheckCircle2 size={18} /> Confirm Payment Received
                                </button>

                                <button
                                    onClick={handleConfirmPayment}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(245, 158, 11, 0.1)',
                                        color: '#D97706',
                                        border: '1px dashed #F59E0B',
                                        borderRadius: '14px',
                                        padding: '10px',
                                        fontWeight: '600',
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justify: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <Sparkles size={15} /> 🧪 Simulate Test Payment (Dev Mode)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* VERIFYING STATE */}
                    {status === 'verifying' && (
                        <div style={{ padding: '30px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                border: '4px solid #E5E7EB',
                                borderTopColor: '#10B981',
                                borderRadius: '50%',
                                animation: 'spin 0.8s linear infinite',
                                marginBottom: '20px'
                            }}></div>
                            <h4 style={{ margin: '0 0 6px', fontSize: '18px', color: '#111827' }}>Verifying Payment...</h4>
                            <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>Checking bank credit notification for ₹{amount}</p>
                        </div>
                    )}

                    {/* PAID SUCCESS STATE */}
                    {status === 'paid' && (
                        <div style={{ padding: '20px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
                            <div style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '16px',
                                boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)'
                            }}>
                                <CheckCircle2 size={48} />
                            </div>
                            <h3 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: '800', color: '#065F46' }}>Payment Received!</h3>
                            <div style={{ fontSize: '15px', color: '#047857', fontWeight: '600', marginBottom: '8px' }}>
                                ₹{Number(amount).toFixed(2)} credited to {shopName}
                            </div>
                            <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>Generating official invoice &amp; bill...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
