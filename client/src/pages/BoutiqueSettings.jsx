import React, { useState, useEffect } from 'react';
import { Store, User, Phone, MapPin, CreditCard, Landmark, Users, Plus, Trash2, Save, Scissors, Crown, Key, Gift, Calendar, Sparkles, AlertCircle, Edit, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

export default function BoutiqueSettings({ onMenuClick }) {
    const auth = (() => {
        try {
            return JSON.parse(localStorage.getItem('tailor_auth') || '{}');
        } catch {
            return {};
        }
    })();
    const isPremium = auth?.isPremiumActive;
    const subscriptionType = auth?.subscription_type || 'Free';
    const [profile, setProfile] = useState({
        shop_name: '',
        admin_name: '',
        phone_number: '',
        address: '',
        upi_id: '',
        gst_id: '',
        razorpay_key_id: '',
        razorpay_key_secret: '',
        shop_logo: ''
    });

    const handleLogoUploadSettings = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            toast.error('Logo file size must be less than 2MB');
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setProfile(prev => ({ ...prev, shop_logo: reader.result }));
        };
        reader.readAsDataURL(file);
    };

    const [workers, setWorkers] = useState([]);
    const [newWorkerName, setNewWorkerName] = useState('');
    const [newWorkerPhone, setNewWorkerPhone] = useState('');
    
    // Branches states
    const [branches, setBranches] = useState([]);
    const [newBranchName, setNewBranchName] = useState('');
    const [newBranchAddress, setNewBranchAddress] = useState('');
    const [newBranchPhone, setNewBranchPhone] = useState('');
    const [editingBranchId, setEditingBranchId] = useState(null);
    const [editBranchName, setEditBranchName] = useState('');
    const [editBranchAddress, setEditBranchAddress] = useState('');
    const [editBranchPhone, setEditBranchPhone] = useState('');
    const [addingBranch, setAddingBranch] = useState(false);

    const [loadingProfile, setLoadingProfile] = useState(true);
    const [savingProfile, setSavingProfile] = useState(false);
    const [addingWorker, setAddingWorker] = useState(false);

    useEffect(() => {
        fetchProfile();
        fetchWorkers();
        fetchBranches();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await api.get('/auth/profile');
            setProfile(res.data);
        } catch (err) {
            toast.error('Failed to load boutique profile');
        } finally {
            setLoadingProfile(false);
        }
    };

    const fetchWorkers = async () => {
        try {
            const res = await api.get('/auth/workers');
            setWorkers(res.data);
        } catch (err) {
            toast.error('Failed to load workers list');
        }
    };

    const fetchBranches = async () => {
        try {
            const res = await api.get('/auth/branches');
            setBranches(res.data || []);
        } catch (err) {
            toast.error('Failed to load branches list');
        }
    };

    const handleProfileChange = (e) => {
        setProfile({ ...profile, [e.target.name]: e.target.value });
    };

    const saveProfile = async (e) => {
        e.preventDefault();
        setSavingProfile(true);
        try {
            await api.put('/auth/profile', profile);
            toast.success('Boutique profile updated successfully!');
            const auth = localStorage.getItem('tailor_auth');
            if (auth) {
                const user = JSON.parse(auth);
                user.shop_name = profile.shop_name;
                user.name = profile.admin_name;
                user.upi_id = profile.upi_id || '';
                user.phone_number = profile.phone_number || '';
                user.address = profile.address || '';
                user.gst_id = profile.gst_id || '';
                user.razorpay_key_id = profile.razorpay_key_id || '';
                user.shop_logo = profile.shop_logo || '';
                localStorage.setItem('tailor_auth', JSON.stringify(user));
                // Force app reload to update sidebar and auth context
                setTimeout(() => window.location.reload(), 1000);
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save profile');
        } finally {
            setSavingProfile(false);
        }
    };

    const addWorker = async (e) => {
        e.preventDefault();
        if (!newWorkerName.trim()) {
            toast.error('Worker name is required');
            return;
        }
        setAddingWorker(true);
        try {
            await api.post('/auth/workers', {
                name: newWorkerName,
                phone_number: newWorkerPhone
            });
            toast.success('Worker registered successfully!');
            setNewWorkerName('');
            setNewWorkerPhone('');
            fetchWorkers();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to add worker');
        } finally {
            setAddingWorker(false);
        }
    };

    const deleteWorker = async (id) => {
        if (!window.confirm('Are you sure you want to remove this worker?')) return;
        try {
            await api.delete(`/auth/workers/${id}`);
            toast.success('Worker removed successfully!');
            fetchWorkers();
        } catch (err) {
            toast.error('Failed to remove worker');
        }
    };

    // Branches Operations
    const addBranch = async (e) => {
        e.preventDefault();
        if (!newBranchName.trim()) {
            toast.error('Branch name is required');
            return;
        }
        setAddingBranch(true);
        try {
            await api.post('/auth/branches', {
                name: newBranchName,
                address: newBranchAddress,
                phone_number: newBranchPhone
            });
            toast.success('Branch added successfully!');
            setNewBranchName('');
            setNewBranchAddress('');
            setNewBranchPhone('');
            fetchBranches();
        } catch (err) {
            toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to add branch');
        } finally {
            setAddingBranch(false);
        }
    };

    const startEditingBranch = (b) => {
        setEditingBranchId(b.id);
        setEditBranchName(b.name);
        setEditBranchAddress(b.address || '');
        setEditBranchPhone(b.phone_number || '');
    };

    const saveBranchEdit = async (id) => {
        if (!editBranchName.trim()) {
            toast.error('Branch name is required');
            return;
        }
        try {
            await api.put(`/auth/branches/${id}`, {
                name: editBranchName,
                address: editBranchAddress,
                phone_number: editBranchPhone
            });
            toast.success('Branch updated successfully!');
            setEditingBranchId(null);
            fetchBranches();
        } catch (err) {
            toast.error('Failed to update branch');
        }
    };

    const deleteBranch = async (id) => {
        if (branches.length <= 1) {
            toast.error('A boutique must have at least one branch.');
            return;
        }
        if (!window.confirm(
            '⚠️ WARNING: Are you absolutely sure you want to remove this branch?\n\n' +
            'All associated orders, customers, expenses, workers, and alterations will be safely migrated to your primary branch to ensure no records or data are lost.'
        )) return;
        
        try {
            await api.delete(`/auth/branches/${id}`);
            toast.success('Branch deleted and records successfully migrated!');
            fetchBranches();
            
            const currentActive = localStorage.getItem('tailor_branch_id');
            if (currentActive === String(id)) {
                localStorage.setItem('tailor_branch_id', 'all');
                window.location.reload();
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to remove branch');
        }
    };

    if (loadingProfile) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--maroon)' }}>
                <h3>Loading boutique profile configurations...</h3>
            </div>
        );
    }

    return (
        <div className="page-container animate-fade-in" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            <header className="page-header" style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button className="menu-toggle-btn" onClick={onMenuClick} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <Scissors size={20} style={{ color: 'var(--maroon)' }} />
                    </button>
                    <div>
                        <h1 style={{ fontFamily: '"Playfair Display", serif', color: 'var(--maroon-dark)', margin: 0, fontSize: '28px' }}>Boutique Configurations</h1>
                        <p style={{ color: 'var(--gray)', margin: '4px 0 0', fontSize: '14px' }}>Customize your shop profile, configure dynamic UPI billing, and manage staff.</p>
                    </div>
                </div>
            </header>

            <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                
                {/* 1. Profile & Payment Details Form */}
                <div className="card" style={{ padding: '24px', height: 'fit-content' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>
                        <Store size={20} style={{ color: 'var(--maroon)' }} />
                        <h2 style={{ fontSize: '18px', color: 'var(--maroon-dark)', margin: 0 }}>Shop Details & Payments</h2>
                    </div>

                    <form onSubmit={saveProfile}>
                        <div className="form-group mb-16">
                            <label className="form-label">Shop / Boutique Name</label>
                            <div className="input-prefix">
                                <span className="prefix-symbol"><Store size={16} /></span>
                                <input
                                    type="text"
                                    name="shop_name"
                                    className="form-input"
                                    value={profile.shop_name}
                                    onChange={handleProfileChange}
                                    required
                                    style={{ border: 'none', background: 'transparent' }}
                                />
                            </div>
                        </div>

                        <div className="form-group mb-16">
                            <label className="form-label">Shop Logo <span style={{ fontWeight: 400, color: 'var(--gray)' }}>(Displays on invoices & sidebar)</span></label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                {profile.shop_logo ? (
                                    <div style={{ position: 'relative' }}>
                                        <img src={profile.shop_logo} alt="Logo" style={{ width: 60, height: 60, borderRadius: '8px', objectFit: 'cover', border: '1px solid #ddd' }} />
                                        <button type="button" onClick={() => setProfile(prev => ({ ...prev, shop_logo: '' }))} style={{ position: 'absolute', top: -6, right: -6, background: '#ef5350', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <X size={12} />
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ width: 60, height: 60, borderRadius: '8px', background: '#f5f5f7', border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 11 }}>No Logo</div>
                                )}
                                <input type="file" accept="image/*" onChange={handleLogoUploadSettings} style={{ fontSize: '12px' }} />
                            </div>
                        </div>

                        <div className="form-group mb-16">
                            <label className="form-label">Admin / Owner Name</label>
                            <div className="input-prefix">
                                <span className="prefix-symbol"><User size={16} /></span>
                                <input
                                    type="text"
                                    name="admin_name"
                                    className="form-input"
                                    value={profile.admin_name}
                                    onChange={handleProfileChange}
                                    required
                                    style={{ border: 'none', background: 'transparent' }}
                                />
                            </div>
                        </div>

                        <div className="form-group mb-16">
                            <label className="form-label">Shop Contact Number</label>
                            <div className="input-prefix">
                                <span className="prefix-symbol"><Phone size={16} /></span>
                                <input
                                    type="tel"
                                    name="phone_number"
                                    className="form-input"
                                    placeholder="Enter boutique phone number"
                                    value={profile.phone_number}
                                    onChange={handleProfileChange}
                                    style={{ border: 'none', background: 'transparent' }}
                                />
                            </div>
                        </div>

                        <div className="form-group mb-16">
                            <label className="form-label">Shop Address</label>
                            <div className="input-prefix">
                                <span className="prefix-symbol"><MapPin size={16} /></span>
                                <input
                                    type="text"
                                    name="address"
                                    className="form-input"
                                    placeholder="Enter physical address"
                                    value={profile.address}
                                    onChange={handleProfileChange}
                                    style={{ border: 'none', background: 'transparent' }}
                                />
                            </div>
                        </div>

                        <div className="form-group mb-16" style={{ background: 'rgba(198,167,94,0.04)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(198,167,94,0.15)', position: 'relative' }}>
                            <div className="flex-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label className="form-label" style={{ color: 'var(--maroon-dark)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                                    Dynamic UPI ID (Scan to Pay)
                                    {!isPremium && <span className="premium-badge-span" style={{ fontSize: '9px', background: 'var(--gold)', color: 'var(--maroon-dark)', padding: '2px 6px', borderRadius: '12px', fontWeight: 'bold' }}>👑 PREMIUM</span>}
                                </label>
                            </div>
                            <p style={{ fontSize: '11px', color: 'var(--gray)', margin: '4px 0 8px' }}>
                                Pre-populates exact balance amounts on customer bill PDF QR codes.
                            </p>
                            <div className="input-prefix" style={{ background: isPremium ? '#fff' : '#f5f5f7', opacity: isPremium ? 1 : 0.8 }}>
                                <span className="prefix-symbol"><CreditCard size={16} style={{ color: 'var(--gold)' }} /></span>
                                <input
                                    type="text"
                                    name="upi_id"
                                    className="form-input"
                                    placeholder={isPremium ? "e.g. elegantcouture@okaxis" : "e.g. elegantcouture@okaxis (Premium Only)"}
                                    value={isPremium ? (profile.upi_id || '') : ''}
                                    onChange={handleProfileChange}
                                    disabled={!isPremium}
                                    style={{ border: 'none', background: 'transparent', cursor: isPremium ? 'text' : 'not-allowed' }}
                                />
                            </div>
                            {!isPremium && (
                                <p style={{ fontSize: '10px', color: 'var(--maroon)', margin: '6px 0 0', fontWeight: '500' }}>
                                    🔒 UPI Payment QR Code is locked under the Free plan. Upgrade to Premium to enable!
                                </p>
                            )}
                        </div>

                        <div className="form-group mb-24">
                            <label className="form-label">GST / Tax Identification ID (Optional)</label>
                            <div className="input-prefix">
                                <span className="prefix-symbol"><Landmark size={16} /></span>
                                <input
                                    type="text"
                                    name="gst_id"
                                    className="form-input"
                                    placeholder="Enter GST number"
                                    value={profile.gst_id || ''}
                                    onChange={handleProfileChange}
                                    style={{ border: 'none', background: 'transparent' }}
                                />
                            </div>
                        </div>

                        <div style={{ borderTop: '1px solid var(--gray-light)', margin: '24px 0', paddingTop: '16px' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--maroon-dark)', marginBottom: '4px' }}>
                                Razorpay Custom Credentials (Optional)
                            </h3>
                            <p style={{ fontSize: '11px', color: 'var(--gray)', marginBottom: '16px' }}>
                                Enter your custom Razorpay keys to route customer advance payments directly into your own bank account (Requires GST ID above).
                            </p>

                            <div className="form-group mb-16">
                                <label className="form-label">Razorpay Key ID</label>
                                <div className="input-prefix">
                                    <span className="prefix-symbol"><Key size={16} /></span>
                                    <input
                                        type="text"
                                        name="razorpay_key_id"
                                        className="form-input"
                                        placeholder="rzp_test_..."
                                        value={profile.razorpay_key_id || ''}
                                        onChange={handleProfileChange}
                                        style={{ border: 'none', background: 'transparent' }}
                                    />
                                </div>
                            </div>

                            <div className="form-group mb-24">
                                <label className="form-label">Razorpay Key Secret</label>
                                <div className="input-prefix">
                                    <span className="prefix-symbol"><Key size={16} /></span>
                                    <input
                                        type="password"
                                        name="razorpay_key_secret"
                                        className="form-input"
                                        placeholder="Enter Razorpay Key Secret"
                                        value={profile.razorpay_key_secret || ''}
                                        onChange={handleProfileChange}
                                        style={{ border: 'none', background: 'transparent' }}
                                    />
                                </div>
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={savingProfile}>
                            <Save size={18} style={{ marginRight: 8 }} />
                            {savingProfile ? 'Saving Boutique Configurations...' : 'Save Configurations'}
                        </button>
                    </form>
                </div>

                {/* Right side container */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* 2. Branch Locations Card */}
                    <div className="card" style={{ padding: '24px', height: 'fit-content' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>
                            <Store size={20} style={{ color: 'var(--gold)' }} />
                            <h2 style={{ fontSize: '18px', color: 'var(--maroon-dark)', margin: 0 }}>Boutique Branch Locations</h2>
                        </div>

                        {/* Add Branch Inline Form */}
                        {subscriptionType !== 'Yearly' && branches.length >= 1 ? (
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(198,167,94,0.08), rgba(198,167,94,0.03))',
                                border: '1px solid rgba(198,167,94,0.3)',
                                borderRadius: '8px',
                                padding: '14px',
                                marginBottom: '24px',
                                textAlign: 'center'
                            }}>
                                <Crown size={22} style={{ color: 'var(--gold)', margin: '0 auto 6px', display: 'block' }} />
                                <strong style={{ fontSize: '13px', color: 'var(--maroon-dark)', display: 'block', marginBottom: '4px' }}>
                                    Yearly Plan Exclusive Feature
                                </strong>
                                <p style={{ fontSize: '11px', color: 'var(--gray)', margin: '0 0 10px', lineHeight: '1.4' }}>
                                    Multi-Branch &amp; Chain Boutique Support is exclusive to our Yearly Subscription plan. Upgrade to manage multiple outlets seamlessly!
                                </p>
                                <a href="/subscribe" className="btn btn-secondary btn-xs" style={{ display: 'inline-flex', background: 'var(--gold)', color: '#4A101C', fontWeight: 'bold', border: 'none', padding: '6px 12px' }}>
                                    👑 Upgrade to Yearly
                                </a>
                            </div>
                        ) : (
                            <form onSubmit={addBranch} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px', background: '#fafafa', padding: '14px', borderRadius: '8px', border: '1px solid #eee' }}>
                                <h3 style={{ fontSize: '13px', margin: '0', color: 'var(--maroon-dark)', fontWeight: 700 }}>Add Location / Branch</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Branch Name (e.g. Jubilee Hills Outlet)"
                                        value={newBranchName}
                                        onChange={e => setNewBranchName(e.target.value)}
                                        style={{ fontSize: '12.5px' }}
                                    />
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="Address"
                                            value={newBranchAddress}
                                            onChange={e => setNewBranchAddress(e.target.value)}
                                            style={{ flex: 2, fontSize: '12.5px' }}
                                        />
                                        <input
                                            type="tel"
                                            className="form-input"
                                            placeholder="Contact No"
                                            value={newBranchPhone}
                                            onChange={e => setNewBranchPhone(e.target.value)}
                                            style={{ flex: 1, fontSize: '12.5px' }}
                                        />
                                    </div>
                                </div>
                                <button type="submit" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-end', background: 'var(--gold)', color: '#4A101C', fontWeight: 'bold' }} disabled={addingBranch}>
                                    <Plus size={14} style={{ marginRight: 4 }} /> Add Branch
                                </button>
                            </form>
                        )}

                        {/* Branches List */}
                        <div className="branches-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray)', margin: '0 0 4px' }}>
                                Active Locations ({branches.length})
                            </h3>

                            {branches.map(b => (
                                <div key={b.id} style={{
                                    padding: '12px 14px', background: '#fff', borderRadius: '8px', border: '1px solid #eaeaea',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '8px'
                                }}>
                                    {editingBranchId === b.id ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={editBranchName}
                                                onChange={e => setEditBranchName(e.target.value)}
                                                style={{ fontSize: '12.5px', fontWeight: '600' }}
                                            />
                                            <input
                                                type="text"
                                                className="form-input"
                                                placeholder="Address"
                                                value={editBranchAddress}
                                                onChange={e => setEditBranchAddress(e.target.value)}
                                                style={{ fontSize: '12px' }}
                                            />
                                            <input
                                                type="tel"
                                                className="form-input"
                                                placeholder="Phone"
                                                value={editBranchPhone}
                                                onChange={e => setEditBranchPhone(e.target.value)}
                                                style={{ fontSize: '12px' }}
                                            />
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '4px' }}>
                                                <button type="button" className="btn btn-secondary btn-xs" onClick={() => setEditingBranchId(null)} style={{ fontSize: '11px', padding: '4px 8px' }}>
                                                    Cancel
                                                </button>
                                                <button type="button" className="btn btn-primary btn-xs" onClick={() => saveBranchEdit(b.id)} style={{ fontSize: '11px', padding: '4px 8px', background: 'var(--gold)', color: '#4A101C' }}>
                                                    Save Changes
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                                <div style={{
                                                    width: 32, height: 32, borderRadius: '50%', background: 'rgba(198,167,94,0.1)',
                                                    color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '12px', fontWeight: 'bold', marginTop: '2px', flexShrink: 0
                                                }}>
                                                    📍
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--maroon-dark)' }}>
                                                        {b.name}
                                                    </div>
                                                    {b.address && (
                                                        <div style={{ fontSize: '11.5px', color: 'var(--gray)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <MapPin size={11} /> {b.address}
                                                        </div>
                                                    )}
                                                    {b.phone_number && (
                                                        <div style={{ fontSize: '11.5px', color: 'var(--gray)', marginTop: '1px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <Phone size={11} /> {b.phone_number}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => startEditingBranch(b)}
                                                    style={{
                                                        background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer',
                                                        padding: '4px', borderRadius: '4px', transition: 'all 0.2s', display: 'flex', alignItems: 'center'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(198,167,94,0.1)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                                    title="Edit branch details"
                                                >
                                                    <Edit size={14} />
                                                </button>
                                                {branches.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => deleteBranch(b.id)}
                                                        style={{
                                                            background: 'none', border: 'none', color: '#ef5350', cursor: 'pointer',
                                                            padding: '4px', borderRadius: '4px', transition: 'all 0.2s', display: 'flex', alignItems: 'center'
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.background = '#ffebee'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                                        title="Delete branch"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 3. Worker Management Pane */}
                    <div className="card" style={{ padding: '24px', height: 'fit-content' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>
                            <Users size={20} style={{ color: 'var(--maroon)' }} />
                            <h2 style={{ fontSize: '18px', color: 'var(--maroon-dark)', margin: 0 }}>Stitching Workers Registry</h2>
                        </div>

                        <form onSubmit={addWorker} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px', background: '#fafafa', padding: '14px', borderRadius: '8px' }}>
                            <h3 style={{ fontSize: '13px', margin: '0', color: 'var(--gray)', fontWeight: 600 }}>Register Stitching Worker</h3>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Worker Name (e.g. Sunita)"
                                    value={newWorkerName}
                                    onChange={e => setNewWorkerName(e.target.value)}
                                    style={{ flex: 2, fontSize: '12.5px' }}
                                />
                                <input
                                    type="tel"
                                    className="form-input"
                                    placeholder="Phone Number"
                                    value={newWorkerPhone}
                                    onChange={e => setNewWorkerPhone(e.target.value)}
                                    style={{ flex: 1, fontSize: '12.5px' }}
                                />
                            </div>
                            <button type="submit" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-end' }} disabled={addingWorker}>
                                <Plus size={14} style={{ marginRight: 4 }} /> Add Worker
                            </button>
                        </form>

                        <div className="workers-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray)', margin: '0 0 4px' }}>
                                Active Workers ({workers.length})
                            </h3>

                            {workers.length === 0 ? (
                                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--gray)', background: '#fafafa', borderRadius: '8px', border: '1px dashed #ddd' }}>
                                    <Users size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                                    <p style={{ fontSize: '13px', margin: 0 }}>No workers registered yet.</p>
                                    <p style={{ fontSize: '11px', color: '#999', margin: '4px 0 0' }}>Add stitching workers above to track assignments.</p>
                                </div>
                            ) : (
                                workers.map(w => (
                                    <div key={w.id} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '10px 14px', background: '#fff', borderRadius: '8px', border: '1px solid #eaeaea',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)', transition: 'all 0.2s'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: 28, height: 28, borderRadius: '50%', background: 'rgba(106,30,46,0.08)',
                                                color: 'var(--maroon)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '11px', fontWeight: 'bold'
                                            }}>
                                                {w.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--maroon-dark)' }}>{w.name}</div>
                                                {w.phone_number && <div style={{ fontSize: '10.5px', color: 'var(--gray)' }}>{w.phone_number}</div>}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => deleteWorker(w.id)}
                                            style={{
                                                background: 'none', border: 'none', color: '#ef5350', cursor: 'pointer',
                                                padding: '4px', borderRadius: '4px', transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#ffebee'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                            title="Remove worker"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* 4. Subscription Status Card */}
                    <div className="card" style={{ padding: '24px', height: 'fit-content' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>
                            <Crown size={20} style={{ color: 'var(--gold)' }} />
                            <h2 style={{ fontSize: '18px', color: 'var(--maroon-dark)', margin: 0 }}>Subscription Status</h2>
                        </div>

                        {(() => {
                            const createdAt = auth?.created_at ? new Date(auth.created_at) : null;
                            const trialExpiry = createdAt ? new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
                            const now = new Date();
                            const daysLeft = trialExpiry ? Math.max(0, Math.ceil((trialExpiry - now) / (1000 * 60 * 60 * 24))) : 0;
                            const isOnTrial = subscriptionType === 'Free' && trialExpiry && now <= trialExpiry;

                            if (subscriptionType === 'Monthly' || subscriptionType === 'Yearly') {
                                return (
                                    <div style={{ textAlign: 'center', padding: '20px' }}>
                                        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #d4af37, #f5e17c)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                            <Sparkles size={26} style={{ color: '#4A101C' }} />
                                        </div>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--maroon-dark)', marginBottom: 4 }}>✨ Premium {subscriptionType} Active</div>
                                        <p style={{ fontSize: 13, color: 'var(--gray)', margin: 0 }}>You have full unrestricted access to all Premium features, extra measurements, custom UPI billing QR codes, and extended media storage.</p>
                                    </div>
                                );
                            } else if (isOnTrial) {
                                return (
                                    <div>
                                        <div style={{ background: 'linear-gradient(135deg, #e8f5e9, #f1f8e9)', border: '1px solid #a5d6a7', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                <Crown size={18} style={{ color: '#2e7d32' }} />
                                                <span style={{ fontWeight: 700, color: '#1b5e20', fontSize: 15 }}>🎉 New User Free Trial Active</span>
                                            </div>
                                            <p style={{ fontSize: 13, color: '#2e7d32', margin: '0 0 12px' }}>Enjoy all Premium features for your first 30 days — no payment required!</p>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '10px 14px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#388e3c', fontSize: 13 }}>
                                                    <Calendar size={15} />
                                                    <span>Trial Expires:</span>
                                                </div>
                                                <strong style={{ color: '#1b5e20', fontSize: 14 }}>
                                                    {trialExpiry.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                </strong>
                                            </div>
                                            <div style={{ marginTop: 10, height: 6, background: '#c8e6c9', borderRadius: 99, overflow: 'hidden' }}>
                                                <div style={{ height: '100%', background: 'linear-gradient(90deg, #43a047, #81c784)', width: `${Math.round((daysLeft / 30) * 100)}%`, transition: 'width 0.4s' }} />
                                            </div>
                                            <p style={{ fontSize: 11, color: '#388e3c', margin: '6px 0 0', textAlign: 'right' }}>{daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining</p>
                                        </div>
                                        <p style={{ fontSize: 12, color: 'var(--gray)', textAlign: 'center' }}>After the trial ends, your account will switch to the Free plan. Subscribe before it expires to keep all features!</p>
                                    </div>
                                );
                            } else {
                                return (
                                    <div>
                                        <div style={{ background: 'linear-gradient(135deg, #fff3e0, #fce4ec)', border: '1px solid #ffccbc', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                <AlertCircle size={18} style={{ color: '#bf360c' }} />
                                                <span style={{ fontWeight: 700, color: '#bf360c', fontSize: 15 }}>Free Plan — Limited Access</span>
                                            </div>
                                            <p style={{ fontSize: 13, color: '#6d4c41', margin: 0 }}>Your free trial has ended. You are now on the Free plan with limited features.</p>
                                        </div>
                                        <ul style={{ fontSize: 12.5, color: 'var(--gray)', paddingLeft: 18, margin: '0 0 16px', lineHeight: '1.8' }}>
                                            <li>Max 30 orders per month</li>
                                            <li>No extra blouse/chudhidhar measurements</li>
                                            <li>Max 3 service types per order</li>
                                            <li>Only 1 design photo &amp; 1 scratch pad note</li>
                                            <li>No UPI QR code for payments</li>
                                            <li>Watermark on bill PDF</li>
                                            <li>Analytics limited to current month only</li>
                                        </ul>
                                        <a href="/subscribe" style={{ display: 'block', textAlign: 'center', background: 'linear-gradient(135deg, #4A101C, #6A1E2E)', color: '#fff', padding: '11px 0', borderRadius: 10, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>👑 Upgrade to Premium</a>
                                    </div>
                                );
                            }
                        })()}
                    </div>

                </div>
            </div>
        </div>
    );
}
