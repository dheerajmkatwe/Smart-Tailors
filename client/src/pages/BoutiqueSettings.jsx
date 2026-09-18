import React, { useState, useEffect } from 'react';
import { Store, User, Phone, MapPin, CreditCard, Landmark, Users, Plus, Trash2, Save, Scissors, Crown, Key, Gift, Calendar, Sparkles, AlertCircle, Edit, X, Upload } from 'lucide-react';
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
                            <label className="form-label" style={{ marginBottom: 12 }}>Shop Logo <span style={{ fontWeight: 400, color: 'var(--gray)' }}>(Displays on invoices & sidebar)</span></label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 18, background: '#fafafa', padding: '16px', borderRadius: '12px', border: '1px dashed #d9d9d9' }}>
                                {profile.shop_logo ? (
                                    <div style={{ position: 'relative' }}>
                                        <img src={profile.shop_logo} alt="Logo" style={{ width: 68, height: 68, borderRadius: '10px', objectFit: 'cover', border: '2px solid rgba(198,167,94,0.4)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                                        <button 
                                            type="button" 
                                            onClick={() => setProfile(prev => ({ ...prev, shop_logo: '' }))} 
                                            style={{ position: 'absolute', top: -8, right: -8, background: '#ef5350', color: '#fff', border: '2px solid #fff', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, boxShadow: '0 2px 5px rgba(0,0,0,0.15)' }}
                                        >
                                            <X size={13} />
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ width: 68, height: 68, borderRadius: '10px', background: '#f0f0f0', border: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>
                                        <Store size={26} style={{ opacity: 0.6 }} />
                                    </div>
                                )}
                                <div style={{ flex: 1 }}>
                                    <input id="logo-upload-settings" type="file" accept="image/*" onChange={handleLogoUploadSettings} style={{ display: 'none' }} />
                                    <button 
                                        type="button" 
                                        onClick={() => document.getElementById('logo-upload-settings').click()}
                                        style={{ background: 'rgba(198,167,94,0.1)', border: '1px solid rgba(198,167,94,0.3)', color: 'var(--maroon-dark)', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'all 0.2s', fontFamily: 'inherit' }}
                                        onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(198,167,94,0.2)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                        onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(198,167,94,0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                    >
                                        <Upload size={16} />
                                        {profile.shop_logo ? 'Change Photo' : 'Upload Photo'}
                                    </button>
                                    <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--gray)' }}>Max size: 2MB. Square image recommended.</p>
                                </div>
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

                        <div className="form-group mb-24" style={{ background: 'rgba(198,167,94,0.04)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(198,167,94,0.15)', position: 'relative' }}>
                            <div className="flex-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label className="form-label" style={{ color: 'var(--maroon-dark)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                                    Dynamic UPI ID (Scan to Pay)
                                </label>
                            </div>
                            <p style={{ fontSize: '11px', color: 'var(--gray)', margin: '4px 0 8px' }}>
                                Pre-populates exact balance amounts on customer bill PDF QR codes.
                            </p>
                            <div className="input-prefix" style={{ background: '#fff' }}>
                                <span className="prefix-symbol"><CreditCard size={16} style={{ color: 'var(--gold)' }} /></span>
                                <input
                                    type="text"
                                    name="upi_id"
                                    className="form-input"
                                    placeholder="e.g. elegantcouture@okaxis"
                                    value={profile.upi_id || ''}
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



                </div>
            </div>
        </div>
    );
}
