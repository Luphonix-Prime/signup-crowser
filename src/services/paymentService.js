
const Database = require('../database/db');

class PaymentService {
    constructor() {
        // In a real application, this would integrate with payment processors like Stripe
        this.plans = {
            free: {
                name: 'Free Plan',
                price: 0,
                maxTabGroups: 3,
                features: ['Basic Privacy Features', 'Community Support']
            },
            premium: {
                name: 'Premium Plan',
                price: 9.99,
                maxTabGroups: -1, // Unlimited
                features: ['Unlimited Tab Groups', 'Advanced Privacy Features', 'Priority Support', 'Custom Themes']
            }
        };
    }

    async processPayment(userId, paymentData) {
        const { cardNumber, expiryDate, cvv, cardholderName, plan } = paymentData;
        
        try {
            // Simulate payment processing
            // In a real application, this would integrate with Stripe, PayPal, etc.
            const isPaymentSuccessful = this.simulatePaymentProcessing(cardNumber, expiryDate, cvv);
            
            if (!isPaymentSuccessful) {
                throw new Error('Payment declined. Please check your card details.');
            }

            const planDetails = this.plans[plan];
            if (!planDetails) {
                throw new Error('Invalid subscription plan');
            }

            // Create payment record
            const paymentId = await this.createPaymentRecord(userId, planDetails, paymentData);
            
            // Update user subscription
            await this.updateUserSubscription(userId, plan);
            
            return {
                success: true,
                paymentId,
                plan,
                amount: planDetails.price
            };
        } catch (error) {
            throw new Error('Payment processing failed: ' + error.message);
        }
    }

    simulatePaymentProcessing(cardNumber, expiryDate, cvv) {
        // Simple simulation - in reality this would call payment processor APIs
        
        // Check for test card numbers that should fail
        const failureCards = ['4000000000000002', '4000000000000069'];
        if (failureCards.includes(cardNumber.replace(/\s/g, ''))) {
            return false;
        }
        
        // Validate basic card number format (simplified)
        const cleanCardNumber = cardNumber.replace(/\s/g, '');
        if (!/^\d{13,19}$/.test(cleanCardNumber)) {
            return false;
        }
        
        // Validate expiry date format
        if (!/^\d{2}\/\d{2}$/.test(expiryDate)) {
            return false;
        }
        
        // Validate CVV
        if (!/^\d{3,4}$/.test(cvv)) {
            return false;
        }
        
        // 95% success rate for simulation
        return Math.random() > 0.05;
    }

    async createPaymentRecord(userId, planDetails, paymentData) {
        try {
            const expiresAt = new Date();
            expiresAt.setMonth(expiresAt.getMonth() + 1); // 1 month subscription
            
            const result = await Database.run(`
                INSERT INTO payments (
                    user_id, plan, amount, status, created_at, expires_at,
                    card_last_four, cardholder_name
                ) VALUES (?, ?, ?, ?, datetime('now'), ?, ?, ?)
            `, [
                userId,
                planDetails.name,
                planDetails.price,
                'completed',
                expiresAt.toISOString(),
                paymentData.cardNumber.slice(-4),
                paymentData.cardholderName
            ]);
            
            return result.id;
        } catch (error) {
            throw new Error('Failed to create payment record: ' + error.message);
        }
    }

    async updateUserSubscription(userId, plan) {
        try {
            await Database.run(
                'UPDATE users SET subscription = ?, subscription_updated_at = datetime("now") WHERE id = ?',
                [plan, userId]
            );
            
            return true;
        } catch (error) {
            throw new Error('Failed to update user subscription: ' + error.message);
        }
    }

    async getUserSubscription(userId) {
        try {
            const user = await Database.get(
                'SELECT subscription, subscription_updated_at FROM users WHERE id = ?',
                [userId]
            );
            
            if (!user) {
                throw new Error('User not found');
            }
            
            // Check if subscription is still active
            const activePayment = await Database.get(`
                SELECT * FROM payments 
                WHERE user_id = ? AND status = 'completed' AND expires_at > datetime('now')
                ORDER BY expires_at DESC LIMIT 1
            `, [userId]);
            
            const subscription = user.subscription || 'free';
            const planDetails = this.plans[subscription];
            
            return {
                plan: subscription,
                ...planDetails,
                isActive: subscription === 'free' || !!activePayment,
                expiresAt: activePayment ? activePayment.expires_at : null
            };
        } catch (error) {
            throw new Error('Failed to get user subscription: ' + error.message);
        }
    }

    async checkSubscriptionLimits(userId, action) {
        try {
            const subscription = await this.getUserSubscription(userId);
            
            switch (action) {
                case 'create_tab_group':
                    if (subscription.maxTabGroups > 0) {
                        const groupCount = await Database.get(
                            'SELECT COUNT(*) as count FROM tab_groups WHERE user_id = ? AND is_active = 1',
                            [userId]
                        );
                        
                        if (groupCount.count >= subscription.maxTabGroups) {
                            return {
                                allowed: false,
                                message: `You've reached the limit of ${subscription.maxTabGroups} tab groups for your ${subscription.plan} plan. Upgrade to Premium for unlimited groups.`
                            };
                        }
                    }
                    break;
                    
                default:
                    break;
            }
            
            return { allowed: true };
        } catch (error) {
            throw new Error('Failed to check subscription limits: ' + error.message);
        }
    }

    async getPaymentHistory(userId) {
        try {
            const payments = await Database.all(`
                SELECT id, plan, amount, status, created_at, expires_at, card_last_four
                FROM payments 
                WHERE user_id = ?
                ORDER BY created_at DESC
            `, [userId]);
            
            return payments;
        } catch (error) {
            throw new Error('Failed to get payment history: ' + error.message);
        }
    }
}

module.exports = PaymentService;
