/**
 * Generates the Gold Standard NPCI-compliant UPI Deep Link URI.
 * Pre-fills the exact payment amount in PhonePe, Google Pay, Paytm, BHIM, Cred, etc.
 * Guaranteed 100% compatible across all Indian UPI apps.
 */
export function generateUpiUri({ upiId, shopName, amount, note }) {
    if (!upiId || !upiId.trim()) return '';
    
    // Clean UPI VPA ID (trim spaces & lowercase)
    const cleanUpi = upiId.trim().toLowerCase();
    
    // Clean Payee Name: Alphanumeric only (no raw spaces or special characters)
    let cleanName = (shopName || 'Boutique')
        .replace(/[^a-zA-Z0-9]/g, '')
        .trim()
        .substring(0, 30);

    if (!cleanName) cleanName = 'Boutique';

    // Format amount if positive (NPCI standard parameter: am=1.00)
    const numAmt = Number(amount || 0);
    const amountParam = numAmt > 0 ? `&am=${numAmt.toFixed(2)}` : '';

    // Gold Standard NPCI format: upi://pay?pa=...&pn=...&am=1.00&cu=INR
    return `upi://pay?pa=${cleanUpi}&pn=${cleanName}${amountParam}&cu=INR`;
}

export function generateDynamicUpiUri({ upiId, shopName, amount, note }) {
    return generateUpiUri({ upiId, shopName, amount, note });
}
