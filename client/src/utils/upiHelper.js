/**
 * Generates a clean, NPCI-compliant UPI Deep Link URI for dynamic QR codes.
 * Compatible with PhonePe, Google Pay, Paytm, BHIM, Cred, and all Indian UPI apps.
 */
export function generateUpiUri({ upiId, shopName, amount, note, orderId }) {
    if (!upiId || !upiId.trim()) return '';
    
    // Clean UPI ID (trim spaces)
    const cleanUpi = upiId.trim();
    
    // Clean Payee Name (pn): Standard alphanumeric + spaces, max 50 chars.
    // IMPORTANT: Do NOT use encodeURIComponent (%20) or special symbols as UPI apps reject them.
    let cleanName = (shopName || 'Boutique')
        .replace(/[^a-zA-Z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 50);

    if (!cleanName) cleanName = 'Boutique';

    // Clean Note (tn): Alphanumeric + spaces, max 40 chars.
    let cleanNote = (note || 'Order Payment')
        .replace(/[^a-zA-Z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 40);

    const formattedAmount = Number(amount || 0).toFixed(2);
    // Unique Transaction Reference ID (NPCI standard for dynamic QR tracking)
    const trId = `TR${Date.now()}`;

    // NPCI standard UPI format: upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...&tr=...
    return `upi://pay?pa=${cleanUpi}&pn=${cleanName}&am=${formattedAmount}&cu=INR&tn=${cleanNote}&tr=${trId}`;
}
