import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Store, User, Phone, MapPin, Lock, ArrowRight, ArrowLeft, Eye, EyeOff, CheckCircle, Scissors, Sparkles, ShieldCheck, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

const STEPS = [
    { id: 1, label: 'Boutique', icon: Store, desc: 'Shop details' },
    { id: 2, label: 'Security', icon: ShieldCheck, desc: 'Login credentials' },
];

export default function Register() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [done, setDone] = useState(false);
    const [generatedId, setGeneratedId] = useState('');
    const [formData, setFormData] = useState({
        shop_name: '', admin_name: '', phone_number: '',
        address: '', password: '', confirmPassword: '', shop_type: 'LADIES', shop_logo: ''
    });

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            toast.error('Logo file size must be less than 2MB');
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData(prev => ({ ...prev, shop_logo: reader.result }));
        };
        reader.readAsDataURL(file);
    };

    const handleNext = (e) => {
        e.preventDefault();
        if (!formData.shop_name.trim() || !formData.admin_name.trim()) {
            toast.error('Shop name and admin name are required');
            return;
        }
        setStep(2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.phone_number || !formData.password) {
            toast.error('All fields are required');
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }
        setLoading(true);
        try {
            const res = await api.post('/auth/register', {
                shop_name: formData.shop_name,
                admin_name: formData.admin_name,
                phone_number: formData.phone_number,
                address: formData.address,
                password: formData.password,
                shop_type: formData.shop_type,
                shop_logo: formData.shop_logo
            });
            if (res.data.success) {
                setGeneratedId(res.data.tenant_id);
                setDone(true);
            }
        } catch (err) {
            toast.error(err.response?.data?.error || err.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    const passwordStrength = (p) => {
        if (!p) return { label: '', color: 'transparent', width: '0%' };
        if (p.length < 5) return { label: 'Weak', color: '#ef5350', width: '25%' };
        if (p.length < 8) return { label: 'Fair', color: '#ff9800', width: '55%' };
        if (/[A-Z]/.test(p) && /[0-9]/.test(p)) return { label: 'Strong', color: '#4caf50', width: '100%' };
        return { label: 'Good', color: '#8bc34a', width: '75%' };
    };
    const strength = passwordStrength(formData.password);

    return (
        <div style={{
            display: 'flex', minHeight: '100vh',
            background: 'linear-gradient(135deg, #1a0309 0%, #3a0c18 40%, #1a0309 100%)',
            fontFamily: '"Outfit", "Inter", sans-serif',
            position: 'relative', overflow: 'hidden'
        }}>
            <style>{`
                @keyframes floatScissors { 0%,100%{transform:translateY(0) rotate(-8deg);} 50%{transform:translateY(-12px) rotate(-8deg);} }
                @keyframes shimmer { 0%{opacity:0.6;} 50%{opacity:1;} 100%{opacity:0.6;} }
                @keyframes slideInLeft { from{opacity:0;transform:translateX(-30px);} to{opacity:1;transform:translateX(0);} }
                @keyframes slideInRight { from{opacity:0;transform:translateX(30px);} to{opacity:1;transform:translateX(0);} }
                @keyframes fadeUp { from{opacity:0;transform:translateY(16px);} to{opacity:1;transform:translateY(0);} }
                @keyframes checkPop { 0%{transform:scale(0);opacity:0;} 60%{transform:scale(1.2);} 100%{transform:scale(1);opacity:1;} }
                @keyframes ringExpand { 0%{transform:scale(0.8);opacity:0.8;} 100%{transform:scale(2.2);opacity:0;} }
                @media(max-width:768px) { .reg-brand { display: none !important; } .reg-right { border-radius: 0 !important; min-height: 100vh !important; } }
                .reg-input { background: rgba(255,255,255,0.06) !important; border: 1.5px solid rgba(255,255,255,0.12) !important; border-radius: 12px !important; padding: 14px 16px 14px 44px !important; color: #fff !important; font-size: 15px !important; width: 100%; outline: none; transition: border-color 0.2s, background 0.2s; font-family: inherit; box-sizing: border-box; }
                .reg-input::placeholder { color: rgba(255,255,255,0.28); }
                .reg-input:focus { border-color: rgba(212,175,55,0.65) !important; background: rgba(255,255,255,0.09) !important; }
                .reg-input-wrap { position: relative; }
                .reg-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,0.32); pointer-events: none; }
                .reg-btn-gold { width: 100%; padding: 15px; border-radius: 12px; border: none; cursor: pointer; font-size: 15px; font-weight: 700; letter-spacing: 0.3px; transition: all 0.25s; display: flex; align-items: center; justify-content: center; gap: 8px; background: linear-gradient(135deg, #d4af37 0%, #b8921f 100%); color: #2a0709; box-shadow: 0 6px 20px rgba(212,175,55,0.3); }
                .reg-btn-gold:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(212,175,55,0.4); }
                .reg-btn-gold:disabled { opacity: 0.6; cursor: not-allowed; }
                .reg-btn-ghost { width: 100%; padding: 15px; border-radius: 12px; border: 1.5px solid rgba(255,255,255,0.15); cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.7); }
                .reg-btn-ghost:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.28); color: #fff; }
                .step-dot { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; transition: all 0.3s; }
                .step-dot.active { background: linear-gradient(135deg, #d4af37, #f5e17c); color: #2a0709; box-shadow: 0 4px 14px rgba(212,175,55,0.4); }
                .step-dot.done { background: rgba(76,175,80,0.2); border: 2px solid #4caf50; color: #4caf50; }
                .step-dot.inactive { background: rgba(255,255,255,0.07); border: 1.5px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.3); }
                .feature-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; background: rgba(212,175,55,0.1); border: 1px solid rgba(212,175,55,0.2); border-radius: 20px; font-size: 12px; color: rgba(255,255,255,0.7); margin: 4px; }
            `}</style>

            {/* Background orbs */}
            <div style={{ position: 'absolute', top: '-120px', right: '30%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,175,55,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-100px', left: '-80px', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(106,30,46,0.4) 0%, transparent 70%)', pointerEvents: 'none' }} />

            {/* Left branding panel */}
            <div className="reg-brand" style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '60px 48px', position: 'relative', animation: 'slideInLeft 0.6s ease both'
            }}>
                <div style={{ textAlign: 'center', maxWidth: 440 }}>
                    <div style={{ margin: '0 auto 24px', display: 'flex', justifyContent: 'center', animation: 'floatScissors 3s ease-in-out infinite' }}>
                        <img src="/logo.png" alt="Smart Tailor Logo" style={{ width: 120, height: 120, objectFit: 'contain', filter: 'drop-shadow(0 8px 32px rgba(212,175,55,0.3))' }} />
                    </div>
                    <h1 style={{ fontFamily: '"Playfair Display", serif', fontSize: '40px', color: '#fff', margin: '0 0 8px', fontWeight: 400, lineHeight: 1.2 }}>
                        Join Smart Tailor
                    </h1>
                    <p style={{ color: '#d4af37', fontSize: '14px', margin: '0 0 28px', letterSpacing: '0.5px', animation: 'shimmer 2.5s ease-in-out infinite' }}>
                        ✨ Start your 30-day FREE Premium Trial
                    </p>

                    {/* Trial highlight box */}
                    <div style={{
                        background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)',
                        borderRadius: 14, padding: '18px 22px', marginBottom: 28, textAlign: 'left'
                    }}>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Sparkles size={15} style={{ color: '#d4af37' }} />
                            What you get for free (30 days):
                        </div>
                        {[
                            'Unlimited orders & customer profiles',
                            'Extra blouse & chudhidhar measurements',
                            'Custom UPI payment QR on bills',
                            'Full analytics — yearly & all-time',
                            'Unlimited design photos & voice notes',
                            'No Smart Tailor watermarks on bills',
                        ].map(f => (
                            <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6, fontSize: 12.5, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>
                                <CheckCircle size={13} style={{ color: '#4caf50', flexShrink: 0, marginTop: 1 }} />
                                {f}
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {['₹0 to start', '30-day trial', 'No credit card', '🇮🇳 Made in India'].map(f => (
                            <span key={f} className="feature-pill">{f}</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right form panel */}
            <div className="reg-right" style={{
                width: '100%', maxWidth: 500,
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(24px)',
                borderLeft: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '48px 40px', animation: 'slideInRight 0.6s ease both',
                minHeight: '100vh'
            }}>
                <div style={{ width: '100%', maxWidth: 400 }}>

                    {/* Header */}
                    <div style={{ marginBottom: 32, textAlign: 'center' }}>
                        <div style={{
                            width: 52, height: 52, borderRadius: '14px',
                            background: 'linear-gradient(135deg, #d4af37, #f5e17c)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 16px', boxShadow: '0 6px 20px rgba(212,175,55,0.25)'
                        }}>
                            <Store size={24} style={{ color: '#4A101C' }} />
                        </div>
                        <h2 style={{ fontFamily: '"Playfair Display", serif', fontSize: 26, color: '#fff', margin: '0 0 6px', fontWeight: 400 }}>
                            Register Your Boutique
                        </h2>
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>
                            Set up your shop profile in under 2 minutes
                        </p>
                    </div>

                    {/* Stepper */}
                    {!done && (
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32, gap: 0 }}>
                            {STEPS.map((s, i) => (
                                <React.Fragment key={s.id}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                        <div className={`step-dot ${step === s.id ? 'active' : step > s.id ? 'done' : 'inactive'}`}>
                                            {step > s.id ? <CheckCircle size={17} /> : s.id}
                                        </div>
                                        <span style={{ fontSize: 11, marginTop: 6, fontWeight: 600, color: step >= s.id ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.28)', letterSpacing: '0.3px' }}>
                                            {s.label}
                                        </span>
                                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{s.desc}</span>
                                    </div>
                                    {i < STEPS.length - 1 && (
                                        <div style={{
                                            flex: 2, height: 2, borderRadius: 99,
                                            background: step > s.id ? 'linear-gradient(90deg, #4caf50, rgba(76,175,80,0.4))' : 'rgba(255,255,255,0.08)',
                                            transition: 'all 0.4s', margin: '0 4px', marginBottom: 24
                                        }} />
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    )}

                    {/* Success screen */}
                    {done ? (
                        <div style={{ textAlign: 'center', animation: 'fadeUp 0.5s ease both' }}>
                            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 24 }}>
                                <div style={{ width: 90, height: 90, borderRadius: '50%', background: 'rgba(76,175,80,0.15)', border: '2px solid #4caf50', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', animation: 'checkPop 0.5s cubic-bezier(0.175,0.885,0.32,1.275) both' }}>
                                    <CheckCircle size={46} style={{ color: '#4caf50' }} />
                                </div>
                                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(76,175,80,0.5)', animation: 'ringExpand 1s ease-out 0.3s both' }} />
                            </div>
                            <h3 style={{ fontFamily: '"Playfair Display", serif', fontSize: 24, color: '#fff', margin: '0 0 8px' }}>
                                Boutique Registered! 🎉
                            </h3>
                            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13.5, margin: '0 0 24px', lineHeight: 1.6 }}>
                                Welcome to Smart Tailor! Your 30-day free premium trial has started.
                            </p>
                            <div style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 12, padding: '16px 20px', marginBottom: 24, textAlign: 'left' }}>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>Your Shop Login ID</div>
                                <div style={{ fontSize: 18, fontWeight: 800, color: '#d4af37', letterSpacing: '2px', fontFamily: 'monospace' }}>{generatedId}</div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Use this as your username to log in</div>
                            </div>
                            <button
                                className="reg-btn-gold"
                                onClick={() => navigate(`/login?tenant_id=${generatedId}`)}
                            >
                                <ArrowRight size={17} /> Go to Login
                            </button>
                        </div>
                    ) : step === 1 ? (
                        /* Step 1 — Boutique Details */
                        <form onSubmit={handleNext} style={{ animation: 'fadeUp 0.3s ease both' }}>
                            <div style={{ marginBottom: 18 }}>
                                <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
                                    Shop / Boutique Name *
                                </label>
                                <div className="reg-input-wrap">
                                    <Store size={16} className="reg-icon" />
                                    <input className="reg-input" type="text" name="shop_name" placeholder="e.g. Elegant Couture" value={formData.shop_name} onChange={handleChange} required autoFocus />
                                </div>
                            </div>

                            <div style={{ marginBottom: 18 }}>
                                <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
                                    Owner / Admin Name *
                                </label>
                                <div className="reg-input-wrap">
                                    <User size={16} className="reg-icon" />
                                    <input className="reg-input" type="text" name="admin_name" placeholder="e.g. Sunita Devi" value={formData.admin_name} onChange={handleChange} required />
                                </div>
                            </div>

                            <div style={{ marginBottom: 18 }}>
                                <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
                                    Shop Specialization *
                                </label>
                                <div className="reg-input-wrap">
                                    <select className="reg-input" style={{ paddingLeft: 16 }} name="shop_type" value={formData.shop_type} onChange={handleChange} required>
                                        <option value="LADIES" style={{ background: '#2a0709' }}>Ladies Tailor (Women's Wear)</option>
                                        <option value="MENS" style={{ background: '#2a0709' }}>Men's Tailor (Bespoke Menswear)</option>
                                        <option value="BOTH" style={{ background: '#2a0709' }}>Both (Ladies & Mens)</option>
                                        <option value="UNIFORM" style={{ background: '#2a0709' }}>Uniforms & Bulk Stitching</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: 28 }}>
                                <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
                                    Shop Address <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                                </label>
                                <div className="reg-input-wrap">
                                    <MapPin size={16} className="reg-icon" />
                                    <input className="reg-input" type="text" name="address" placeholder="e.g. MG Road, Bengaluru" value={formData.address} onChange={handleChange} />
                                </div>
                            </div>
                            
                            <div style={{ marginBottom: 28 }}>
                                <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
                                    Shop Logo <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 18, background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '14px', border: '1.5px dashed rgba(255,255,255,0.1)' }}>
                                    {formData.shop_logo ? (
                                        <div style={{ position: 'relative' }}>
                                            <img src={formData.shop_logo} alt="Logo" style={{ width: 68, height: 68, borderRadius: 12, objectFit: 'cover', border: '2px solid rgba(212,175,55,0.4)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }} />
                                            <button 
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, shop_logo: '' }))}
                                                style={{ position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: '50%', background: '#ef5350', border: '2px solid #2a0709', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ width: 68, height: 68, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
                                            <Store size={26} style={{ opacity: 0.5 }} />
                                        </div>
                                    )}
                                    <div style={{ flex: 1 }}>
                                        <input id="logo-upload" type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                                        <button 
                                            type="button" 
                                            onClick={() => document.getElementById('logo-upload').click()}
                                            style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', color: '#d4af37', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'all 0.2s', fontFamily: 'inherit' }}
                                            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(212,175,55,0.2)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(212,175,55,0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                        >
                                            <Upload size={16} />
                                            {formData.shop_logo ? 'Change Photo' : 'Upload Photo'}
                                        </button>
                                        <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'rgba(255,255,255,0.35)' }}>Max size: 2MB. Square image recommended.</p>
                                    </div>
                                </div>
                            </div>

                            <button type="submit" className="reg-btn-gold">
                                Continue to Security <ArrowRight size={17} />
                            </button>

                            <div style={{ textAlign: 'center', marginTop: 24 }}>
                                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Already have a shop? </span>
                                <Link to="/login" style={{ color: '#d4af37', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>Log in →</Link>
                            </div>
                        </form>
                    ) : (
                        /* Step 2 — Security */
                        <form onSubmit={handleSubmit} style={{ animation: 'fadeUp 0.3s ease both' }}>
                            <div style={{ marginBottom: 18 }}>
                                <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
                                    WhatsApp / Mobile Number *
                                </label>
                                <div className="reg-input-wrap">
                                    <Phone size={16} className="reg-icon" />
                                    <input className="reg-input" type="tel" name="phone_number" placeholder="10-digit mobile number" value={formData.phone_number} onChange={handleChange} required autoFocus maxLength={10} />
                                </div>
                            </div>

                            <div style={{ marginBottom: 8 }}>
                                <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
                                    Admin Password *
                                </label>
                                <div className="reg-input-wrap">
                                    <Lock size={16} className="reg-icon" />
                                    <input
                                        className="reg-input"
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        placeholder="Create a strong password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                        style={{ paddingRight: 44 }}
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 0, display: 'flex' }}>
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* Password strength bar */}
                            {formData.password && (
                                <div style={{ marginBottom: 18, animation: 'fadeUp 0.2s ease both' }}>
                                    <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden', marginBottom: 5 }}>
                                        <div style={{ height: '100%', borderRadius: 99, width: strength.width, background: strength.color, transition: 'all 0.3s' }} />
                                    </div>
                                    <span style={{ fontSize: 11, color: strength.color, fontWeight: 600 }}>{strength.label} password</span>
                                </div>
                            )}

                            <div style={{ marginBottom: 28 }}>
                                <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>
                                    Confirm Password *
                                </label>
                                <div className="reg-input-wrap">
                                    <Lock size={16} className="reg-icon" />
                                    <input
                                        className="reg-input"
                                        type={showConfirm ? 'text' : 'password'}
                                        name="confirmPassword"
                                        placeholder="Re-enter your password"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        required
                                        style={{ paddingRight: 44, borderColor: formData.confirmPassword && formData.confirmPassword !== formData.password ? 'rgba(239,83,80,0.6)' : undefined }}
                                    />
                                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 0, display: 'flex' }}>
                                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                {formData.confirmPassword && formData.confirmPassword !== formData.password && (
                                    <p style={{ fontSize: 11.5, color: '#ef5350', margin: '6px 0 0', fontWeight: 500 }}>⚠ Passwords do not match</p>
                                )}
                                {formData.confirmPassword && formData.confirmPassword === formData.password && (
                                    <p style={{ fontSize: 11.5, color: '#4caf50', margin: '6px 0 0', fontWeight: 500 }}>✓ Passwords match</p>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: 10 }}>
                                <button type="button" className="reg-btn-ghost" style={{ flex: 1 }} onClick={() => setStep(1)}>
                                    <ArrowLeft size={16} /> Back
                                </button>
                                <button
                                    type="submit"
                                    className="reg-btn-gold"
                                    style={{ flex: 2 }}
                                    disabled={loading || (formData.confirmPassword && formData.password !== formData.confirmPassword)}
                                >
                                    {loading ? 'Registering...' : '🏪 Register Shop'}
                                </button>
                            </div>

                            <div style={{ textAlign: 'center', marginTop: 24 }}>
                                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Already have a shop? </span>
                                <Link to="/login" style={{ color: '#d4af37', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>Log in →</Link>
                            </div>
                        </form>
                    )}

                    <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.18)', fontSize: 11, marginTop: 28 }}>
                        Smart Tailor v1.2 · Boutique Management Platform
                    </p>
                </div>
            </div>
        </div>
    );
}
