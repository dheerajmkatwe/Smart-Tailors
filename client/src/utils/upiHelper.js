/**
 * Generates a clean, NPCI-compliant UPI Deep Link URI for dynamic QR codes.
 * Compatible with PhonePe, Google Pay, Paytm, BHIM, Cred, and all Indian UPI apps.
 */
export function generateUpiUri({ upiId, shopName, amount, note }) {
    if (!upiId || !upiId.trim()) return '';
    
    // Clean UPI ID (trim spaces)
    const cleanUpi = upiId.trim();
    
    // Clean Payee Name (pn): Standard alphanumeric + spaces, max 50 chars.
    // IMPORTANT: Do NOT use encodeURIComponent (%20) as PhonePe & GPay scanners fail regex on %20!
    let cleanName = (shopName || 'Boutique')
        .replace(/[^a-zA-Z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 50);

    if (!cleanName) cleanName = 'Boutique';

    // Clean Note (tn): Alphanumeric + spaces, max 40 chars.
    let cleanNote = (note || 'Payment')
        .replace(/[^a-zA-Z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 40);

    const formattedAmount = Number(amount || 0).toFixed(2);

    // NPCI standard UPI format for dynamic QR codes: upi://pay?pa=...&pn=...&am=...&cu=INR&mode=02&purpose=00&tn=...
    return `upi://pay?pa=${cleanUpi}&pn=${cleanName}&am=${formattedAmount}&cu=INR&mode=02&purpose=00&tn=${cleanNote}`;
}

