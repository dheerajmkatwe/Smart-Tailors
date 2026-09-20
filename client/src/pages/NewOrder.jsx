import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ChevronDown, User, Ruler, Scissors, CreditCard, Search, Menu, Image as ImageIcon, Camera, X, Mic, Square, Trash, PenTool, FolderOpen, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import QRCode from 'react-qr-code';
import api from '../api/axios';
import ScratchPad from '../components/ScratchPad';
import TenantUpiQRModal from '../components/TenantUpiQRModal';
import { saveOfflineOrder } from '../utils/offlineStore';
import { generateUpiUri } from '../utils/upiHelper';


const getAppMode = () => {
    try { return localStorage.getItem('tailor_active_mode') || 'LADIES'; } catch { return 'LADIES'; }
};

const SERVICE_TYPES_LADIES = ['Blouse', 'Dress', 'Lehenga', 'Chudi', 'Embroidery', 'Alteration', 'Pico', 'Fall', 'Gonda', 'Krosha Work', 'Other'];
const SERVICE_TYPES_MENS = ['Shirt', 'Pant', 'Kurta', 'Kurta Pajama', 'Suit', 'Blazer', 'Waistcoat', 'Sherwani', 'Safari Suit', 'Alteration', 'Other'];

const SERVICE_TYPES = getAppMode() === 'MENS' ? SERVICE_TYPES_MENS : SERVICE_TYPES_LADIES;

const measurementLabelsLadies = {
    BLOUSE: [
        { key: 'm_length', label: 'Length' }, { key: 'shoulder', label: 'Shoulder' },
        { key: 'chest', label: 'Chest' }, { key: 'waist', label: 'Waist' },
        { key: 'dot', label: 'Dot' }, { key: 'back_neck', label: 'Back Neck' },
        { key: 'front_neck', label: 'Front Neck' }, { key: 'sleeves_length', label: 'Sleeves Length' },
        { key: 'armhole', label: 'Armhole' }, { key: 'chest_distance', label: 'Chest Distance' },
        { key: 'sleeves_round', label: 'Sleeves Round' },
    ],
    CHUDHIDHAR: [
        { key: 't_length', label: 'Length' }, { key: 't_shoulder', label: 'Shoulder' },
        { key: 't_chest', label: 'Chest' }, { key: 't_waist', label: 'Waist' },
        { key: 't_back_neck', label: 'Back Neck' }, { key: 't_front_neck', label: 'Front Neck' },
        { key: 't_sleeves_length', label: 'Sleeves Length' }, { key: 't_sleeves_round', label: 'Round' },
        { key: 't_half_body', label: 'Half Body' }, { key: 't_hip', label: 'HIP' },
        { key: 'b_length', label: 'B-Length (BL)' }, { key: 'b_bottom_round', label: 'B-Round (BR)' },
        { key: 'b_hip', label: 'B-Hip (HP)' }, { key: 'b_fly', label: 'B-Fly (FLY)' },
        { key: 'b_thai', label: 'B-Thai' }, { key: 'b_knee', label: 'B-Knee' },
    ],
};


const measurementLabelsMens = {
    SHIRT: [
        { key: 'm_length', label: 'Length' }, { key: 'shoulder', label: 'Shoulder' },
        { key: 'chest', label: 'Chest' }, { key: 'waist', label: 'Waist' },
        { key: 'front_neck', label: 'Collar (Neck)' }, { key: 'sleeves_length', label: 'Sleeves' },
        { key: 'sleeves_round', label: 'Cuff (Bicep)' }, { key: 't_half_body', label: 'Half Back' }
    ],
    PANT: [
        { key: 't_length', label: 'Length' }, { key: 't_waist', label: 'Waist' },
        { key: 't_hip', label: 'Hip' }, { key: 'b_thai', label: 'Thigh (Jangh)' },
        { key: 'b_knee', label: 'Knee' }, { key: 'b_bottom_round', label: 'Bottom (Mori)' },
        { key: 'b_fly', label: 'U-Rise (Fly)' }
    ],
    COAT: [
        { key: 'b_length', label: 'Coat Length' }, { key: 't_shoulder', label: 'Shoulder' },
        { key: 't_chest', label: 'Chest' }, { key: 't_waist', label: 'Waist' },
        { key: 't_sleeves_length', label: 'Sleeves' }, { key: 't_half_body', label: 'Half Back' },
        { key: 't_front_neck', label: 'Neck' }, { key: 't_hip', label: 'Seat (Hip)' }
    ],
    KURTA: [
        { key: 'm_length', label: 'Kurta Length' }, { key: 'shoulder', label: 'Shoulder' },
        { key: 'chest', label: 'Chest' }, { key: 'waist', label: 'Waist' },
        { key: 'front_neck', label: 'Collar (Neck)' }, { key: 'sleeves_length', label: 'Sleeves' },
        { key: 'sleeves_round', label: 'Cuff (Bicep)' }, { key: 't_half_body', label: 'Half Back' }
    ],
    SUIT: [
        { key: 'b_length', label: 'Coat Length' }, { key: 't_shoulder', label: 'Shoulder' },
        { key: 't_chest', label: 'Chest' }, { key: 't_waist', label: 'Waist' },
        { key: 't_sleeves_length', label: 'Sleeves' }, { key: 't_half_body', label: 'Half Back' },
        { key: 't_front_neck', label: 'Neck' }, { key: 't_hip', label: 'Seat (Hip)' }
    ],
    BLAZER: [
        { key: 'b_length', label: 'Blazer Length' }, { key: 't_shoulder', label: 'Shoulder' },
        { key: 't_chest', label: 'Chest' }, { key: 't_waist', label: 'Waist' },
        { key: 't_sleeves_length', label: 'Sleeves' }, { key: 't_half_body', label: 'Half Back' },
        { key: 't_front_neck', label: 'Neck' }, { key: 't_hip', label: 'Seat (Hip)' }
    ],
    SHERWANI: [
        { key: 'b_length', label: 'Sherwani Length' }, { key: 't_shoulder', label: 'Shoulder' },
        { key: 't_chest', label: 'Chest' }, { key: 't_waist', label: 'Waist' },
        { key: 't_sleeves_length', label: 'Sleeves' }, { key: 't_half_body', label: 'Half Back' },
        { key: 't_front_neck', label: 'Neck' }, { key: 't_hip', label: 'Seat (Hip)' }
    ],
    WAISTCOAT: [
        { key: 'b_length', label: 'Waistcoat Length' }, { key: 't_shoulder', label: 'Shoulder' },
        { key: 't_chest', label: 'Chest' }, { key: 't_waist', label: 'Waist' },
        { key: 't_half_body', label: 'Half Back' }, { key: 't_front_neck', label: 'Neck' }, 
        { key: 't_hip', label: 'Seat (Hip)' }
    ]
};

const measurementLabels = getAppMode() === 'MENS' ? measurementLabelsMens : measurementLabelsLadies;

const ALL_MEASUREMENT_KEYS = Array.from(new Set(Object.values(measurementLabels).flatMap(category => category.map(f => f.key))));

const initialService = () => ({ service_type: getAppMode() === 'MENS' ? 'Shirt' : 'Blouse', quantity: 1, price: '', custom_type: '' });

export default function NewOrder({ onMenuClick, auth }) {
    const navigate = useNavigate();
    const phoneRef = useRef();

    // Always start with a blank form — no auto-restore from localStorage
    const initialDraft = null;
    useEffect(() => {
        // Clear any stale draft from previous test sessions
        localStorage.removeItem('newOrderDraft');
    }, []);

    const today = new Date().toISOString().split('T')[0];

    // Customer
    const [customer, setCustomer] = useState(initialDraft?.customer || { name: '', phone_number: '', notes: '' });
    const [customerId, setCustomerId] = useState(initialDraft?.customerId ?? null);
    const [customerFound, setCustomerFound] = useState(initialDraft?.customerFound ?? false);

    // Dates & Assignment
    const [bookingDate, setBookingDate] = useState(today);
    const [deliveryDate, setDeliveryDate] = useState(initialDraft?.deliveryDate || '');
    const [advancePaid, setAdvancePaid] = useState(initialDraft?.advancePaid || '');
    const [discount, setDiscount] = useState(initialDraft?.discount || '');
    const [paymentMethod, setPaymentMethod] = useState(initialDraft?.paymentMethod || 'Cash');
    const [assignedWorker, setAssignedWorker] = useState(initialDraft?.assignedWorker || '');
    const [workers, setWorkers] = useState([]);

    const [isAdvanceVerified, setIsAdvanceVerified] = useState(false);
    const [verifiedPayId, setVerifiedPayId] = useState('');
    const [processingRazorpay, setProcessingRazorpay] = useState(false);
    const [showMockRazorpay, setShowMockRazorpay] = useState(false);
    const [mockRazorpayAmount, setMockRazorpayAmount] = useState(0);
    const [mockOrderId, setMockOrderId] = useState('');

    const [inlineUpi, setInlineUpi] = useState('');
    const [savingInlineUpi, setSavingInlineUpi] = useState(false);
    const [shopUpiState, setShopUpiState] = useState('');
    const [showUpiQrModal, setShowUpiQrModal] = useState(false);

    const handleSaveInlineUpi = async () => {
        if (!inlineUpi.trim()) {
            toast.error('Please enter a valid UPI ID (e.g. 9876543210@ybl)');
            return;
        }
        setSavingInlineUpi(true);
        try {
            const activeAuth = auth || JSON.parse(localStorage.getItem('tailor_auth') || '{}');
            await api.put('/auth/profile', {
                ...activeAuth,
                upi_id: inlineUpi.trim()
            });
            activeAuth.upi_id = inlineUpi.trim();
            localStorage.setItem('tailor_auth', JSON.stringify(activeAuth));
            setShopUpiState(inlineUpi.trim());
            toast.success('UPI ID saved! Live QR code generated.');
        } catch (err) {
            toast.error('Failed to save UPI ID');
        } finally {
            setSavingInlineUpi(false);
        }
    };

    useEffect(() => {
        setIsAdvanceVerified(false);
        setVerifiedPayId('');
    }, [advancePaid]);

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

    const handleMockPaymentSuccess = async () => {
        setShowMockRazorpay(false);
        setProcessingRazorpay(true);
        try {
            const mockPaymentId = 'pay_mock_' + Math.random().toString(36).substr(2, 9);
            await api.post('/auth/razorpay-verify-advance-payment', {
                razorpay_payment_id: mockPaymentId,
                razorpay_order_id: mockOrderId,
                razorpay_signature: 'mock_signature_sig123'
            });

            setIsAdvanceVerified(true);
            setVerifiedPayId(mockPaymentId);
            toast.success('Advance payment successfully processed and verified! ⚡ (Sandbox Mode)');
            
            // Automatically submit and create the order
            setTimeout(() => {
                handleSubmit(null, mockPaymentId);
            }, 300);
        } catch (err) {
            toast.error('Failed to verify payment signature.');
        } finally {
            setProcessingRazorpay(false);
        }
    };

    const handleRazorpayAdvance = async (advanceAmount) => {
        if (!advanceAmount || parseFloat(advanceAmount) <= 0) {
            toast.error('Please enter a valid advance payment amount first.');
            return;
        }

        // --- PRE-CHECKOUT FORM VALIDATION ---
        if (!customer.name || !customer.phone_number) {
            toast.error('Customer name and phone number are required before initiating payment');
            return;
        }
        if (!deliveryDate) {
            toast.error('Please set a delivery date before initiating payment');
            return;
        }
        if (services.some(s => !s.price || parseFloat(s.price) <= 0)) {
            toast.error('All stitching services must have a valid price before initiating payment');
            return;
        }
        // Requirement: Measurements mandatory based on selected services (IF using Body Measurements)
        if (measurementType === 'Body') {
            for (const s of services) {
                let type = s.service_type.toUpperCase();
                // Map 'KURTA PAJAMA' or 'SAFARI SUIT' to generic categories if they dont exist directly
                if (type === 'KURTA PAJAMA') type = 'KURTA';
                if (type === 'SAFARI SUIT') type = 'SUIT';
                
                if (measurementLabels[type] || measurementLabels[s.service_type]) {
                    const activeTypeLabel = measurementLabels[type] ? type : s.service_type;
                    const missing = measurementLabels[activeTypeLabel].find(f => !measurements[f.key] || String(measurements[f.key]).trim() === '');
                    if (missing) {
                        setActiveTab(activeTypeLabel);
                        setTimeout(() => {
                            const el = document.getElementById(`meas_input_${missing.key}`);
                            if (el) {
                                el.focus();
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                        }, 100);
                        toast.error(`Enter ${missing.label} for ${s.service_type} before initiating payment`);
                        return;
                    }
                }
            }
        }
        // --- END VALIDATION ---

        setProcessingRazorpay(true);
        try {
            const activeAuth = auth || JSON.parse(localStorage.getItem('tailor_auth')) || {};
            const orderRes = await api.post('/auth/razorpay-create-advance-order', { amount: parseFloat(advanceAmount) });
            const { order_id, amount, currency, key } = orderRes.data;

            // If using standard mock/testing key format, trigger clean simulated UI Sandbox modal overlay!
            if (key === 'rzp_test_5dd75929b23048') {
                setMockRazorpayAmount(parseFloat(advanceAmount));
                setMockOrderId(order_id);
                setShowMockRazorpay(true);
                setProcessingRazorpay(false);
                return;
            }

            const loaded = await loadRazorpayScript();
            if (!loaded) {
                toast.error('Failed to load Razorpay SDK. Please check your internet connection.');
                setProcessingRazorpay(false);
                return;
            }

            const options = {
                key: key,
                amount: amount,
                currency: currency,
                name: activeAuth.shop_name || 'SMART TAILOR',
                description: `Advance Payment for Order`,
                order_id: order_id,
                prefill: {
                    name: customer?.name || '',
                    contact: customer?.phone_number || ''
                },
                theme: {
                    color: '#6A1E2E'
                },
                handler: async function (response) {
                    try {
                        await api.post('/auth/razorpay-verify-advance-payment', {
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_signature: response.razorpay_signature
                        });

                        setIsAdvanceVerified(true);
                        setVerifiedPayId(response.razorpay_payment_id);
                        toast.success('Advance payment successfully processed and verified! ⚡');
                        
                        // Automatically submit and create the order
                        setTimeout(() => {
                            handleSubmit(null, response.razorpay_payment_id);
                        }, 300);
                    } catch (err) {
                        toast.error('Failed to verify payment signature.');
                    }
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.open();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to initialize payment gateway.');
        } finally {
            setProcessingRazorpay(false);
        }
    };

    useEffect(() => {
        api.get('/auth/workers')
            .then(res => {
                setWorkers(res.data);
                if (res.data.length > 0 && !initialDraft?.assignedWorker) {
                    setAssignedWorker(res.data[0].name);
                }
            })
            .catch(err => console.error('Failed to load workers list', err));
    }, []);

    const initialExtraMeasurement = () => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        name: '',
        type: Object.keys(measurementLabels)[0],
        values: ALL_MEASUREMENT_KEYS.reduce((acc, key) => ({ ...acc, [key]: '' }), {})
    });

    // Measurements
    const [measurementType, setMeasurementType] = useState(initialDraft?.measurementType || 'Body'); // 'Body' or 'Sample'
    const [activeTab, setActiveTab] = useState(initialDraft?.activeTab || Object.keys(measurementLabels)[0]);
    const [measurements, setMeasurements] = useState(initialDraft?.measurements || ALL_MEASUREMENT_KEYS.reduce((acc, key) => ({ ...acc, [key]: '' }), {}));
    const [extraMeasurements, setExtraMeasurements] = useState(initialDraft?.extraMeasurements || []);

    function addExtraMeasurement() {
        if (!auth?.isPremiumActive) {
            toast.error("Extra Blouse & Chudhidhar Measurements is a Premium Feature. Please upgrade your plan!", { id: 'premium-extra-meas' });
            return;
        }
        setExtraMeasurements(prev => [...prev, initialExtraMeasurement()]);
    }
    function removeExtraMeasurement(id) {
        setExtraMeasurements(prev => prev.filter(m => m.id !== id));
    }
    function updateExtraMeasurement(id, field, val) {
        setExtraMeasurements(prev => prev.map(m => m.id === id ? { ...m, [field]: val } : m));
    }
    function updateExtraMeasurementValue(id, key, val) {
        setExtraMeasurements(prev => prev.map(m => m.id === id ? { ...m, values: { ...m.values, [key]: val } } : m));
    }

    // Services
    const [services, setServices] = useState(initialDraft?.services || [initialService()]);

    // Images
    const [images, setImages] = useState(initialDraft?.images || []);

    // Payment
    // Declared above to prevent temporal dead zone ReferenceError

    // Voice Note
    const [isRecording, setIsRecording] = useState(false);
    const [showScratchPad, setShowScratchPad] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);

    const mediaRecorderRef = useRef(null);
    const cameraInputRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);
    const submittingRef = useRef(false); // sync guard against double-submit

    const [loading, setLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);

    // ── Image Viewer State ────────────────────────────
    const [selectedImage, setSelectedImage] = useState(null);

    // ── Multiple Drafts Manager ───────────────────────
    const [showDraftsModal, setShowDraftsModal] = useState(false);
    const [activeDraftId, setActiveDraftId] = useState(null);
    const [savedDrafts, setSavedDrafts] = useState(() => {
        try {
            const list = localStorage.getItem('lm_tailor_drafts');
            return list ? JSON.parse(list) : [];
        } catch { return []; }
    });

    const deleteActiveDraft = () => {
        if (!activeDraftId) return;
        const list = localStorage.getItem('lm_tailor_drafts');
        if (list) {
            try {
                const parsed = JSON.parse(list);
                const filtered = parsed.filter(d => d.id !== activeDraftId);
                localStorage.setItem('lm_tailor_drafts', JSON.stringify(filtered));
                setSavedDrafts(filtered);
            } catch (err) {
                console.error(err);
            }
        }
        setActiveDraftId(null);
    };

    const saveCurrentAsDraft = () => {
        if (!auth?.isPremiumActive) {
            toast.error("👑 Saving order drafts is a Premium Feature. Please subscribe to premium to enable drafts!");
            return;
        }
        const defaultName = customer.name ? `Draft for ${customer.name}` : `Draft at ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
        const draftName = window.prompt("Enter a name for this draft:", defaultName);
        if (draftName === null) return; // user cancelled
        
        const newDraft = {
            id: Date.now().toString(),
            name: draftName || defaultName,
            createdAt: new Date().toISOString(),
            payload: {
                customer,
                customerId,
                customerFound,
                deliveryDate,
                assignedWorker,
                measurementType,
                activeTab,
                measurements,
                extraMeasurements,
                services,
                images,
                advancePaid,
                paymentMethod
            }
        };

        const updated = [newDraft, ...savedDrafts];
        setSavedDrafts(updated);
        localStorage.setItem('lm_tailor_drafts', JSON.stringify(updated));
        toast.success("Draft saved successfully!");
        clearForm(true); // Automatically clear the form fields to start a new order
    };

    const loadDraft = (draft) => {
        if (!auth?.isPremiumActive) {
            toast.error("👑 Accessing drafts is a Premium Feature. Please subscribe to premium to enable drafts!");
            return;
        }
        const confirmLoad = window.confirm(`Load "${draft.name}"? This will overwrite the current form details.`);
        if (!confirmLoad) return;

        const p = draft.payload;
        if (p.customer) setCustomer(p.customer);
        setCustomerId(p.customerId ?? null);
        setCustomerFound(p.customerFound ?? false);
        if (p.deliveryDate) setDeliveryDate(p.deliveryDate);
        if (p.assignedWorker) setAssignedWorker(p.assignedWorker);
        if (p.measurementType) setMeasurementType(p.measurementType);
        if (p.activeTab) setActiveTab(p.activeTab);
        if (p.measurements) setMeasurements(p.measurements);
        if (p.extraMeasurements) setExtraMeasurements(p.extraMeasurements);
        if (p.services) setServices(p.services);
        if (p.images) setImages(p.images);
        if (p.advancePaid) setAdvancePaid(p.advancePaid);
        if (p.paymentMethod) setPaymentMethod(p.paymentMethod);

        setActiveDraftId(draft.id);
        setShowDraftsModal(false);
        toast.success(`Draft "${draft.name}" loaded successfully!`);
    };

    const deleteDraft = (draftId, e) => {
        e.stopPropagation();
        const confirmDel = window.confirm("Are you sure you want to delete this draft?");
        if (!confirmDel) return;

        const updated = savedDrafts.filter(d => d.id !== draftId);
        setSavedDrafts(updated);
        localStorage.setItem('lm_tailor_drafts', JSON.stringify(updated));
        if (draftId === activeDraftId) {
            setActiveDraftId(null);
        }
        toast.success("Draft deleted.");
    };

    const clearForm = (skipConfirm = false) => {
        if (skipConfirm !== true) {
            const confirmClear = window.confirm("Are you sure you want to clear the entire form to start a new bill?");
            if (!confirmClear) return;
        }

        setCustomer({ name: '', phone_number: '', notes: '' });
        setCustomerId(null);
        setCustomerFound(false);
        setDeliveryDate('');
        setAssignedWorker(workers.length > 0 ? workers[0].name : '');
        setMeasurementType('Body');
        setActiveTab('BLOUSE');
        setMeasurements({
            m_length: '', shoulder: '', chest: '', waist: '', dot: '',
            back_neck: '', front_neck: '', sleeves_length: '', armhole: '',
            chest_distance: '', sleeves_round: '',
            t_length: '', t_shoulder: '', t_chest: '', t_waist: '', t_back_neck: '', t_front_neck: '', t_sleeves_length: '', t_sleeves_round: '', t_half_body: '', t_hip: '',
            b_length: '', b_bottom_round: '', b_hip: '', b_fly: '', b_thai: '', b_knee: '',
            emb_front_neck: '', emb_back_neck: '', emb_sleeves_length: '', emb_sleeves_round: '', emb_work_length: '', emb_work_width: '', emb_shoulder: '', emb_chest: '', emb_dot: '', emb_armhole: '',
        });
        setExtraMeasurements([]);
        setServices([initialService()]);
        setImages([]);
        setAdvancePaid('');
        setPaymentMethod('Cash');
        clearAudio();
        setActiveDraftId(null);
        if (skipConfirm !== true) {
            toast.success("Form cleared! Ready for new bill.");
        }
    };

    // ── Draft Persistence ─────────────────────────────
    useEffect(() => {
        const draft = {
            customer, customerId, customerFound, bookingDate, deliveryDate, assignedWorker, measurementType, activeTab, measurements, extraMeasurements, services, images, advancePaid, paymentMethod
        };
        localStorage.setItem('newOrderDraft', JSON.stringify(draft));
    }, [customer, customerId, customerFound, bookingDate, deliveryDate, assignedWorker, measurementType, activeTab, measurements, extraMeasurements, services, images, advancePaid, paymentMethod]);

    // ── Computed totals ───────────────────────────────
    const rawTotalAmount = services.reduce((s, svc) => {
        const qty = parseFloat(svc.quantity) || 0;
        const price = parseFloat(svc.price) || 0;
        return s + qty * price;
    }, 0);

    const discountAmount = parseFloat(discount) || 0;
    const totalAmount = Math.max(0, rawTotalAmount - discountAmount);
    const advance = parseFloat(advancePaid) || 0;
    const balance = Math.max(0, totalAmount - advance);

    // ── Customer lookup ───────────────────────────────
    async function handlePhoneSearch(isAuto = false) {
        if (!customer.phone_number || customer.phone_number.length < 10) {
            if (!isAuto) toast.error('Enter a valid 10-digit phone number');
            return;
        }
        setSearchLoading(true);
        try {
            const res = await api.get(`/customers/search?phone=${customer.phone_number}`);
            if (res.data && res.data.length > 0) {
                const found = res.data[0];
                setCustomerId(found.id);
                setCustomer({ name: found.name, phone_number: found.phone_number, notes: '' });
                setCustomerFound(true);
                // Prefill measurements
                const m = {};
                ALL_MEASUREMENT_KEYS.forEach(k => { 
                    m[k] = found[k] !== null && found[k] !== undefined ? String(found[k] ?? '') : ''; 
                });
                setMeasurements(m);
                if (found.extra_measurements) {
                    try {
                        const parsed = typeof found.extra_measurements === 'string'
                            ? JSON.parse(found.extra_measurements)
                            : found.extra_measurements;
                        setExtraMeasurements(Array.isArray(parsed) ? parsed : []);
                    } catch (e) {
                        setExtraMeasurements([]);
                    }
                } else {
                    setExtraMeasurements([]);
                }
                toast.success(`Customer found: ${found.name}`);
            } else {
                setCustomerFound(false);
                setCustomerId(null);
                toast('New customer — fill in the details below', { icon: '👤' });
            }
        } catch {
            toast.error('Search failed');
        } finally {
            setSearchLoading(false);
        }
    }

    // Auto-search when 10 digits are entered
    useEffect(() => {
        console.log('Phone number changed:', customer.phone_number, 'Length:', customer.phone_number.length, 'Found:', customerFound);
        if (customer.phone_number.length === 10 && !customerFound) {
            console.log('Triggering auto-search...');
            handlePhoneSearch(true);
        } else if (customer.phone_number.length < 10 && customerFound) {
            console.log('Resetting customer found (number short)');
            setCustomerFound(false);
            setCustomerId(null);
            // Optional: reset name if it was prefilled and now user is typing a new number
            // setCustomer(c => ({ ...c, name: '' }));
        }
    }, [customer.phone_number, customerFound]);

    // ── Service helpers ───────────────────────────────
    function addService() {
        if (!auth?.isPremiumActive && services.length >= 3) {
            toast.error("Free plan accounts are limited to a maximum of 3 services per order. Upgrade to Premium for unlimited service items!", { id: 'premium-services-limit' });
            return;
        }
        setServices(s => [...s, initialService()]);
    }
    function removeService(i) { setServices(s => s.filter((_, idx) => idx !== i)); }
    function updateService(i, field, val) {
        setServices(s => s.map((svc, idx) => idx === i ? { ...svc, [field]: val } : svc));
    }

    // ── Voice Note ────────────────────────────────────
    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        clearInterval(timerRef.current);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                setAudioUrl(URL.createObjectURL(blob));
                // stop microphone access
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);

            timerRef.current = setInterval(() => {
                setRecordingTime(prev => {
                    if (prev >= 119) {
                        stopRecording();
                        return 120;
                    }
                    return prev + 1;
                });
            }, 1000);
        } catch (err) {
            toast.error('Microphone access denied or unavailable');
        }
    };

    const clearAudio = () => {
        setAudioBlob(null);
        setAudioUrl(null);
        setRecordingTime(0);
    };

    const blobToBase64 = (blob) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    // ── Image handle ──────────────────────────────────
    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files);
        if (!auth?.isPremiumActive && images.length + files.length > 2) {
            toast.error("Free Plan accounts are limited to at most 1 uploaded photo and 1 scratch pad sketch per order. Upgrade to Premium for unlimited photos!", { id: 'premium-photo-limit' });
            e.target.value = null;
            return;
        }
        files.forEach(file => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > MAX_WIDTH) {
                        height = Math.round((height * MAX_WIDTH) / width);
                        width = MAX_WIDTH;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const base64Str = canvas.toDataURL('image/jpeg', 0.7);
                    setImages(prev => [...prev, base64Str]);
                };
            };
        });
        e.target.value = null; // reset input
    };

    const removeImage = (index) => {
        setImages(images.filter((_, i) => i !== index));
    };

    const handleScratchSave = (base64) => {
        if (!auth?.isPremiumActive && images.length >= 2) {
            toast.error("Free Plan accounts are limited to at most 1 uploaded photo and 1 scratch pad sketch per order. Upgrade to Premium for unlimited images!", { id: 'premium-sketch-limit' });
            return;
        }
        setImages(prev => [...prev, base64]);
        toast.success('Sketch saved and added to images');
    };

    // ── Submit ────────────────────────────────────────
    async function handleSubmit(e, customPaymentId = null) {
        if (e && e.preventDefault) e.preventDefault();
        // Guard: block duplicate submissions from double-clicks
        if (submittingRef.current) return;
        submittingRef.current = true;
        if (!customer.name || !customer.phone_number) { submittingRef.current = false; return toast.error('Customer name and phone are required'); }
        if (!deliveryDate) { submittingRef.current = false; return toast.error('Please set a delivery date'); }
        if (services.some(s => !s.price || parseFloat(s.price) <= 0)) { submittingRef.current = false; return toast.error('All services must have a price'); }

        // Requirement: Measurements mandatory for Blouse (IF using Body Measurements)
        const hasBlouse = services.some(s => s.service_type === 'Blouse');
        if (hasBlouse && measurementType === 'Body') {
            const missing = measurementLabels.BLOUSE.find(f => !measurements[f.key] || measurements[f.key] === '');
            if (missing) {
                submittingRef.current = false;
                setActiveTab('BLOUSE');
                setTimeout(() => {
                    const el = document.getElementById(`meas_input_${missing.key}`);
                    if (el) {
                        el.focus();
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 100);
                return toast.error(`Enter ${missing.label}`);
            }
        }

        // Intercept UPI payments to show Dynamic QR Modal
        const isUpiMethod = ['UPI / Dynamic QR Code', 'PhonePe', 'Google Pay', 'Paytm', 'UPI'].includes(paymentMethod);
        if (isUpiMethod && advance > 0 && !customPaymentId && !isAdvanceVerified) {
            setShowUpiQrModal(true);
            submittingRef.current = false;
            return;
        }

        const isOffline = !navigator.onLine;
        
        // Prepare data payloads
        const measPayload = {};
        ALL_MEASUREMENT_KEYS.forEach(k => { if (measurements[k]) measPayload[k] = parseFloat(measurements[k]); });
        if (extraMeasurements && extraMeasurements.length > 0) {
            measPayload.extra_measurements = extraMeasurements;
        }

        const svcList = services.map(s => ({
            service_type: s.service_type === 'Other' ? (s.custom_type || 'Other') : s.service_type,
            quantity: parseInt(s.quantity) || 1,
            price: parseFloat(s.price),
        }));

        const activePaymentId = customPaymentId || verifiedPayId;
        const activeVerified = isAdvanceVerified || !!customPaymentId;

        let notesWithDiscount = customer.notes || '';
        if (discountAmount > 0) {
            notesWithDiscount = (notesWithDiscount ? notesWithDiscount + ' | ' : '') + `Discount: ₹${discountAmount.toFixed(2)}`;
        }

        const orderPayload = {
            booking_date: bookingDate,
            delivery_date: deliveryDate,
            advance_paid: advance,
            discount: discountAmount,
            notes: notesWithDiscount,
            measurement_type: measurementType,
            services: svcList,
            assigned_worker: assignedWorker,
            payment_method: activeVerified ? `${paymentMethod} (Verified Ref: ${activePaymentId})` : paymentMethod,
        };

        if (isOffline) {
            setLoading(true);
            try {
                const audioData = audioBlob ? await blobToBase64(audioBlob) : null;
                const offlineData = {
                    customer_id: customerId,
                    customer: !customerId ? { name: customer.name, phone_number: customer.phone_number } : undefined,
                    measPayload,
                    orderPayload,
                    images: images.length > 0 ? images : [],
                    audioData,
                    recordingTime: audioBlob ? recordingTime : null
                };

                const insertId = await saveOfflineOrder(offlineData);
                toast.success('Offline mode: Order saved locally! It will sync when internet is back.', { duration: 5000 });
                localStorage.removeItem('newOrderDraft');
                deleteActiveDraft();
                
                if (auth?.role === 'Worker') {
                    navigate('/');
                } else {
                    navigate(`/bill/offline-${insertId}`);
                }
            } catch (err) {
                toast.error('Failed to save offline order');
            } finally {
                setLoading(false);
                submittingRef.current = false;
            }
            return;
        }

        setLoading(true);
        try {
            const audioData = audioBlob ? await blobToBase64(audioBlob) : null;
            
            const finalPayload = {
                ...orderPayload,
                customer_id: customerId,
                customer: !customerId ? { name: customer.name, phone_number: customer.phone_number } : undefined,
                measurements: Object.keys(measPayload).length > 0 ? measPayload : undefined,
                images: images.length > 0 ? images : undefined,
                audio_data: audioData,
                recordingTime: audioBlob ? recordingTime : undefined
            };

            const orderRes = await api.post('/orders', finalPayload);
            const createdOrderId = orderRes.data.order_id;

            toast.success('Order created successfully!');
            localStorage.removeItem('newOrderDraft');
            deleteActiveDraft();
            if (auth?.role === 'Worker') {
                navigate('/');
            } else {
                navigate(`/bill/${createdOrderId}`);
            }
        } catch (err) {
            console.error('Order creation failed:', err);
            toast.error(err.response?.data?.error || 'Failed to create order');
            submittingRef.current = false; // allow retry on error
        } finally {
            setLoading(false);
        }
    }

    return (
        <div>
            {/* ── Full-screen loading overlay when creating order ── */}
            {loading && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9999,
                    background: 'rgba(20, 5, 9, 0.95)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 20,
                }}>
                    {/* Spinning ring */}
                    <div style={{
                        width: 64, height: 64,
                        border: '4px solid rgba(198,167,94,0.2)',
                        borderTop: '4px solid var(--gold)',
                        borderRight: '4px solid rgba(198,167,94,0.5)',
                        borderRadius: '50%',
                        animation: 'spin 0.75s linear infinite',
                    }} />
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                            Creating Order...
                        </div>
                        <div style={{ fontSize: 13, color: 'rgba(198,167,94,0.7)', letterSpacing: '0.02em' }}>
                            Saving customer &amp; measurements · Please wait
                        </div>
                    </div>
                    {/* Pulsing dots */}
                    <div style={{ display: 'flex', gap: 6 }}>
                        {[0, 1, 2].map(i => (
                            <div key={i} style={{
                                width: 8, height: 8,
                                borderRadius: '50%',
                                background: 'var(--gold)',
                                animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                                opacity: 0.7,
                            }} />
                        ))}
                    </div>
                    <style>{`
                        @keyframes pulse {
                            0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
                            40% { transform: scale(1); opacity: 1; }
                        }
                    `}</style>
                </div>
            )}
            {/* Top bar */}
            <div className="topbar flex-between">
                <div className="flex">
                    <button className="mobile-menu-btn" onClick={onMenuClick}>
                        <Menu size={22} />
                    </button>
                    <div>
                        <div className="topbar-title">New Order</div>
                        <div className="topbar-subtitle">Create a new tailoring order</div>
                    </div>
                </div>
                <div className="flex gap-8" style={{ flexWrap: 'wrap', flexShrink: 0, minWidth: 0 }}>
                    <button 
                        type="button" 
                        className="btn btn-outline btn-sm" 
                        onClick={() => {
                            if (!auth?.isPremiumActive) {
                                toast.error("👑 Order drafts are a Premium Feature. Please subscribe to premium to view and load drafts!");
                                return;
                            }
                            setShowDraftsModal(true);
                        }} 
                        title={`View Saved Drafts (${savedDrafts.length})`} 
                        style={{ padding: '5px 10px', fontSize: 11 }}
                    >
                        <FolderOpen size={13} /> <span className="hide-mobile">Drafts </span>({savedDrafts.length})
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={saveCurrentAsDraft} title="Save Current Form as Draft" style={{ padding: '5px 10px', fontSize: 11 }}>
                        <Save size={13} /> <span className="hide-mobile">Save Draft</span>
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={clearForm} title="Clear Form to start a new bill" style={{ padding: '5px 10px', fontSize: 11, color: 'var(--maroon)' }}>
                        <span className="hide-mobile">Clear</span>
                        <span className="show-on-mobile" style={{ fontSize: 11 }}>✕</span>
                    </button>
                </div>
            </div>

            <div className="page-container">
                <form onSubmit={handleSubmit}>

                    {/* ─── CUSTOMER DETAILS ───────────────── */}
                    <div className="card mb-16">
                        <div className="card-header">
                            <h3 className="card-title flex gap-8"><User size={18} color="var(--gold)" /> Customer Details</h3>
                        </div>
                        <div className="card-body">
                            {/* Phone search row */}
                            <div className="form-group">
                                <label className="form-label">Phone Number *</label>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', alignItems: 'stretch' }}>
                                    <div className="input-prefix" style={{ flex: 1, minWidth: 0 }}>
                                        <span className="prefix-symbol">+91</span>
                                        <input
                                            type="tel"
                                            ref={phoneRef}
                                            value={customer.phone_number}
                                            onChange={e => {
                                                setCustomer(c => ({ ...c, phone_number: e.target.value }));
                                                if (customerFound) setCustomerFound(false);
                                            }}
                                            placeholder="10-digit number"
                                            maxLength={10}
                                            required
                                        />
                                    </div>
                                    <button type="button" className="btn btn-outline" onClick={handlePhoneSearch} disabled={searchLoading} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                                        <Search size={15} /> {searchLoading ? 'Searching…' : 'Search'}
                                    </button>
                                </div>
                                {customerFound && (
                                    <div className="alert alert-success mt-8" style={{ marginBottom: 0 }}>
                                        ✅ Existing customer found — measurements pre-filled
                                    </div>
                                )}
                            </div>

                            <div className="grid-2">
                                <div className="form-group">
                                    <label className="form-label">Customer Name *</label>
                                    <input
                                        className="form-input"
                                        value={customer.name}
                                        onChange={e => setCustomer(c => ({ ...c, name: e.target.value }))}
                                        placeholder="Full name"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Notes & Voice Instructions</label>
                                    <input
                                        className="form-input"
                                        value={customer.notes}
                                        onChange={e => setCustomer(c => ({ ...c, notes: e.target.value }))}
                                        placeholder="Any special written instructions..."
                                    />
                                    <div style={{ marginTop: 8 }}>
                                        {isRecording ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#FFEBEE', padding: '8px 12px', borderRadius: 8, border: '1px solid #FFCDD2' }}>
                                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#D32F2F', animation: 'blink 1s infinite' }} />
                                                <span style={{ color: '#D32F2F', fontWeight: 600, fontSize: 13, flex: 1 }}>Recording: {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')} / 2:00</span>
                                                <button type="button" onClick={stopRecording} style={{ background: '#D32F2F', color: 'white', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                                                    <Square size={12} /> Stop
                                                </button>
                                            </div>
                                        ) : audioUrl ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#E8F5E9', padding: '8px 12px', borderRadius: 8, border: '1px solid #C8E6C9' }}>
                                                <audio src={audioUrl} controls style={{ height: 32, flex: 1 }} />
                                                <button type="button" onClick={clearAudio} style={{ background: 'transparent', border: 'none', color: '#D32F2F', cursor: 'pointer', padding: 4 }} title="Delete voice note">
                                                    <Trash size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button type="button" className="btn btn-outline btn-sm" onClick={startRecording} style={{ width: '100%', justifyContent: 'center', gap: 6 }}>
                                                <Mic size={14} color="#D32F2F" /> Record Voice Note (Max 2m)
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid-2">
                                <div className="form-group">
                                    <label className="form-label">Booking Date *</label>
                                    <input className="form-input" type="date" value={bookingDate}
                                        onChange={e => setBookingDate(e.target.value)} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Delivery Date *</label>
                                    <input className="form-input" type="date" value={deliveryDate}
                                        onChange={e => setDeliveryDate(e.target.value)} min={bookingDate} required />
                                </div>
                            </div>


                        </div>
                    </div>

                    {/* ─── MEASUREMENTS ───────────────────── */}
                    <div className="card mb-16">
                        <div className="card-header flex-between">
                            <h3 className="card-title flex gap-8"><Ruler size={18} color="var(--gold)" /> Fittings & Measurements</h3>
                            <div className="flex gap-4" style={{ 
                                background: 'var(--ivory)', 
                                padding: 4, 
                                borderRadius: 20, 
                                border: '1px solid var(--gray-light)',
                                display: 'flex',
                                flexWrap: 'wrap',
                                justifyContent: 'center'
                            }}>
                                <button type="button"
                                    className={`btn btn-sm ${measurementType === 'Body' ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ borderRadius: 16, padding: '4px 10px', fontSize: '12px', flex: '1 1 auto' }}
                                    onClick={() => setMeasurementType('Body')}>
                                    Body Measurements
                                </button>
                                <button type="button"
                                    className={`btn btn-sm ${measurementType === 'Sample' ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ borderRadius: 16, padding: '4px 10px', fontSize: '12px', flex: '1 1 auto' }}
                                    onClick={() => setMeasurementType('Sample')}>
                                    Existing Piece
                                </button>
                            </div>
                        </div>
                        <div className="card-body">
                            {/* Toggle between tabs */}
                            <div className="flex gap-8 mb-20" style={{ borderBottom: '1px solid var(--gray-light)', paddingBottom: 12, overflowX: 'auto', whiteSpace: 'nowrap' }}>
                                {Object.keys(measurementLabels).map(tab => (
                                    <button type="button" key={tab}
                                        className={`btn btn-sm ${activeTab === tab ? 'btn-primary' : 'btn-outline'}`}
                                        onClick={() => setActiveTab(tab)}
                                        style={{ borderRadius: 8, minWidth: '100px' }}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            {measurementType === 'Sample' ? (
                                <div className="alert alert-success mt-8" style={{ marginBottom: 0, textAlign: 'center' }}>
                                    ✅ Customer provided an existing fitting piece. Body measurements are not required.
                                </div>
                            ) : (
                                <div className="measurements-grid">
                                    {(measurementLabels[activeTab] || []).map(f => (
                                        <div className="form-group" key={f.key}>
                                            <label className="form-label">{f.label}</label>
                                            <div className="input-prefix">
                                                <span className="prefix-symbol" style={{ fontSize: 11, padding: '10px 8px' }}>inches</span>
                                                <input
                                                    id={`meas_input_${f.key}`}
                                                    type="number"
                                                    step="any"
                                                    min="0"
                                                    value={measurements[f.key] || ''}
                                                    onChange={e => setMeasurements(m => ({ ...m, [f.key]: e.target.value }))}
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* ─── EXTRA MEASUREMENTS (DYNAMIC ROWS) ─── */}
                            {measurementType !== 'Sample' && (
                                <div style={{ marginTop: 24, paddingTop: 20, borderTop: '2px dashed var(--gray-light)' }}>
                                    <div className="flex-between mb-16">
                                        <h4 style={{ margin: 0, fontFamily: 'var(--font-serif)', color: 'var(--maroon-dark)', fontSize: 16, fontWeight: 600 }}>
                                            Extra Garment Measurements
                                        </h4>
                                        <button type="button" className="btn btn-sm btn-outline" onClick={addExtraMeasurement} style={{ gap: 6 }}>
                                            <Plus size={14} /> Add Garment Row
                                        </button>
                                    </div>

                                    {extraMeasurements.map((extra, idx) => (
                                        <div key={extra.id} className="card mb-16" style={{ background: 'var(--ivory)', border: '1px solid var(--gold-pale)', padding: 16 }}>
                                        <div className="extra-meas-header-row">
                                                <div style={{ flex: 2, minWidth: 0 }}>
                                                        <label className="form-label" style={{ fontSize: 11 }}>Garment / Reference Name *</label>
                                                        <input
                                                            className="form-input"
                                                            value={extra.name}
                                                            onChange={e => updateExtraMeasurement(extra.id, 'name', e.target.value)}
                                                            placeholder="e.g. Garment 2..."
                                                            required
                                                            style={{ height: 36, fontSize: 13 }}
                                                        />
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <label className="form-label" style={{ fontSize: 11 }}>Garment Type</label>
                                                        <select
                                                            className="form-select"
                                                            value={extra.type}
                                                            onChange={e => updateExtraMeasurement(extra.id, 'type', e.target.value)}
                                                            style={{ height: 36, fontSize: 13, padding: '0 8px' }}
                                                        >
                                                            {Object.keys(measurementLabels).map(type => (
                                                                <option key={type} value={type}>{type}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeExtraMeasurement(extra.id)} style={{ color: 'var(--maroon)', height: 36, flexShrink: 0 }} title="Remove this garment">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            <div className="measurements-grid">
                                                {(measurementLabels[extra.type] || []).map(f => (
                                                    <div className="form-group" key={f.key}>
                                                        <label className="form-label">{f.label}</label>
                                                        <div className="input-prefix">
                                                            <span className="prefix-symbol" style={{ fontSize: 11, padding: '10px 8px' }}>inches</span>
                                                            <input
                                                                type="number"
                                                                step="any"
                                                                min="0"
                                                                value={extra.values[f.key] || ''}
                                                                onChange={e => updateExtraMeasurementValue(extra.id, f.key, e.target.value)}
                                                                placeholder="0"
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ─── SERVICES ───────────────────────── */}
                    <div className="card mb-16">
                        <div className="card-header">
                            <h3 className="card-title flex gap-8"><Scissors size={18} color="var(--gold)" /> Services</h3>
                            <button type="button" className="btn btn-sm btn-outline" onClick={addService}>
                                <Plus size={14} /> Add Row
                            </button>
                        </div>
                        <div className="card-body">
                            {/* Header row */}
                            <div className="service-header-row">
                                <span className="form-label">Service Type</span>
                                <span className="form-label">Qty</span>
                                <span className="form-label">Price (₹)</span>
                                <span />
                            </div>

                            {services.map((svc, i) => (
                                <div key={i} className="service-item-row">
                                    <div className="service-type-col">
                                        <label className="form-label show-on-mobile">Service Type</label>
                                        <select
                                            className="form-select"
                                            value={svc.service_type}
                                            onChange={e => updateService(i, 'service_type', e.target.value)}
                                        >
                                            {SERVICE_TYPES.map(t => <option key={t}>{t}</option>)}
                                        </select>
                                        {svc.service_type === 'Other' && (
                                            <input
                                                className="form-input mt-8"
                                                placeholder="Specify service..."
                                                value={svc.custom_type}
                                                onChange={e => updateService(i, 'custom_type', e.target.value)}
                                                required
                                            />
                                        )}
                                    </div>
                                    <div className="service-qty-col">
                                        <label className="form-label show-on-mobile">Qty</label>
                                        <input
                                            className="form-input"
                                            type="number"
                                            min="1"
                                            value={svc.quantity}
                                            onChange={e => updateService(i, 'quantity', e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="service-price-col">
                                        <label className="form-label show-on-mobile">Price (₹)</label>
                                        <div className="input-prefix">
                                            <span className="prefix-symbol">₹</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={svc.price}
                                                onChange={e => updateService(i, 'price', e.target.value)}
                                                placeholder="0.00"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="service-action-col">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-danger delete-service-btn"
                                            onClick={() => removeService(i)}
                                            disabled={services.length === 1}
                                        >
                                            <Trash2 size={14} /> <span className="show-on-mobile">Delete</span>
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {/* Subtotals per service */}
                            {services.length > 0 && (
                                <div style={{ background: 'var(--blush)', borderRadius: 8, padding: '12px 16px', marginTop: 8 }}>
                                    {services.map((svc, i) => {
                                        const sub = (parseFloat(svc.price) || 0) * (parseFloat(svc.quantity) || 0);
                                        return (
                                            <div key={i} className="flex-between" style={{ fontSize: 13, padding: '3px 0' }}>
                                                <span>{svc.service_type === 'Other' ? svc.custom_type || 'Other' : svc.service_type} × {svc.quantity}</span>
                                                <strong>₹{sub.toFixed(2)}</strong>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>


                    {/* ─── DESIGN IMAGES ──────────────────── */}
                    <div className="card mb-16">
                        <div className="card-header">
                            <h3 className="card-title flex gap-8"><ImageIcon size={18} color="var(--gold)" /> Design Reference Images</h3>
                            <span className="badge" style={{ background: '#E3F2FD', color: '#1565C0', border: '1px solid #BBDEFB', fontSize: 11 }}>
                                Optional
                            </span>
                        </div>
                        <div className="card-body">
                            <div className="grid-2 gap-16 images-upload-grid" style={{ marginBottom: 16 }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Gallery Upload</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleImageUpload}
                                        className="form-input"
                                        style={{ padding: '8px' }}
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Camera Capture</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={handleImageUpload}
                                        ref={cameraInputRef}
                                        style={{ display: 'none' }}
                                    />
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        style={{ width: '100%', height: '42px', display: 'flex', justifyContent: 'center', gap: 8, borderColor: 'var(--gold)', color: 'var(--gold)' }}
                                        onClick={() => cameraInputRef.current?.click()}
                                    >
                                        <Camera size={18} /> Take Photo
                                    </button>
                                </div>
                                <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
                                    <label className="form-label">Scratch Pad (Draw Backneck Patterns)</label>
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        style={{ width: '100%', height: '42px', display: 'flex', justifyContent: 'center', gap: 8, borderColor: 'var(--maroon)', color: 'var(--maroon)' }}
                                        onClick={() => setShowScratchPad(true)}
                                    >
                                        <PenTool size={18} /> Open Scratch Pad
                                    </button>
                                </div>
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--gray)', marginTop: 4 }}>Images are automatically compressed to save space.</p>
                            {images.length > 0 && (
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                    {images.map((src, i) => (
                                        <div key={i} style={{ position: 'relative', width: 100, height: 100, border: '1px solid var(--gray-light)', borderRadius: 8, overflow: 'hidden' }}>
                                            <img src={src} alt="Design preview" style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} onClick={() => setSelectedImage(src)} />
                                            <button
                                                type="button"
                                                onClick={() => removeImage(i)}
                                                style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', padding: 4, cursor: 'pointer' }}
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ─── PAYMENT SUMMARY ────────────────── */}
                    <div className="card mb-16">
                        <div className="card-header">
                            <h3 className="card-title flex gap-8"><CreditCard size={18} color="var(--gold)" /> Payment Summary</h3>
                        </div>
                        <div className="card-body">
                            <div className="grid-2">
                                <div>
                                    <div className="grid-2" style={{ gap: '12px' }}>
                                        <div className="form-group">
                                            <label className="form-label">Discount Amount (₹)</label>
                                            <div className="input-prefix">
                                                <span className="prefix-symbol">₹</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={rawTotalAmount}
                                                    step="0.01"
                                                    value={discount}
                                                    onChange={e => setDiscount(e.target.value)}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Advance Paid (₹)</label>
                                            <div className="input-prefix">
                                                <span className="prefix-symbol">₹</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={totalAmount}
                                                    step="0.01"
                                                    value={advancePaid}
                                                    onChange={e => setAdvancePaid(e.target.value)}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="form-group mt-16">
                                        <label className="form-label">Payment Method</label>
                                        <select
                                            className="form-select"
                                            value={paymentMethod}
                                            onChange={e => setPaymentMethod(e.target.value)}
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px' }}
                                        >
                                            <option value="Cash">💵 Cash</option>
                                            <option value="UPI / Dynamic QR Code">📱 UPI / Dynamic QR Code</option>
                                            <option value="PhonePe">🟣 PhonePe</option>
                                            <option value="Google Pay">🔵 Google Pay</option>
                                            <option value="Paytm">🟦 Paytm</option>
                                            <option value="Card">💳 Card / POS Machine</option>
                                            <option value="Net Banking">🏦 Net Banking</option>
                                        </select>
                                    </div>

                                    {/* Dynamic QR Code or Inline UPI setup for UPI payment methods */}
                                    {['UPI / Dynamic QR Code', 'PhonePe', 'Google Pay', 'Paytm'].includes(paymentMethod) && (() => {
                                        const activeAuth = auth || JSON.parse(localStorage.getItem('tailor_auth') || '{}');
                                        const shopUpi = shopUpiState || activeAuth.upi_id;
                                        const shopName = activeAuth.shop_name || 'SMART TAILOR';
                                        const shopGst = activeAuth.gst_id;
                                        const qrAmount = advance > 0 ? advance : totalAmount;
                                        
                                        if (services.length === 0 || totalAmount <= 0) {
                                            return (
                                                <div style={{ marginTop: '16px', padding: '12px 14px', background: 'rgba(211,47,47,0.05)', border: '1px dashed #d32f2f', borderRadius: '8px', color: '#c62828', fontSize: '11.5px', textAlign: 'center', fontWeight: '500' }}>
                                                    ⚠️ Please add stitching services first before scanning for payment.
                                                </div>
                                            );
                                        }

                                        if (advance > totalAmount) {
                                            return (
                                                <div style={{ marginTop: '16px', padding: '12px 14px', background: 'rgba(211,47,47,0.05)', border: '1px dashed #d32f2f', borderRadius: '8px', color: '#c62828', fontSize: '11.5px', textAlign: 'center', fontWeight: '500' }}>
                                                    ⚠️ Advance amount cannot exceed the Total Amount (₹{totalAmount.toFixed(2)}).
                                                </div>
                                            );
                                        }

                                        if (shopGst && shopGst.trim()) {
                                            // GST Registered Shop: Razorpay Secure Checkout
                                            return (
                                                <div style={{ width: '100%' }}>
                                                    {isAdvanceVerified ? (
                                                        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(46,125,50,0.04)', border: '1px solid rgba(46,125,50,0.15)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                                                            <span style={{ color: '#2E7D32', fontWeight: 'bold', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                                                                ✓ Payment Verified via Razorpay ⚡
                                                            </span>
                                                            <span style={{ fontSize: '11px', color: 'var(--gray)', marginTop: '4px' }}>
                                                                Payment ID: <strong>{verifiedPayId}</strong>
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(212,175,55,0.03)', border: '1px dashed #d4af37', padding: '16px', borderRadius: '8px', textAlign: 'center', width: '100%' }}>
                                                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--maroon-dark)', marginBottom: '4px' }}>
                                                                GST Registered Shop (Razorpay Gateway Active)
                                                            </div>
                                                            <p style={{ fontSize: '11.5px', color: 'var(--gray)', margin: '0 0 12px 0', lineHeight: '1.4' }}>
                                                                Collect customer payment of ₹{qrAmount.toFixed(2)} securely via card, wallet, netbanking, or UPI.
                                                            </p>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRazorpayAdvance(qrAmount)}
                                                                disabled={processingRazorpay}
                                                                className="btn btn-secondary"
                                                                style={{
                                                                    padding: '10px 18px', borderRadius: '8px',
                                                                    background: 'linear-gradient(135deg, #6A1E2E 0%, #4A101C 100%)',
                                                                    color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '13px',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                                    boxShadow: '0 4px 10px rgba(106,30,46,0.15)', cursor: 'pointer', width: '100%'
                                                                }}
                                                            >
                                                                {processingRazorpay ? 'Processing...' : `Pay ₹${qrAmount.toFixed(2)} via Razorpay`}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                        
                                        if (!shopUpi || !shopUpi.trim()) {
                                            return (
                                                <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(106,30,46,0.04)', border: '1px dashed var(--maroon)', borderRadius: '10px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--maroon-dark)', marginBottom: '4px' }}>
                                                        ⚡ Quick Setup: Enter Boutique UPI ID
                                                    </div>
                                                    <p style={{ fontSize: '11.5px', color: 'var(--gray)', margin: '0 0 12px 0', lineHeight: '1.4' }}>
                                                        Enter your UPI ID below once to generate instant scan-to-pay QR codes directly on your screen &amp; bills!
                                                    </p>
                                                    <div style={{ display: 'flex', gap: '8px', maxWidth: '380px', margin: '0 auto' }}>
                                                        <input 
                                                            type="text" 
                                                            placeholder="e.g. 9876543210@ybl or shop@upi" 
                                                            value={inlineUpi} 
                                                            onChange={(e) => setInlineUpi(e.target.value)} 
                                                            className="form-input" 
                                                            style={{ fontSize: '12.5px', flex: 1, padding: '8px 12px' }}
                                                        />
                                                        <button 
                                                            type="button" 
                                                            onClick={handleSaveInlineUpi} 
                                                            disabled={savingInlineUpi}
                                                            className="btn btn-primary"
                                                            style={{ padding: '8px 14px', fontSize: '12px', whiteSpace: 'nowrap', background: 'var(--gold)', color: '#4A101C', fontWeight: 'bold' }}
                                                        >
                                                            {savingInlineUpi ? 'Saving...' : '⚡ Save & Generate QR'}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fff', padding: '16px', borderRadius: '10px', border: '1px solid rgba(198,167,94,0.3)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--maroon-dark)', marginBottom: 8, textAlign: 'center' }}>
                                                    Scan to Pay Amount: <span style={{ color: '#2E7D32' }}>{`\u20b9${qrAmount.toFixed(2)}`}</span>
                                                </div>
                                                <QRCode 
                                                    value={generateUpiUri({ upiId: shopUpi, shopName: shopName, amount: qrAmount, note: 'Advance Payment' })} 
                                                    size={130} 
                                                    level="L" 
                                                />

                                                <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 8, textAlign: 'center', fontWeight: 500 }}>
                                                    Scan with PhonePe, GPay, Paytm, or BHIM UPI
                                                </div>
                                                <div style={{ fontSize: 10, color: 'var(--maroon)', marginTop: 2, textAlign: 'center', marginBottom: 12 }}>
                                                    UPI ID: <strong>{shopUpi.trim()}</strong>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowUpiQrModal(true)}
                                                    className="btn btn-maroon btn-sm"
                                                    style={{ width: '100%', borderRadius: '8px', padding: '8px 12px', fontSize: '12px' }}
                                                >
                                                    📱 Open Full-Screen Scan &amp; Pay Screen
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        setIsAdvanceVerified(true);
                                                        handleSubmit(e, `UPI_DIRECT_${Date.now()}`);
                                                    }}
                                                    className="btn btn-sm"
                                                    style={{ width: '100%', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', marginTop: '8px', backgroundColor: '#2E7D32', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}
                                                >
                                                    ⚡ Confirm Payment &amp; Create Bill
                                                </button>
                                            </div>

                                        );
                                    })()}

                                </div>
                                <div>
                                    <div style={{ background: 'var(--ivory)', borderRadius: 10, padding: '16px 20px', border: '1px solid var(--gray-light)' }}>
                                        <div className="flex-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--gray-light)' }}>
                                            <span style={{ color: 'var(--gray)', fontSize: 13 }}>Subtotal</span>
                                            <strong style={{ fontSize: 14, color: 'var(--maroon-dark)' }}>₹{rawTotalAmount.toFixed(2)}</strong>
                                        </div>
                                        {discountAmount > 0 && (
                                            <div className="flex-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--gray-light)' }}>
                                                <span style={{ color: 'var(--gray)', fontSize: 13 }}>Discount</span>
                                                <span style={{ color: '#D32F2F', fontWeight: 600 }}>-₹{discountAmount.toFixed(2)}</span>
                                            </div>
                                        )}
                                        <div className="flex-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--gray-light)' }}>
                                            <span style={{ color: 'var(--gray)', fontSize: 13, fontWeight: 600 }}>Final Total Amount</span>
                                            <strong style={{ fontSize: 16, color: 'var(--maroon-dark)' }}>₹{totalAmount.toFixed(2)}</strong>
                                        </div>
                                        <div className="flex-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--gray-light)' }}>
                                            <span style={{ color: 'var(--gray)', fontSize: 13 }}>Advance Paid</span>
                                            <span style={{ color: '#2E7D32', fontWeight: 600 }}>₹{advance.toFixed(2)}</span>
                                        </div>
                                        <div className="flex-between" style={{ padding: '10px 0 0' }}>
                                            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--maroon-dark)' }}>Balance Due</span>
                                            <strong style={{ fontSize: 18, color: balance > 0 ? '#E65100' : '#2E7D32' }}>
                                                ₹{balance.toFixed(2)}
                                            </strong>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="flex gap-12 new-order-actions" style={{ justifyContent: 'flex-end', marginTop: 8, paddingBottom: 8, flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-ghost" style={{ flex: '0 1 auto', minWidth: '100px' }} onClick={() => { localStorage.removeItem('newOrderDraft'); navigate('/'); }}>Cancel</button>
                        <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ flex: '1 1 auto', minWidth: '180px', justifyContent: 'center' }}>
                            {loading ? (
                                <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid #fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />&nbsp;Creating..&nbsp;</>
                            ) : '✓ Create Order & View Bill'}
                        </button>
                    </div>

                </form>
            </div>
            
            {showScratchPad && (
                <ScratchPad 
                    onSave={handleScratchSave} 
                    onClose={() => setShowScratchPad(false)} 
                />
            )}

            {/* Fullscreen Image Modal */}
            {selectedImage && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setSelectedImage(null)}>
                    <img src={selectedImage} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: '8px' }} onClick={(e) => e.stopPropagation()} />
                    <button style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '50%', padding: '8px', display: 'flex' }} onClick={() => setSelectedImage(null)}>
                        <X size={24} />
                    </button>
                </div>
            )}

            {/* Drafts Modal Overlay */}
            {showDraftsModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9999,
                    background: 'rgba(0, 0, 0, 0.5)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 16
                }} onClick={() => setShowDraftsModal(false)}>
                    <div className="card" style={{
                        width: '100%',
                        maxWidth: 480,
                        maxHeight: '80vh',
                        overflowY: 'auto',
                        background: '#fff',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.12)'
                    }} onClick={e => e.stopPropagation()}>
                        <div className="card-header flex-between" style={{ borderBottom: '1px solid var(--gray-light)' }}>
                            <h3 className="card-title flex gap-8">
                                <FolderOpen size={18} color="var(--gold)" /> Saved Drafts
                            </h3>
                            <button type="button" className="btn btn-sm btn-ghost p-4" onClick={() => setShowDraftsModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="card-body" style={{ padding: 16 }}>
                            {savedDrafts.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--gray)' }}>
                                    <FolderOpen size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                                    <div>No saved drafts found.</div>
                                    <div style={{ fontSize: 12, marginTop: 4 }}>Fill the form and click "Save Draft" to keep your work.</div>
                                </div>
                            ) : (
                                <div className="flex flex-column gap-12">
                                    {savedDrafts.map(d => (
                                        <div key={d.id} className="draft-item" style={{
                                            padding: 12,
                                            borderRadius: 8,
                                            background: 'var(--ivory)',
                                            border: '1px solid var(--gray-light)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }} onClick={() => loadDraft(d)}>
                                            <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                                                <strong style={{ display: 'block', fontSize: 14, color: 'var(--maroon)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                    {d.name}
                                                </strong>
                                                <span style={{ fontSize: 11, color: 'var(--gray)' }}>
                                                    Saved: {new Date(d.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} · {new Date(d.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className="flex gap-4">
                                                <button type="button" className="btn btn-sm btn-danger p-8" onClick={(e) => deleteDraft(d.id, e)} title="Delete draft">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Mock Razorpay Checkout Modal (Sandbox Mode) ── */}
            {showMockRazorpay && (() => {
                const activeAuth = auth || JSON.parse(localStorage.getItem('tailor_auth')) || {};
                return (
                    <div style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 10000,
                        background: 'rgba(0, 0, 0, 0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px'
                    }}>
                        <div style={{
                            width: '100%',
                            maxWidth: '380px',
                            background: '#ffffff',
                            borderRadius: '16px',
                            overflow: 'hidden',
                            boxShadow: '0 12px 30px rgba(0,0,0,0.15)',
                            animation: 'fadeInUp 0.3s ease-out'
                        }}>
                            {/* Header */}
                            <div style={{
                                background: '#1A0A10',
                                padding: '24px 20px',
                                color: '#ffffff',
                                position: 'relative'
                            }}>
                                <button 
                                    onClick={() => {
                                        setShowMockRazorpay(false);
                                        toast.error('Payment cancelled.');
                                    }}
                                    style={{
                                        position: 'absolute',
                                        top: '16px',
                                        right: '16px',
                                        background: 'none',
                                        border: 'none',
                                        color: 'rgba(255,255,255,0.7)',
                                        fontSize: '18px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <X size={20} />
                                </button>
                                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--gold)', fontWeight: 'bold', marginBottom: '4px' }}>
                                    Razorpay Secure Payment
                                </div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'var(--font-serif)' }}>
                                    {activeAuth.shop_name || 'SMART TAILOR'}
                                </div>
                            </div>

                            {/* Content */}
                            <div style={{ padding: '24px 20px' }}>
                                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--gray)', marginBottom: '4px' }}>
                                        Amount to Pay (Advance)
                                    </div>
                                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1A0A10' }}>
                                        ₹{mockRazorpayAmount.toFixed(2)}
                                    </div>
                                    <span style={{
                                        display: 'inline-block',
                                        background: '#FFF8E1',
                                        color: '#F57F17',
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        padding: '4px 10px',
                                        borderRadius: '12px',
                                        border: '1px solid #FFE082',
                                        marginTop: '8px'
                                    }}>
                                        ⚡ SANDBOX TEST MODE
                                    </span>
                                </div>

                                <div style={{ borderTop: '1px solid var(--gray-light)', paddingTop: '16px', marginBottom: '24px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '8px' }}>
                                        <span style={{ color: 'var(--gray)' }}>Customer:</span>
                                        <strong style={{ color: '#1A0A10' }}>{customer.name || 'Walk-in Customer'}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '8px' }}>
                                        <span style={{ color: 'var(--gray)' }}>Phone:</span>
                                        <strong style={{ color: '#1A0A10' }}>+91 {customer.phone_number || 'N/A'}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                                        <span style={{ color: 'var(--gray)' }}>Order Ref:</span>
                                        <strong style={{ color: '#1A0A10', fontFamily: 'monospace', fontSize: '11px' }}>{mockOrderId}</strong>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <button
                                        onClick={handleMockPaymentSuccess}
                                        style={{
                                            background: 'linear-gradient(135deg, #2E7D32 0%, #1B5E20 100%)',
                                            color: '#ffffff',
                                            border: 'none',
                                            padding: '12px',
                                            borderRadius: '8px',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            fontSize: '13.5px',
                                            boxShadow: '0 4px 12px rgba(46,125,50,0.2)',
                                            transition: 'transform 0.2s'
                                        }}
                                    >
                                        Simulate Successful Payment
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowMockRazorpay(false);
                                            toast.error('Payment cancelled by customer.');
                                        }}
                                        style={{
                                            background: '#f5f5f5',
                                            color: '#c62828',
                                            border: '1px solid #e0e0e0',
                                            padding: '12px',
                                            borderRadius: '8px',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            fontSize: '13.5px',
                                            transition: 'background 0.2s'
                                        }}
                                    >
                                        Cancel Payment
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── Multi-Tenant Dynamic UPI QR Payment Modal ── */}
            <TenantUpiQRModal
                isOpen={showUpiQrModal}
                onClose={() => {
                    setShowUpiQrModal(false);
                    submittingRef.current = false;
                }}
                onPaymentSuccess={async (payDetails) => {
                    setShowUpiQrModal(false);
                    setIsAdvanceVerified(true);
                    const payId = payDetails?.payment_id || `UPI_SCAN_${Date.now()}`;
                    setVerifiedPayId(payId);
                    submittingRef.current = false; // Reset submitting guard
                    toast.success('⚡ Payment verified! Creating order & bill...');
                    setTimeout(() => {
                        handleSubmit(null, payId);
                    }, 100);
                }}

                amount={advance > 0 ? advance : totalAmount}
                customerName={customer.name || 'Walk-in Customer'}
                upiId={shopUpiState || (auth || JSON.parse(localStorage.getItem('tailor_auth') || '{}')).upi_id || ''}
                shopName={(auth || JSON.parse(localStorage.getItem('tailor_auth') || '{}')).shop_name || 'SMART TAILOR'}
                shopLogo={(auth || JSON.parse(localStorage.getItem('tailor_auth') || '{}')).shop_logo || ''}
                note="Order Advance Payment"
            />

            <style>{`
                @keyframes blink { 50% { opacity: 0.5; } }
            `}</style>
        </div>
    );
}

