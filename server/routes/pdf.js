const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const qr = require('qr-image');
const { db, checkPremiumStatus } = require('../db');


// GET /api/pdf/:orderId
router.get('/:orderId', async (req, res) => {
    try {
        const isPremium = await checkPremiumStatus(req.tenantId);
        
        const orderRs = await db.execute({
            sql: `SELECT o.*, c.name as customer_name, c.phone_number
            FROM orders o JOIN customers c ON c.id = o.customer_id
            WHERE o.order_id = ? AND o.tenant_id = ?`,
            args: [req.params.orderId, req.tenantId]
        });

        if (orderRs.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
        const order = orderRs.rows[0];

        const tenantRs = await db.execute({
            sql: 'SELECT * FROM tenants WHERE tenant_id = ?',
            args: [req.tenantId]
        });
        const tenant = tenantRs.rows[0] || { shop_name: 'SMART TAILOR', address: '', phone_number: '', admin_name: 'SMART' };

        let shopName = tenant.shop_name;
        let shopAddress = tenant.address;
        let shopPhone = tenant.phone_number;

        if (order.branch_id) {
            const branchRs = await db.execute({
                sql: 'SELECT * FROM branches WHERE id = ?',
                args: [order.branch_id]
            });
            if (branchRs.rows.length > 0) {
                const branch = branchRs.rows[0];
                shopName = `${tenant.shop_name} (${branch.name})`;
                if (branch.address) shopAddress = branch.address;
                if (branch.phone_number) shopPhone = branch.phone_number;
            }
        }

        const servicesRs = await db.execute({
            sql: 'SELECT * FROM services WHERE order_id = ?',
            args: [req.params.orderId]
        });
        const services = servicesRs.rows;

        const baseHeight = 400 + (services.length * 20); // Extra buffer
        const finalHeight = Math.max(595.28, baseHeight); // Min height of A5
        const doc = new PDFDocument({ margin: 40, size: [419.53, finalHeight] });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Bill-${req.params.orderId}.pdf"`);
        doc.pipe(res);

        const MAROON = '#6A1E2E', GOLD = '#C6A75E', DARK = '#1A0A10';
        const GRAY = '#555555', LIGHT = '#F5F0E8';
        const pageWidth = doc.page.width, margin = 40, contentW = pageWidth - margin * 2;

        // Header background
        doc.rect(0, 0, pageWidth, 115).fill(DARK);
        doc.rect(0, 0, pageWidth, 3).fill(GOLD);

        // Shop Name & Details
        doc.font('Helvetica-Bold').fontSize(16).fillColor(GOLD)
            .text(shopName.toUpperCase(), margin, 18, { align: 'center', width: contentW });
        doc.font('Helvetica').fontSize(8).fillColor('#C6A75E')
            .text('Luxury in Every Stitch', margin, 42, { align: 'center', width: contentW });
        doc.fontSize(8).fillColor('#D4C4A0')
            .text(shopAddress || '', margin, 56, { align: 'center', width: contentW });
        doc.fontSize(8).fillColor('#D4C4A0')
            .text(shopPhone ? `Phone: ${shopPhone}` : '', margin, 70, { align: 'center', width: contentW });

        const displayId = order.order_number || order.order_id;
        doc.rect(margin, 88, contentW, 1).fill(GOLD);
        doc.font('Helvetica').fontSize(7.5).fillColor('#A8C8A0')
            .text(`Bill No: #${String(displayId).padStart(4, '0')}`, margin, 96)
            .text(`Date: ${new Date().toLocaleDateString('en-IN')}`, margin, 96, { align: 'right', width: contentW });

        let y = 130;

        // Customer Details box
        doc.rect(margin, y, contentW, 68).fill(LIGHT).stroke('#E5DDD0');
        doc.rect(margin, y, contentW, 20).fill('#EDE8DC');
        doc.font('Helvetica-Bold').fontSize(8).fillColor(MAROON)
            .text('CUSTOMER DETAILS', margin + 8, y + 6);
        y += 24;

        const info = [
            ['Customer Name', order.customer_name],
            ['Phone Number', order.phone_number],
            ['Fittings Ref.', order.measurement_type === 'Sample' ? 'Sample Piece Provided' : 'Body Measurements'],
            ['Order Date', fmtDate(order.booking_date)],
            ['Delivery Date', fmtDate(order.delivery_date)],
        ];
        info.forEach(([label, value], i) => {
            const col = i % 2 === 0 ? margin + 8 : margin + contentW / 2;
            const row = y + Math.floor(i / 2) * 12;
            doc.font('Helvetica').fontSize(7).fillColor(GRAY).text(`${label}:`, col, row);
            doc.font('Helvetica-Bold').fontSize(7).fillColor(DARK).text(value || '-', col + 65, row);
        });

        // Status badge
        const sc = order.status === 'Delivered' ? '#2E7D32' : order.status === 'Ready' ? '#1565C0' : '#E65100';
        doc.rect(margin + contentW - 65, y - 24 + 6, 60, 14).fill(sc + '22').stroke(sc);
        doc.font('Helvetica-Bold').fontSize(7).fillColor(sc)
            .text(order.status.toUpperCase(), margin + contentW - 63, y - 24 + 9, { width: 56, align: 'center' });

        y = 130 + 68 + 12;

        // Services table header
        doc.rect(margin, y, contentW, 18).fill(MAROON);
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#FFFFFF');
        const c1 = margin + 6, cW = contentW - 12;
        doc.text('SERVICE', c1, y + 5, { width: cW * 0.45 });
        doc.text('QTY', c1 + cW * 0.48, y + 5, { width: 35, align: 'center' });
        doc.text('PRICE', c1 + cW * 0.62, y + 5, { width: 50, align: 'right' });
        doc.text('SUBTOTAL', c1 + cW * 0.74, y + 5, { width: cW * 0.26, align: 'right' });
        y += 18;

        (services || []).forEach((svc, idx) => {
            doc.rect(margin, y, contentW, 16).fill(idx % 2 === 0 ? '#FFFFFF' : '#FAF7F0');
            const sub = (parseFloat(svc.price) * parseInt(svc.quantity)).toFixed(2);
            doc.font('Helvetica').fontSize(7.5).fillColor(DARK);
            doc.text(svc.service_type, c1, y + 4, { width: cW * 0.45 });
            doc.text(String(svc.quantity), c1 + cW * 0.48, y + 4, { width: 35, align: 'center' });
            doc.text(`Rs.${parseFloat(svc.price).toFixed(2)}`, c1 + cW * 0.62, y + 4, { width: 50, align: 'right' });
            doc.text(`Rs.${sub}`, c1 + cW * 0.74, y + 4, { width: cW * 0.26, align: 'right' });
            doc.moveTo(margin, y + 16).lineTo(margin + contentW, y + 16).strokeColor('#E5DDD0').lineWidth(0.5).stroke();
            y += 16;
        });

        y += 10;
        const summaryStartY = y;

        // UPI QR Code on the left side
        if (isPremium && tenant.upi_id && parseFloat(order.balance_amount) > 0) {
            try {
                const upiUrl = `upi://pay?pa=${tenant.upi_id}&pn=${encodeURIComponent(shopName)}&am=${parseFloat(order.balance_amount).toFixed(2)}&cu=INR&tn=${encodeURIComponent('Bill-' + order.order_id)}`;
                const qrPng = qr.imageSync(upiUrl, { type: 'png', margin: 1 });
                
                // Draw QR Code frame
                doc.rect(margin, summaryStartY, 50, 50).fill('#FFFFFF').stroke('#E5DDD0');
                doc.image(qrPng, margin + 2, summaryStartY + 2, { width: 46, height: 46 });
                
                doc.font('Helvetica-Bold').fontSize(6.5).fillColor(MAROON)
                    .text('SCAN TO PAY (UPI)', margin + 58, summaryStartY + 4);
                doc.font('Helvetica').fontSize(6).fillColor(GRAY)
                    .text(`Shop: ${shopName}`, margin + 58, summaryStartY + 14, { width: contentW * 0.4 - 10 });
                doc.text(`ID: ${tenant.upi_id}`, margin + 58, summaryStartY + 24, { width: contentW * 0.4 - 10 });
                doc.font('Helvetica-Oblique').fontSize(5.5).fillColor(GOLD)
                    .text('Scan with GPay, PhonePe, Paytm, BHIM', margin + 58, summaryStartY + 38);
            } catch (qrErr) {
                console.error('Error rendering QR Code:', qrErr);
            }
        }

        // Payment summary
        const sx = margin + contentW * 0.52, sw = contentW * 0.48;
        [
            ['Total Amount', `Rs.${parseFloat(order.total_amount).toFixed(2)}`, false],
            ['Advance Paid', `Rs.${parseFloat(order.advance_paid).toFixed(2)}`, false],
            ['Balance Due', `Rs.${parseFloat(order.balance_amount).toFixed(2)}`, true],
        ].forEach(([label, value, hl]) => {
            if (hl) {
                doc.rect(sx, y, sw, 18).fill(MAROON);
                doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF')
                    .text(label, sx + 6, y + 5)
                    .text(value, sx, y + 5, { width: sw - 6, align: 'right' });
                y += 18;
            } else {
                doc.rect(sx, y, sw, 15).fill(LIGHT);
                doc.font('Helvetica').fontSize(7.5).fillColor(GRAY).text(label, sx + 6, y + 4);
                doc.font('Helvetica-Bold').fontSize(7.5).fillColor(DARK).text(value, sx, y + 4, { width: sw - 6, align: 'right' });
                doc.moveTo(sx, y + 15).lineTo(sx + sw, y + 15).strokeColor('#E5DDD0').lineWidth(0.5).stroke();
                y += 15;
            }
        });

        // Watermark for Free plan
        if (!isPremium) {
            doc.save()
               .fontSize(120)
               .font('Helvetica-Bold')
               .fillColor('#6A1E2E')
               .opacity(0.06)
               .translate(pageWidth / 2, finalHeight / 2)
               .rotate(-25)
               .text('ST', -100, -60, { width: 200, align: 'center' })
               .restore();
        }

        // Footer
        const fY = doc.page.height - 58;
        doc.rect(0, fY, pageWidth, 58).fill(DARK);
        doc.rect(0, fY, pageWidth, 2).fill(GOLD);
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#C6A75E')
            .text('Note: We are not responsible for clothes left over 3 months.', margin, fY + 8, { align: 'center', width: contentW });
        doc.font('Helvetica').fontSize(7).fillColor('#9A9090')
            .text(isPremium ? 'Thank you for choosing SMART TAILOR!' : 'Smart Tailor Free Plan - Get Premium to remove watermark', margin, fY + 22, { align: 'center', width: contentW });
        doc.fontSize(6.5).fillColor('#6A6060')
            .text('Computer-generated bill. No signature required.', margin, fY + 34, { align: 'center', width: contentW });

        doc.end();
    } catch (err) {
        console.error('PDF error:', err);
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
});

function fmtDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

module.exports = router;
