const pdfGenerator = {
    _checkLib() {
        if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
            alert("PDF library failed to load. Please check your internet connection and reload the app.");
            console.error("jsPDF not available. window.jspdf =", window.jspdf);
            return false;
        }
        return true;
    },

    _getShopDetails() {
        return {
            name: 'Sai Saranya Kirana & General',
            phone: localStorage.getItem('sskg_shop_phone') || '9999999999',
            address: localStorage.getItem('sskg_shop_address') || 'Your Address Here'
        };
    },

    _addHeader(doc, shop) {
        doc.setFontSize(22);
        doc.setTextColor(255, 107, 0);
        doc.text(shop.name, 14, 20);

        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text(`${shop.address} | Phone: ${shop.phone}`, 14, 28);

        doc.setLineWidth(0.5);
        doc.line(14, 32, 196, 32);
    },

    _sharePdf(doc, fileName) {
        try {
            const pdfBlob = doc.output('blob');
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                navigator.share({
                    files: [file],
                    title: fileName.replace('.pdf', ''),
                    text: 'Please find the attached document.'
                }).catch(() => {
                    // User cancelled share, download instead
                    doc.save(fileName);
                });
            } else {
                doc.save(fileName);
            }
        } catch (e) {
            console.log("Share failed, downloading instead", e);
            doc.save(fileName);
        }
    },

    async generateDailyReport() {
        try {
            if (!this._checkLib()) return;

            const doc = new window.jspdf.jsPDF();
            const shop = this._getShopDetails();
            const dateStr = new Date().toLocaleDateString('en-GB');

            this._addHeader(doc, shop);

            doc.setFontSize(16);
            doc.setTextColor(0, 0, 0);
            doc.text(`Daily Report: ${dateStr}`, 14, 42);

            const kathas = await dbOps.getTodayKathaEntries();
            const payments = await dbOps.getTodayPayments();

            const customers = await dbOps.getCustomers();
            const custMap = {};
            customers.forEach(c => custMap[c.id] = c);

            let y = 55;

            const drawHeader = (title) => {
                if (y > 260) { doc.addPage(); y = 20; }
                doc.setFontSize(12);
                doc.setFont("helvetica", "bold");
                doc.text(title, 14, y);
                y += 6;
                doc.setLineWidth(0.5);
                doc.line(14, y, 196, y);
                y += 6;
                doc.setFont("helvetica", "normal");
            };

            // Section 1: New Kathas
            drawHeader("New Kathas Added Today");

            if (kathas.length > 0) {
                kathas.forEach(k => {
                    if (y > 270) { doc.addPage(); y = 20; }
                    const cust = custMap[k.customerId];
                    const itemsStr = k.items.map(i => `${i.name}(${i.qty})`).join(', ');
                    doc.setFontSize(11);
                    doc.text(`${cust ? cust.name : 'Unknown'}: ${itemsStr}`, 14, y);
                    doc.text(`Rs. ${k.totalAmount}`, 170, y);
                    y += 6;
                });
            } else {
                doc.setFontSize(11);
                doc.text("No new kathas today.", 14, y);
                y += 6;
            }
            y += 10;

            // Section 2: Payments
            drawHeader("Payments Received Today");

            if (payments.length > 0) {
                payments.forEach(p => {
                    if (y > 270) { doc.addPage(); y = 20; }
                    const cust = custMap[p.customerId];
                    doc.setFontSize(11);
                    doc.text(`${cust ? cust.name : 'Unknown'} - Paid: Rs. ${p.amount}`, 14, y);
                    doc.text(`Bal: Rs. ${p.balanceAfter}`, 160, y);
                    y += 6;
                });
            } else {
                doc.setFontSize(11);
                doc.text("No payments received today.", 14, y);
                y += 6;
            }
            y += 15;

            // Section 3: Summary
            if (y > 240) { doc.addPage(); y = 20; }
            const kathaTotal = kathas.reduce((sum, k) => sum + k.totalAmount, 0);
            const paymentTotal = payments.reduce((sum, p) => sum + p.amount, 0);

            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text("Summary:", 14, y);
            y += 10;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);
            doc.text(`Total Katha Amount: Rs. ${kathaTotal}`, 14, y);
            y += 8;
            doc.text(`Total Payments Received: Rs. ${paymentTotal}`, 14, y);
            y += 8;
            doc.text(`Net Credit Given Today: Rs. ${kathaTotal - paymentTotal}`, 14, y);

            const fileName = `DailyReport_${dateStr.replace(/\//g, '-')}.pdf`;
            this._sharePdf(doc, fileName);

        } catch (error) {
            console.error("Daily Report generation failed:", error);
            alert("Failed to generate Daily Report: " + error.message);
        }
    },

    async generateInvoice(customer) {
        try {
            if (!this._checkLib()) return;

            const doc = new window.jspdf.jsPDF();
            const shop = this._getShopDetails();
            const dateStr = new Date().toLocaleDateString('en-GB');

            this._addHeader(doc, shop);

            doc.setFontSize(16);
            doc.setTextColor(0, 0, 0);
            doc.text("INVOICE", 14, 45);

            doc.setFontSize(12);
            doc.text(`Date: ${dateStr}`, 140, 45);

            doc.text("Bill To:", 14, 55);
            doc.setFontSize(14);
            doc.text(customer.name, 14, 62);
            doc.setFontSize(12);
            doc.text(`Phone: ${customer.phone}`, 14, 68);

            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            let entries = await dbOps.getKathaEntriesByCustomer(customer.id);
            entries = entries.filter(e => e.createdAt >= thirtyDaysAgo);

            let y = 85;

            doc.setFont("helvetica", "bold");
            doc.text("Date", 14, y);
            doc.text("Description", 45, y);
            doc.text("Amount", 170, y);
            y += 4;
            doc.line(14, y, 196, y);
            y += 6;

            doc.setFont("helvetica", "normal");

            let runningTotal = 0;
            entries.forEach(e => {
                const date = new Date(e.createdAt).toLocaleDateString('en-GB');
                const itemsStr = e.items.map(i => `${i.name}(${i.qty})`).join(', ');

                // Truncate long descriptions
                const maxDescLen = 50;
                let desc = itemsStr;
                if (desc.length > maxDescLen) desc = desc.substring(0, maxDescLen) + '...';

                doc.setFontSize(11);
                doc.text(date, 14, y);
                doc.text(desc, 45, y);
                doc.text(`Rs. ${e.totalAmount}`, 170, y);
                runningTotal += e.totalAmount;
                y += 6;

                if (y > 270) {
                    doc.addPage();
                    y = 20;
                }
            });

            y += 10;
            if (y > 260) { doc.addPage(); y = 20; }
            doc.line(14, y, 196, y);
            y += 10;

            doc.setFontSize(16);
            doc.setTextColor(239, 68, 68);
            doc.setFont("helvetica", "bold");
            doc.text(`Total Outstanding Balance: Rs. ${customer.balance}`, 14, y);

            doc.setFontSize(10);
            doc.setTextColor(150, 150, 150);
            doc.setFont("helvetica", "normal");
            doc.text("Thank you for your business!", 14, y + 15);

            const fileName = `${customer.name}_${dateStr.replace(/\//g, '-')}.pdf`;
            this._sharePdf(doc, fileName);

        } catch (error) {
            console.error("Invoice generation failed:", error);
            alert("Failed to generate Invoice: " + error.message);
        }
    },

    async generateStatement(customer) {
        try {
            if (!this._checkLib()) return;

            const doc = new window.jspdf.jsPDF();
            const shop = this._getShopDetails();
            const dateStr = new Date().toLocaleDateString('en-GB');

            this._addHeader(doc, shop);

            doc.setFontSize(16);
            doc.setTextColor(0, 0, 0);
            doc.text("ACCOUNT STATEMENT", 14, 45);

            doc.setFontSize(12);
            doc.text(`Date: ${dateStr}`, 140, 45);

            doc.text("Customer:", 14, 55);
            doc.setFontSize(14);
            doc.text(customer.name, 14, 62);
            doc.setFontSize(12);
            doc.text(`Phone: ${customer.phone}`, 14, 68);

            // Get all history for this customer
            const allLogs = await dbOps.getHistoryLogByCustomer(customer.id);

            let y = 82;

            // Table header
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.text("Date", 14, y);
            doc.text("Type", 50, y);
            doc.text("Description", 80, y);
            doc.text("Amount", 175, y);
            y += 4;
            doc.line(14, y, 196, y);
            y += 6;

            doc.setFont("helvetica", "normal");

            if (allLogs.length === 0) {
                doc.text("No transactions found.", 14, y);
                y += 8;
            } else {
                // Reverse to show oldest first (chronological)
                const chronological = [...allLogs].reverse();

                chronological.forEach(log => {
                    if (y > 270) {
                        doc.addPage();
                        y = 20;
                        // Redraw header on new page
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(10);
                        doc.text("Date", 14, y);
                        doc.text("Type", 50, y);
                        doc.text("Description", 80, y);
                        doc.text("Amount", 175, y);
                        y += 4;
                        doc.line(14, y, 196, y);
                        y += 6;
                        doc.setFont("helvetica", "normal");
                    }

                    const date = new Date(log.createdAt).toLocaleDateString('en-GB');
                    let type = 'Other';
                    let amountPrefix = '';
                    if (log.eventType === 'katha_added') { type = 'Credit'; amountPrefix = '+'; }
                    else if (log.eventType === 'payment_received') { type = 'Payment'; amountPrefix = '-'; }
                    else if (log.eventType === 'payment_edited') { type = 'Edit'; amountPrefix = '~'; }

                    // Truncate description
                    let desc = log.description || '';
                    if (desc.length > 40) desc = desc.substring(0, 40) + '...';

                    doc.setFontSize(10);

                    // Color code: red for credit, green for payment
                    if (log.eventType === 'katha_added') {
                        doc.setTextColor(239, 68, 68);
                    } else if (log.eventType === 'payment_received') {
                        doc.setTextColor(16, 185, 129);
                    } else {
                        doc.setTextColor(100, 100, 100);
                    }

                    doc.text(date, 14, y);
                    doc.text(type, 50, y);
                    doc.text(desc, 80, y);
                    doc.text(`${amountPrefix}Rs. ${log.amount}`, 170, y);
                    y += 6;

                    // Reset color
                    doc.setTextColor(0, 0, 0);
                });
            }

            y += 10;
            if (y > 260) { doc.addPage(); y = 20; }
            doc.line(14, y, 196, y);
            y += 10;

            doc.setFontSize(16);
            doc.setTextColor(239, 68, 68);
            doc.setFont("helvetica", "bold");
            doc.text(`Current Balance: Rs. ${customer.balance}`, 14, y);

            y += 15;
            doc.setFontSize(10);
            doc.setTextColor(150, 150, 150);
            doc.setFont("helvetica", "normal");
            doc.text(`Statement generated on ${dateStr} | ${shop.name}`, 14, y);

            const fileName = `Statement_${dateStr.replace(/\//g, '-')}.pdf`;
            this._sharePdf(doc, fileName);

        } catch (error) {
            console.error("Statement generation failed:", error);
            alert("Failed to generate Statement: " + error.message);
        }
    }
};
