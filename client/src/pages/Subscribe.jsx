import React, { useState, useEffect } from 'react';
import { Crown, Check, X, Sparkles, Key, Gift, Scissors, CreditCard, MessageSquare, ExternalLink } from 'lucide-react';
import QRCode from 'react-qr-code';
import toast from 'react-hot-toast';
import api from '../api/axios';

export default function Subscribe({ onMenuClick }) {
    const [auth, setAuth] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('tailor_auth') || '{}');
        } catch {
            return {};
        }
    });

    const isPremium = auth?.isPremiumActive;
    const currentSub = auth?.subscription_type || 'Free';
    // isPaidPremium = true ONLY when actually on a paid plan (not free trial)
    const isPaidPremium = isPremium && (currentSub === 'Monthly' || currentSub === 'Yearly');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLatestProfile = async () => {
            try {
                const res = await api.get('/auth/profile');
                const profile = res.data;
                
                // Fetch latest premium status details
                const statusRes = await api.get('/auth/premium-status');
                
                const updated = {
                    ...auth,
                    shop_name: profile.shop_name,
                    name: profile.admin_name,
                    upi_id: profile.upi_id || '',
                    gst_id: profile.gst_id || '',
                    phone_number: profile.phone_number || '',
                    address: profile.address || '',
                    isPremiumActive: statusRes.data.isPremiumActive,
                    subscription_type: statusRes.data.subscription_type,
                    created_at: statusRes.data.created_at
                };
                
                setAuth(updated);
                localStorage.setItem('tailor_auth', JSON.stringify(updated));
            } catch (err) {
                console.error('Failed to sync profile status:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchLatestProfile();
    }, []);

    const [activationKey, setActivationKey] = useState('');
    const [activationPin, setActivationPin] = useState('');
    const [activating, setActivating] = useState(false);
    const [checkoutPlan, setCheckoutPlan] = useState(null); // 'monthly' or 'yearly'
    const [freeHovered, setFreeHovered] = useState(false);
    const [monthlyHovered, setMonthlyHovered] = useState(false);
    const [yearlyHovered, setYearlyHovered] = useState(false);
    const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
    const [activatedTier, setActivatedTier] = useState('');
    const [showPendingSuccess, setShowPendingSuccess] = useState(false);
    const [markingAsPaid, setMarkingAsPaid] = useState(false);
    const [processingRazorpay, setProcessingRazorpay] = useState(false);

    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            if (window.Razorpay) {
                resolve(true);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const handleRazorpayCheckout = async () => {
        setProcessingRazorpay(true);
        try {
            // 1. Create order on backend
            const orderRes = await api.post('/auth/razorpay-create-order', { plan: checkoutPlan });
            const { order_id, amount, currency, key } = orderRes.data;

            // 2. Load script
            const loaded = await loadRazorpayScript();
            if (!loaded) {
                toast.error('Failed to load payment gateway. Please check your network connection.');
                setProcessingRazorpay(false);
                return;
            }

            // 3. Open Razorpay Checkout modal
            const options = {
                key: key,
                amount: amount,
                currency: currency,
                name: 'SMART TAILOR PREMIUM',
                description: `Upgrade to Premium ${checkoutPlan === 'yearly' ? 'Yearly' : 'Monthly'} Plan`,
                order_id: order_id,
                prefill: {
                    name: auth?.name || '',
                    contact: auth?.phone_number || ''
                },
                theme: {
                    color: '#6A1E2E'
                },
                handler: async function (response) {
                    setActivating(true);
                    try {
                        const verifyRes = await api.post('/auth/razorpay-verify-payment', {
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_signature: response.razorpay_signature,
                            plan: checkoutPlan
                        });

                        setActivatedTier(verifyRes.data.subscription_type || 'Premium');
                        setShowSuccessOverlay(true);
                        setCheckoutPlan(null);

                        // Sync local storage
                        const updated = { 
                            ...auth, 
                            isPremiumActive: true, 
                            subscription_type: verifyRes.data.subscription_type 
                        };
                        localStorage.setItem('tailor_auth', JSON.stringify(updated));

                        setTimeout(() => {
                            window.location.reload();
                        }, 4500);
                    } catch (err) {
                        toast.error('Payment verification failed. Please contact support.');
                    } finally {
                        setActivating(false);
                    }
                },
                modal: {
                    ondismiss: function () {
                        setProcessingRazorpay(false);
                    }
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.open();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to initialize payment gateway.');
            setProcessingRazorpay(false);
        }
    };

    const handleActivateSmartPass = async (e) => {
        e.preventDefault();
        if (!activationKey.trim() || !activationPin.trim()) {
            toast.error('Both Gift Pass Key and Security PIN are required.');
            return;
        }
        setActivating(true);
        try {
            const res = await api.post('/auth/activate-subscription', {
                key: activationKey.trim().toUpperCase(),
                pin: activationPin.trim()
            });
            setActivatedTier(res.data.subscription_type || 'Premium');
            setShowSuccessOverlay(true);
            setActivationKey('');
            setActivationPin('');
            
            // Sync local storage
            const updated = { 
                ...auth, 
                isPremiumActive: true, 
                subscription_type: res.data.subscription_type 
            };
            localStorage.setItem('tailor_auth', JSON.stringify(updated));
            
            setTimeout(() => {
                window.location.reload();
            }, 4500);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Verification failed. Please check your credentials.');
        } finally {
            setActivating(false);
        }
    };
    const handleMarkAsPaid = async () => {
        if (!checkoutPlan) return;
        setMarkingAsPaid(true);
        try {
            await api.post('/auth/request-subscription', { plan: checkoutPlan });
            setCheckoutPlan(null);
            setShowPendingSuccess(true);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to submit payment request. Please contact support.');
        } finally {
            setMarkingAsPaid(false);
        }
    };

    const premiumFeatures = [
        "Create unlimited orders & customers monthly",
        "Add custom extra blouse & chudhidhar measurement columns",
        "Generate custom UPI payment QR codes on bills & receipts",
        "Upload unlimited design references & voice recording notes",
        "Remove Smart Tailor billing watermarks entirely",
        "Access Yearly & All-Time analytics dashboard reports",
        "View complete monthly records history with full filters",
        "Premium support & database cloud backup"
    ];

    const freeLimits = [
        "Limited to 30 orders per month",
        "No custom chudhidhar / blouse measurement rows",
        "Locked dynamic UPI payment QR codes",
        "Limited to 1 image & 1 voice note per order",
        "Smart Tailor watermarks printed on bills",
        "Locked Yearly & All-Time analytics sections",
        "Limited to viewing only current month's record"
    ];

    // Build the WhatsApp message payload for manual validation
    const getWhatsAppUrl = () => {
        if (!checkoutPlan) return '#';
        const planName = checkoutPlan === 'monthly' ? 'Monthly Pass (₹250)' : 'Yearly Pass (₹2,000)';
        const amount = checkoutPlan === 'monthly' ? '250' : '2000';
        
        const message = `Hello Smart Tailor Support! 🌟\n\nI have completed the payment of ₹${amount} for the Premium ${planName} subscription.\n\nShop Details:\n- Shop Username/Phone: ${auth?.tenant_id || 'N/A'}\n- Shop Name: ${auth?.shop_name || 'N/A'}\n- Admin Name: ${auth?.name || 'N/A'}\n- Chosen Plan: ${planName}\n\nHere is my payment transaction screenshot. Please generate my 12-digit Activation Key and Security PIN!`;
        
        return `https://wa.me/918095284779?text=${encodeURIComponent(message)}`;
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: '16px', color: 'var(--maroon-dark)' }}>
                <Scissors size={40} className="animate-spin" style={{ color: 'var(--gold)', opacity: 0.8 }} />
                <h3 style={{ fontFamily: '"Playfair Display", serif', fontSize: '18px', fontWeight: '500', margin: 0 }}>
                    Synchronizing Subscription Profile...
                </h3>
            </div>
        );
    }

    return (
        <div className="page-container animate-fade-in" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: '"Outfit", "Inter", sans-serif' }}>
            <header className="page-header" style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button className="menu-toggle-btn" onClick={onMenuClick} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <Scissors size={20} style={{ color: 'var(--maroon)' }} />
                </button>
                <div>
                    <h1 style={{ fontFamily: '"Playfair Display", serif', color: 'var(--maroon-dark)', margin: 0, fontSize: '28px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Premium Membership Plans <Sparkles size={22} style={{ color: '#d4af37' }} />
                    </h1>
                    <p style={{ color: 'var(--gray)', margin: '4px 0 0', fontSize: '14px' }}>
                        Unlock luxury features, premium metrics, unlimited receipts, and high-performance cloud tools.
                    </p>
                </div>
            </header>

            {/* Premium Header Banner */}
            <div style={{
                background: 'linear-gradient(135deg, #4A101C 0%, #6A1E2E 50%, #8E2B3D 100%)',
                color: '#FAF7F2',
                borderRadius: '16px',
                padding: '32px',
                marginBottom: '32px',
                boxShadow: '0 8px 30px rgba(106,30,46,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '24px',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{
                    position: 'absolute', right: '-50px', top: '-50px', opacity: 0.1,
                    fontSize: '180px', pointerEvents: 'none', fontFamily: '"Playfair Display", serif'
                }}>ST</div>
                
                <div style={{ flex: '1', minWidth: '280px', zIndex: 1 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(212, 175, 55, 0.18)', border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', color: '#ffd54f', fontWeight: 'bold', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <Crown size={12} /> {isPremium ? `Active Plan: Premium ${currentSub}` : 'Trial / Smart Tailor Free Plan'}
                    </div>
                    <h2 style={{ fontSize: '26px', fontFamily: '"Playfair Display", serif', margin: '0 0 8px 0', fontWeight: 'normal', color: '#FFF' }}>
                        {isPremium ? 'Congratulations on Premium Status!' : 'Transform your Boutique with Premium Smart Pass'}
                    </h2>
                    <p style={{ fontSize: '14px', color: 'rgba(250,247,242,0.8)', margin: 0, lineHeight: '1.5' }}>
                        {isPremium 
                            ? 'Your premium access is fully active. Enjoy full support, unlimited databases, custom configurations, and automated watermarks deletion.'
                            : 'All new tailoring registries automatically receive 30 days of premium trial features. After trial, upgrade with a professional Smart Pass.'}
                    </p>
                </div>

                {isPremium && (
                    <div style={{
                        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '12px', padding: '16px 24px', textAlign: 'center', zIndex: 1
                    }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.5px' }}>Current Status</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffd54f', marginTop: '4px' }}>✨ Premium Active</div>
                    </div>
                )}
            </div>

            {/* Three Plans side-by-side */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '40px' }}>
                
                {/* 1. Free Plan Card */}
                <div 
                    className="card animate-fade-in" 
                    onMouseEnter={() => setFreeHovered(true)}
                    onMouseLeave={() => setFreeHovered(false)}
                    style={{
                        padding: '28px', display: 'flex', flexDirection: 'column',
                        background: '#fff', position: 'relative',
                        borderRadius: '12px',
                        transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                        transform: freeHovered ? 'translateY(-8px) scale(1.02)' : 'translateY(0) scale(1)',
                        border: freeHovered ? '2px solid #ccc' : '1px solid #eaeaea',
                        boxShadow: freeHovered ? '0 15px 30px rgba(0,0,0,0.08)' : '0 4px 12px rgba(0,0,0,0.01)'
                    }}
                >
                    <h3 style={{ fontSize: '20px', color: 'var(--maroon-dark)', margin: '0 0 4px 0', fontFamily: '"Playfair Display", serif' }}>
                        Smart Tailor Free Plan
                    </h3>
                    <p style={{ fontSize: '12.5px', color: 'var(--gray)', margin: '0 0 20px 0' }}>
                        Ideal for small/starting boutiques or workers tracking basic metrics.
                    </p>
                    
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '24px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
                        <span style={{ fontSize: '32px', fontWeight: '800', color: 'var(--maroon-dark)' }}>₹0</span>
                        <span style={{ fontSize: '13px', color: 'var(--gray)' }}>/ month</span>
                    </div>

                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                        {freeLimits.map((lim, idx) => (
                            <li key={idx} style={{ display: 'flex', gap: '10px', fontSize: '13px', color: '#777', alignItems: 'flex-start', lineHeight: 1.4 }}>
                                <X size={14} style={{ color: '#ef5350', flexShrink: 0, marginTop: '2px' }} />
                                <span>{lim}</span>
                            </li>
                        ))}
                    </ul>

                    <button disabled style={{
                        width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd',
                        background: '#f8f9fa', color: '#aaa', fontWeight: 'bold', fontSize: '14px', cursor: 'not-allowed'
                    }}>
                        {!isPremium ? 'Active Plan' : 'Free Tier Inactive'}
                    </button>
                </div>

                {/* 2. Monthly Premium Pass Card */}
                <div 
                    className="card animate-fade-in" 
                    onMouseEnter={() => setMonthlyHovered(true)}
                    onMouseLeave={() => setMonthlyHovered(false)}
                    style={{
                        padding: '28px', display: 'flex', flexDirection: 'column',
                        background: '#fff', position: 'relative',
                        borderRadius: '12px',
                        transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                        transform: monthlyHovered ? 'translateY(-8px) scale(1.02)' : 'translateY(0) scale(1)',
                        border: monthlyHovered ? '2px solid var(--maroon)' : '1px solid #d4af37',
                        boxShadow: monthlyHovered ? '0 20px 35px rgba(106,30,46,0.15)' : '0 4px 20px rgba(0,0,0,0.02)'
                    }}
                >
                    <h3 style={{ fontSize: '20px', color: 'var(--maroon-dark)', margin: '0 0 4px 0', fontFamily: '"Playfair Display", serif', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Monthly Premium Pass <Crown size={16} style={{ color: '#d4af37' }} />
                    </h3>
                    <p style={{ fontSize: '12.5px', color: 'var(--gray)', margin: '0 0 20px 0' }}>
                        Unlimited orders, billing customization, and advanced tailoring analytics.
                    </p>
                    
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '24px', borderBottom: '1px solid rgba(212,175,55,0.2)', paddingBottom: '20px' }}>
                        <span style={{ fontSize: '32px', fontWeight: '800', color: 'var(--maroon-dark)' }}>₹250</span>
                        <span style={{ fontSize: '13px', color: 'var(--gray)' }}>/ month</span>
                    </div>

                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                        {premiumFeatures.map((feat, idx) => (
                            <li key={idx} style={{ display: 'flex', gap: '10px', fontSize: '13px', color: 'var(--maroon-dark)', alignItems: 'flex-start', lineHeight: 1.4, fontWeight: '500' }}>
                                <Check size={14} style={{ color: '#2E7D32', flexShrink: 0, marginTop: '1px' }} />
                                <span>{feat}</span>
                            </li>
                        ))}
                    </ul>

                    {currentSub === 'Monthly' ? (
                        <button 
                            onClick={() => setCheckoutPlan('monthly')}
                            className="btn btn-secondary"
                            style={{
                                width: '100%', padding: '12px', borderRadius: '8px',
                                background: 'linear-gradient(135deg, #2E7D32 0%, #1B5E20 100%)',
                                color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '14px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                cursor: 'pointer', boxShadow: '0 4px 10px rgba(46,125,50,0.1)'
                            }}
                        >
                            <CreditCard size={15} strokeWidth={2} /> Extend Monthly Pass (Current)
                        </button>
                    ) : (
                        <button 
                            onClick={() => setCheckoutPlan('monthly')}
                            className="btn btn-secondary"
                            style={{
                                width: '100%', padding: '12px', borderRadius: '8px',
                                background: 'linear-gradient(135deg, #6A1E2E 0%, #4A101C 100%)',
                                color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '14px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                cursor: 'pointer', boxShadow: '0 4px 10px rgba(106,30,46,0.1)'
                            }}
                        >
                            <CreditCard size={15} /> Purchase Monthly Pass
                        </button>
                    )}
                </div>

                {/* 3. Yearly Premium Pass Card */}
                <div 
                    className="card animate-fade-in" 
                    onMouseEnter={() => setYearlyHovered(true)}
                    onMouseLeave={() => setYearlyHovered(false)}
                    style={{
                        padding: '28px', display: 'flex', flexDirection: 'column',
                        border: '2px solid #d4af37', background: 'linear-gradient(180deg, rgba(212,175,55,0.03) 0%, rgba(255,255,255,1) 100%)',
                        position: 'relative', borderRadius: '12px',
                        transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                        transform: yearlyHovered ? 'translateY(-10px) scale(1.03)' : 'translateY(0) scale(1)',
                        boxShadow: yearlyHovered ? '0 25px 40px rgba(212,175,55,0.2)' : '0 10px 30px rgba(212,175,55,0.08)'
                    }}
                >
                    <div style={{
                        position: 'absolute', top: '14px', right: '14px',
                        background: 'linear-gradient(135deg, #2E7D32 0%, #1B5E20 100%)',
                        color: '#fff', fontSize: '10.5px', fontWeight: 'bold',
                        padding: '4px 10px', borderRadius: '12px', textTransform: 'uppercase', letterSpacing: '0.5px'
                    }}>
                        Save 33% (Best Deal)
                    </div>

                    <h3 style={{ fontSize: '20px', color: 'var(--maroon-dark)', margin: '0 0 4px 0', fontFamily: '"Playfair Display", serif', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Yearly Premium Pass <Crown size={16} style={{ color: '#d4af37' }} />
                    </h3>
                    <p style={{ fontSize: '12.5px', color: 'var(--gray)', margin: '0 0 20px 0' }}>
                        Complete full premium package for an entire year. Includes prioritized support.
                    </p>
                    
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '24px', borderBottom: '1px solid rgba(212,175,55,0.3)', paddingBottom: '20px' }}>
                        <span style={{ fontSize: '32px', fontWeight: '800', color: 'var(--maroon-dark)' }}>₹2,000</span>
                        <span style={{ fontSize: '13px', color: 'var(--gray)' }}>/ year</span>
                    </div>

                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                        <li style={{ display: 'flex', gap: '10px', fontSize: '13px', color: 'var(--maroon-dark)', alignItems: 'flex-start', lineHeight: 1.4, fontWeight: 'bold' }}>
                            <Check size={14} style={{ color: '#2E7D32', flexShrink: 0, marginTop: '1px' }} />
                            <span>⭐ Save ₹1,000 relative to monthly renewals</span>
                        </li>
                        <li style={{ display: 'flex', gap: '10px', fontSize: '13px', color: 'var(--maroon-dark)', alignItems: 'flex-start', lineHeight: 1.4, fontWeight: 'bold' }}>
                            <Crown size={14} style={{ color: '#d4af37', flexShrink: 0, marginTop: '1px' }} />
                            <span>👑 Multi-Branch &amp; Chain Boutique Support</span>
                        </li>
                        {premiumFeatures.map((feat, idx) => (
                            <li key={idx} style={{ display: 'flex', gap: '10px', fontSize: '13px', color: 'var(--maroon-dark)', alignItems: 'flex-start', lineHeight: 1.4, fontWeight: '500' }}>
                                <Check size={14} style={{ color: '#2E7D32', flexShrink: 0, marginTop: '1px' }} />
                                <span>{feat}</span>
                            </li>
                        ))}
                    </ul>

                    {currentSub === 'Yearly' ? (
                        <button 
                            onClick={() => setCheckoutPlan('yearly')}
                            className="btn btn-secondary"
                            style={{
                                width: '100%', padding: '12px', borderRadius: '8px',
                                background: 'linear-gradient(135deg, #2E7D32 0%, #1B5E20 100%)',
                                color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '14px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                cursor: 'pointer', boxShadow: '0 4px 15px rgba(46,125,50,0.15)'
                            }}
                        >
                            <Crown size={15} strokeWidth={2} /> Extend Yearly Pass (Current)
                        </button>
                    ) : currentSub === 'Monthly' ? (
                        <button 
                            onClick={() => setCheckoutPlan('yearly')}
                            className="btn btn-secondary"
                            style={{
                                width: '100%', padding: '12px', borderRadius: '8px',
                                background: 'linear-gradient(135deg, #d4af37 0%, #b89418 100%)',
                                color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '14px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                cursor: 'pointer', boxShadow: '0 4px 15px rgba(212,175,55,0.15)'
                            }}
                        >
                            <Sparkles size={15} /> Upgrade to Yearly Pass ✨
                        </button>
                    ) : (
                        <button 
                            onClick={() => setCheckoutPlan('yearly')}
                            className="btn btn-secondary"
                            style={{
                                width: '100%', padding: '12px', borderRadius: '8px',
                                background: 'linear-gradient(135deg, #d4af37 0%, #b89418 100%)',
                                color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '14px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                cursor: 'pointer', boxShadow: '0 4px 15px rgba(212,175,55,0.15)'
                            }}
                        >
                            <CreditCard size={15} /> Purchase Yearly Pass
                        </button>
                    )}
                </div>
            </div>

            {/* Smart Pass Activation Panel */}
            {!isPremium && (
                <div className="card animate-fade-in" style={{
                    padding: '32px', border: '1px solid var(--gold-pale)',
                    background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.04) 0%, rgba(255,255,255,1) 100%)',
                    boxShadow: '0 8px 24px rgba(106,30,46,0.04)', maxWidth: '600px', margin: '0 auto',
                    borderRadius: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid rgba(212,175,55,0.2)', paddingBottom: '14px' }}>
                        <Gift size={22} style={{ color: '#d4af37' }} />
                        <div>
                            <h3 style={{ fontSize: '18px', color: 'var(--maroon-dark)', margin: 0, fontFamily: '"Playfair Display", serif' }}>
                                Redeem Premium Smart Pass
                            </h3>
                            <p style={{ fontSize: '12px', color: 'var(--gray)', margin: '2px 0 0 0' }}>
                                Enter the 12-char Smart Pass key and 6-digit PIN shared on your WhatsApp after payment.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleActivateSmartPass}>
                        <div className="form-group mb-16">
                            <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Smart Pass Key (12 Characters)</label>
                            <div className="input-prefix">
                                <span className="prefix-symbol"><Gift size={16} /></span>
                                <input
                                    type="text"
                                    placeholder="Enter 12-digit key"
                                    value={activationKey}
                                    onChange={e => setActivationKey(e.target.value)}
                                    maxLength={12}
                                    required
                                    style={{ border: 'none', background: 'transparent', textTransform: 'uppercase', letterSpacing: '1px' }}
                                />
                            </div>
                        </div>

                        <div className="form-group mb-20">
                            <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Security PIN (6 Digits)</label>
                            <div className="input-prefix">
                                <span className="prefix-symbol"><Key size={16} /></span>
                                <input
                                    type="password"
                                    placeholder="Enter 6-digit PIN"
                                    value={activationPin}
                                    onChange={e => setActivationPin(e.target.value)}
                                    maxLength={6}
                                    required
                                    style={{ border: 'none', background: 'transparent', letterSpacing: '2px' }}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-secondary"
                            style={{
                                width: '100%', justifyContent: 'center', padding: '14px',
                                background: 'linear-gradient(135deg, #6A1E2E 0%, #4A101C 100%)',
                                color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '14.5px',
                                borderRadius: '8px', boxShadow: '0 4px 15px rgba(106,30,46,0.15)'
                            }}
                            disabled={activating}
                        >
                            <Crown size={16} style={{ marginRight: 8 }} />
                            {activating ? 'Verifying Pass...' : 'Activate Premium Membership'}
                        </button>
                    </form>
                </div>
            )}

            {/* Premium Interactive Checkout Modal */}
            {checkoutPlan && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(74, 16, 28, 0.45)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, padding: '16px', animation: 'fadeIn 0.25s ease'
                }}>
                    <div style={{
                        background: '#FAF7F2', borderRadius: '16px', border: '2px solid #d4af37',
                        padding: '32px', maxWidth: '480px', width: '100%', position: 'relative',
                        boxShadow: '0 20px 50px rgba(74, 16, 28, 0.25)', animation: 'slideUp 0.3s ease',
                        maxHeight: '90vh', overflowY: 'auto'
                    }}>
                        {/* Close button */}
                        <button 
                            onClick={() => setCheckoutPlan(null)}
                            style={{
                                position: 'absolute', top: '16px', right: '16px', background: 'none',
                                border: 'none', cursor: 'pointer', color: 'var(--maroon-dark)', opacity: 0.7
                            }}
                        >
                            <X size={20} />
                        </button>

                        {auth?.gst_id ? (
                            /* ─── Razorpay Automated Checkout View ─── */
                            <div>
                                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                    <div style={{
                                        width: '50px', height: '50px', borderRadius: '50%',
                                        background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.4)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        margin: '0 auto 12px', color: '#d4af37'
                                    }}>
                                        <Crown size={24} />
                                    </div>
                                    <h3 style={{ fontSize: '20px', fontFamily: '"Playfair Display", serif', color: 'var(--maroon-dark)', margin: '0 0 6px 0' }}>
                                        Automated GST Payment
                                    </h3>
                                    <p style={{ fontSize: '13px', color: 'var(--gray)', margin: 0 }}>
                                        GST Registered Shop detected. Paying securely via Razorpay Payment Gateway.
                                    </p>
                                </div>

                                <div style={{
                                    background: 'rgba(46, 125, 50, 0.04)', border: '1px solid rgba(46, 125, 50, 0.15)',
                                    borderRadius: '10px', padding: '14px 18px', display: 'flex',
                                    justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '13.5px', fontWeight: 'bold', color: '#2E7D32' }}>
                                            Premium {checkoutPlan === 'monthly' ? 'Monthly Pass' : 'Yearly Pass'}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--gray)', marginTop: '2px' }}>
                                            GSTIN: <strong style={{ color: 'var(--maroon)' }}>{auth.gst_id.toUpperCase()}</strong>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#2E7D32' }}>
                                        ₹{checkoutPlan === 'monthly' ? '250' : '2,000'}
                                    </div>
                                </div>

                                <div style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    background: '#fff', border: '1px solid #eaeaea', borderRadius: '12px',
                                    padding: '24px 16px', marginBottom: '24px', textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--maroon-dark)', marginBottom: '8px' }}>
                                        Instant Premium Activation ⚡
                                    </div>
                                    <p style={{ fontSize: '12px', color: 'var(--gray)', margin: 0, lineHeight: 1.4 }}>
                                        Razorpay will process your credit/debit card, UPI, netbanking or wallet securely. Once successfully paid, your Premium membership will be unlocked instantly!
                                    </p>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <button 
                                        onClick={handleRazorpayCheckout}
                                        disabled={processingRazorpay || activating}
                                        className="btn btn-secondary"
                                        style={{
                                            width: '100%', padding: '14px', borderRadius: '8px',
                                            background: 'linear-gradient(135deg, #6A1E2E 0%, #4A101C 100%)',
                                            color: '#fff', border: 'none',
                                            fontWeight: 'bold', fontSize: '14.5px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                            boxShadow: '0 4px 15px rgba(106,30,46,0.15)', cursor: (processingRazorpay || activating) ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        <CreditCard size={16} /> {processingRazorpay ? 'Opening Gateway...' : activating ? 'Verifying Payment...' : 'Pay Securely via Razorpay'}
                                    </button>

                                    <button 
                                        onClick={() => setCheckoutPlan(null)}
                                        style={{
                                            width: '100%', padding: '12px', borderRadius: '8px',
                                            border: '1px solid #ddd', background: '#fff', color: '#555',
                                            fontSize: '13px', fontWeight: 'bold', cursor: 'pointer'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* ─── Manual UPI QR Verification View (No GST) ─── */
                            <div>
                                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                    <div style={{
                                        width: '50px', height: '50px', borderRadius: '50%',
                                        background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.4)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        margin: '0 auto 12px', color: '#d4af37'
                                    }}>
                                        <CreditCard size={24} />
                                    </div>
                                    <h3 style={{ fontSize: '20px', fontFamily: '"Playfair Display", serif', color: 'var(--maroon-dark)', margin: '0 0 6px 0' }}>
                                        Secure UPI Payment Setup
                                    </h3>
                                    <p style={{ fontSize: '13px', color: 'var(--gray)', margin: 0 }}>
                                        Pay securely using any UPI app and text receipt details to obtain your key.
                                    </p>
                                </div>

                                {/* Plan Summary */}
                                <div style={{
                                    background: 'rgba(106,30,46,0.03)', border: '1px solid rgba(106,30,46,0.07)',
                                    borderRadius: '10px', padding: '14px 18px', display: 'flex',
                                    justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '13.5px', fontWeight: 'bold', color: 'var(--maroon-dark)' }}>
                                            Smart Pass: {checkoutPlan === 'monthly' ? 'Monthly Access' : 'Yearly Access'}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--gray)', marginTop: '2px' }}>
                                            Boutique ID: {auth?.tenant_id}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--maroon)' }}>
                                        ₹{checkoutPlan === 'monthly' ? '250' : '2,000'}
                                    </div>
                                </div>

                                {/* Payment QR Code */}
                                <div style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    background: '#fff', border: '1px solid #eaeaea', borderRadius: '12px',
                                    padding: '24px 16px', marginBottom: '24px'
                                }}>
                                    <div style={{ marginBottom: '16px', background: '#fff', padding: '12px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                                        <QRCode 
                                            value={`upi://pay?pa=8095284779@ybl&pn=SMART%20TAILOR&am=${checkoutPlan === 'monthly' ? '250.00' : '2000.00'}&cu=INR&tn=${encodeURIComponent(`Sub:${checkoutPlan}:${auth?.tenant_id}`)}`} 
                                            size={160} 
                                            level="H" 
                                        />
                                    </div>
                                    <div style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--maroon-dark)', textAlign: 'center' }}>
                                        Scan with PhonePe, GPay, Paytm, or BHIM
                                    </div>
                                    <div style={{ fontSize: '10.5px', color: 'var(--gray)', marginTop: '6px', textAlign: 'center', maxWidth: '300px', lineHeight: 1.3 }}>
                                        Note: The scan carries the exact amount & shop reference to speed up verification.
                                    </div>
                                </div>

                                {/* Next Action Instructions */}
                                <div style={{ marginBottom: '24px' }}>
                                    <div style={{ fontSize: '11.5px', fontWeight: 'bold', color: 'var(--maroon-dark)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                                        📋 What to do after scanning:
                                    </div>
                                    <ol style={{ paddingLeft: '18px', margin: 0, fontSize: '12px', color: '#555', display: 'flex', flexDirection: 'column', gap: '6px', lineHeight: 1.4 }}>
                                        <li>Complete the payment on your mobile app.</li>
                                        <li>Take a quick screenshot of the transaction receipt.</li>
                                        <li>Click the button below to text the screenshot on WhatsApp. Your key & PIN will be shared instantly!</li>
                                    </ol>
                                </div>

                                {/* Action buttons */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <a 
                                        href={getWhatsAppUrl()}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-secondary"
                                        style={{
                                            width: '100%', padding: '14px', borderRadius: '8px',
                                            background: '#2E7D32', color: '#fff', border: 'none',
                                            fontWeight: 'bold', fontSize: '14px', textDecoration: 'none',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                            boxShadow: '0 4px 15px rgba(46,125,50,0.15)', cursor: 'pointer'
                                        }}
                                    >
                                        <MessageSquare size={16} /> Share Screenshot on WhatsApp <ExternalLink size={12} />
                                    </a>
                                    
                                    <button 
                                        onClick={handleMarkAsPaid}
                                        disabled={markingAsPaid}
                                        style={{
                                            width: '100%', padding: '14px', borderRadius: '8px',
                                            background: 'linear-gradient(135deg, #6A1E2E 0%, #4A101C 100%)',
                                            color: '#fff', border: 'none',
                                            fontWeight: 'bold', fontSize: '14px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                            boxShadow: '0 4px 15px rgba(106,30,46,0.15)', cursor: markingAsPaid ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        <Check size={16} /> {markingAsPaid ? 'Logging transaction...' : 'Confirm Payment & Mark as Paid'}
                                    </button>

                                    <button 
                                        onClick={() => setCheckoutPlan(null)}
                                        style={{
                                            width: '100%', padding: '12px', borderRadius: '8px',
                                            border: '1px solid #ddd', background: '#fff', color: '#555',
                                            fontSize: '13px', fontWeight: 'bold', cursor: 'pointer'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Premium Interactive Success Activated Overlay */}
            {showSuccessOverlay && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'radial-gradient(circle, #6A1E2E 0%, #4A101C 60%, #2A050C 100%)',
                    zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', color: '#FAF7F2', animation: 'fadeIn 0.5s ease',
                    textAlign: 'center', padding: '24px', overflow: 'hidden'
                }}>
                    <style>{`
                        @keyframes pulse { 0%{transform:scale(1);box-shadow:0 0 50px rgba(212,175,55,0.5);} 50%{transform:scale(1.06);box-shadow:0 0 90px rgba(212,175,55,0.9);} 100%{transform:scale(1);box-shadow:0 0 50px rgba(212,175,55,0.5);} }
                        @keyframes bounce { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-12px);} }
                        @keyframes fadeIn { from{opacity:0;} to{opacity:1;} }
                        @keyframes slideUp { from{transform:translateY(20px);opacity:0;} to{transform:translateY(0);opacity:1;} }
                        @keyframes confettiFall { 0%{transform:translateY(-20px) rotate(0deg);opacity:1;} 100%{transform:translateY(110vh) rotate(720deg);opacity:0;} }
                        @keyframes starPop { 0%{transform:scale(0) rotate(-30deg);opacity:0;} 60%{transform:scale(1.3) rotate(10deg);opacity:1;} 100%{transform:scale(1) rotate(0deg);opacity:1;} }
                        @keyframes ringExpand { 0%{transform:scale(0.8);opacity:0.8;} 100%{transform:scale(2.5);opacity:0;} }
                    `}</style>

                    {/* Sound effect via Web Audio API */}
                    {showSuccessOverlay && (() => {
                        try {
                            const AudioCtx = window.AudioContext || window.webkitAudioContext;
                            if (AudioCtx) {
                                const ctx = new AudioCtx();
                                const playNote = (freq, start, dur) => {
                                    const o = ctx.createOscillator();
                                    const g = ctx.createGain();
                                    o.connect(g); g.connect(ctx.destination);
                                    o.frequency.value = freq;
                                    o.type = 'sine';
                                    g.gain.setValueAtTime(0, ctx.currentTime + start);
                                    g.gain.linearRampToValueAtTime(0.25, ctx.currentTime + start + 0.02);
                                    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
                                    o.start(ctx.currentTime + start);
                                    o.stop(ctx.currentTime + start + dur);
                                };
                                // Play a celebratory ascending arpeggio
                                [523, 659, 784, 1047, 1319].forEach((f, i) => playNote(f, i * 0.15, 0.5));
                            }
                        } catch {}
                        return null;
                    })()}

                    {/* Confetti particles */}
                    {Array.from({ length: 40 }).map((_, i) => (
                        <div key={i} style={{
                            position: 'absolute',
                            left: `${Math.random() * 100}%`,
                            top: `-${Math.random() * 20}px`,
                            width: `${6 + Math.random() * 8}px`,
                            height: `${6 + Math.random() * 8}px`,
                            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                            background: ['#d4af37','#ffd54f','#fff','#f48fb1','#80cbc4','#a5d6a7','#ff8a65'][Math.floor(Math.random()*7)],
                            animation: `confettiFall ${2 + Math.random() * 3}s ${Math.random() * 1.5}s ease-in forwards`,
                            pointerEvents: 'none',
                            opacity: 0.9,
                        }} />
                    ))}

                    {/* Expanding ring */}
                    <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', border: '3px solid rgba(212,175,55,0.5)', animation: 'ringExpand 1.2s ease-out forwards' }} />
                    <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', border: '3px solid rgba(212,175,55,0.3)', animation: 'ringExpand 1.2s 0.3s ease-out forwards', opacity: 0 }} />

                    {/* Animated Gold Crown */}
                    <div style={{
                        width: '120px', height: '120px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #d4af37 0%, #ffd54f 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 50px rgba(212,175,55,0.6)', marginBottom: '28px',
                        animation: 'pulse 1.8s infinite', zIndex: 1
                    }}>
                        <Crown size={56} style={{ color: '#4A101C', animation: 'bounce 2s infinite' }} />
                    </div>

                    <h2 style={{ fontSize: '36px', fontFamily: '"Playfair Display", serif', fontWeight: 'bold', color: '#ffd54f', margin: '0 0 12px 0', textShadow: '0 4px 10px rgba(0,0,0,0.3)', zIndex: 1, animation: 'starPop 0.6s 0.2s both' }}>
                        Premium Membership Activated!
                    </h2>
                    
                    <p style={{ fontSize: '20px', fontWeight: '500', color: '#FAF7F2', margin: '0 0 16px 0', letterSpacing: '0.02em', zIndex: 1 }}>
                        Welcome to the Elite Smart Tailor Circle ✨
                    </p>

                    <div style={{
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '12px', padding: '16px 32px', display: 'inline-block',
                        marginBottom: '28px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', zIndex: 1
                    }}>
                        <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', letterSpacing: '1px' }}>Tier Activated</div>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: '#ffd54f', marginTop: '4px' }}>
                            ✨ Smart Pass {activatedTier} ✨
                        </div>
                    </div>

                    <p style={{ fontSize: '14.5px', color: 'rgba(250,247,242,0.8)', maxWidth: '480px', margin: '0 auto', lineHeight: '1.6', zIndex: 1 }}>
                        Thank you for upgrading! We are honored to fuel your boutique with elite cloud management, locked dynamic billing UPIs, and premium analytics dashboards.
                    </p>

                    <div style={{ marginTop: '36px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#ffd54f', opacity: 0.8, zIndex: 1 }}>
                        <div style={{ width: '14px', height: '14px', border: '2px solid transparent', borderTopColor: '#ffd54f', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                        Synchronizing secure environment databases...
                    </div>
                </div>
            )}

            {/* Payment Pending Verification Popup */}
            {showPendingSuccess && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(74, 16, 28, 0.65)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 2000, padding: '16px', animation: 'fadeIn 0.25s ease'
                }}>
                    <div style={{
                        background: '#FAF7F2', borderRadius: '16px', border: '2px solid #d4af37',
                        padding: '36px', maxWidth: '460px', width: '100%', position: 'relative',
                        boxShadow: '0 20px 50px rgba(74, 16, 28, 0.35)', animation: 'slideUp 0.3s ease',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            width: '64px', height: '64px', borderRadius: '50%',
                            background: 'rgba(46,125,50,0.12)', border: '1px solid rgba(46,125,50,0.4)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 18px', color: '#2E7D32'
                        }}>
                            <Check size={36} />
                        </div>
                        <h3 style={{ fontSize: '22px', fontFamily: '"Playfair Display", serif', color: 'var(--maroon-dark)', margin: '0 0 12px 0' }}>
                            Transaction Logged!
                        </h3>
                        <p style={{ fontSize: '14.5px', color: 'var(--gray)', lineHeight: 1.5, margin: '0 0 24px 0' }}>
                            Thank you for completing the transaction! We will verify your transaction and get back to you with your PIN in less than 6 hours.
                        </p>
                        <button
                            onClick={() => setShowPendingSuccess(false)}
                            style={{
                                width: '100%', padding: '12px', borderRadius: '8px',
                                background: 'linear-gradient(135deg, #6A1E2E 0%, #4A101C 100%)',
                                color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '14px',
                                cursor: 'pointer', boxShadow: '0 4px 15px rgba(106,30,46,0.15)'
                            }}
                        >
                            Got it, Thanks!
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
