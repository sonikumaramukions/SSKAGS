const scheduler = {
    intervalId: null,

    start() {
        // Check immediately
        this.checkAllConfigs();
        
        // Then every minute
        this.intervalId = setInterval(() => {
            this.checkAllConfigs();
        }, 60000);

        // Also check when app comes back to foreground
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.checkAllConfigs();
            }
        });
    },

    stop() {
        if (this.intervalId) clearInterval(this.intervalId);
    },

    async checkAllConfigs() {
        if (typeof dbOps === 'undefined') return;
        
        const configs = await dbOps.getDailyConfigs();
        if (!configs || configs.length === 0) return;

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        for (const config of configs) {
            if (!config.isActive) continue;
            
            // Already triggered today?
            if (config.lastTriggeredDate === todayStr) continue;

            const [hours, mins] = config.scheduledTime.split(':').map(Number);
            const scheduledMinutes = hours * 60 + mins;

            // Is it time? Or did we miss it while app was closed?
            if (currentMinutes >= scheduledMinutes) {
                await this.triggerAutoEntry(config, todayStr);
            }
        }
    },

    async triggerAutoEntry(config, dateString) {
        let totalAmount = 0;
        config.items.forEach(i => { totalAmount += i.lineTotal; });

        try {
            await dbOps.addKathaEntry(
                config.customerId,
                config.items,
                totalAmount,
                'daily',
                true
            );
            
            // Mark as triggered for today
            await dbOps.updateDailyConfigLastTriggered(config.id, dateString);
            console.log(`Auto daily entry generated for customer ${config.customerId}`);
            
            // Refresh UI if needed
            if (typeof currentCustomer !== 'undefined' && currentCustomer && currentCustomer.id === config.customerId) {
                if (typeof renderCustomerProfile === 'function') renderCustomerProfile();
            }
        } catch (e) {
            console.error("Failed to trigger auto entry:", e);
        }
    }
};

// Start scheduler when script loads
scheduler.start();
