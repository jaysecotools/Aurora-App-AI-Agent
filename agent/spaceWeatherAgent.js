// agent/spaceWeatherAgent.js - Aurora Monitoring Agent Core
// This is the autonomous decision layer - PURE LOGIC, no UI dependencies

export class SpaceWeatherAgent {
    constructor() {
        this.state = {
            lastAlertLevel: 'quiet',
            lastScore: 0,
            alertHistory: [],
            lastNotificationTime: null,
            notificationThrottleMs: 30 * 60 * 1000 // 30 minutes
        };
        this.loadPersistedState();
    }

    // Main agent decision function - THE ONLY TRUTH SOURCE for scoring
    evaluate(currentData, forecastData, context) {
        const kp = currentData?.kp || 3;
        const bz = currentData?.solar?.bz || 0;
        const moonBrightness = context?.moonBrightness || 0.5;
        const cloudPercent = context?.cloudPercent || 50;
        const location = context?.location || 'tasmania';

        // ONLY ONE SCORING SYSTEM - this is the source of truth
        const score = this.calculateScore(kp, bz, moonBrightness, cloudPercent, location);
        
        const alerts = this.generateAlerts(kp, bz, cloudPercent, score);
        const alertLevel = this.determineAlertLevel(kp, bz, score);
        const recommendations = this.generateRecommendations(alertLevel, score, cloudPercent, moonBrightness);
        const summary = this.generateSummary(kp, bz, alertLevel, score, cloudPercent, moonBrightness);
        
        // Determine if we should notify (with throttling)
        const shouldNotify = this.shouldSendNotification(alertLevel, score, kp, bz);

        // Update agent state
        this.updateState(alertLevel, score, alerts);

        return {
            alertLevel,
            alerts,
            recommendations,
            score,          // THE SINGLE SOURCE OF TRUTH for viewing score
            summary,
            shouldNotify,
            timestamp: Date.now(),
            kp: kp,
            bz: bz
        };
    }

    // SINGLE SCORING FUNCTION - delete the UI version
    calculateScore(kp, bz, moonBrightness, cloudPercent, location) {
        let score = 0;
        
        // Kp contribution (0-45 points)
        if (kp >= 7) score += 45;
        else if (kp >= 6) score += 40;
        else if (kp >= 5.67) score += 35;
        else if (kp >= 5) score += 30;
        else if (kp >= 4) score += 20;
        else if (kp >= 3) score += 10;
        else score += 3;

        // Bz contribution (-15 to +20 points)
        if (bz < -10) score += 20;
        else if (bz < -5) score += 12;
        else if (bz < 0) score += 6;
        else if (bz > 5) score -= 10;
        else if (bz > 10) score -= 15;

        // Environmental factors (negative modifiers)
        score -= (moonBrightness * 22);
        score -= (cloudPercent / 100) * 28;

        // Location bonus (Australia-specific)
        if (location === 'tasmania') score += 15;
        else if (location === 'victoria') score += 8;
        else if (location === 'south-aus') score += 5;
        else if (location === 'west-aus') score += 4;
        else if (location === 'nsw') score += 2;

        return Math.min(100, Math.max(0, Math.round(score)));
    }

    generateAlerts(kp, bz, cloudPercent, score) {
        const alerts = [];
        
        if (kp >= 7) {
            alerts.push({
                severity: 'critical',
                title: '🚨 SEVERE GEOMAGNETIC STORM',
                message: `Kp=${kp.toFixed(1)} - Aurora visible far north! Ideal viewing conditions.`,
                timestamp: Date.now()
            });
        } else if (kp >= 5.67) {
            alerts.push({
                severity: 'high',
                title: '🌌 Geomagnetic Storm Active',
                message: `Kp=${kp.toFixed(1)} - Aurora likely visible from Tasmania and southern Australia.`,
                timestamp: Date.now()
            });
        } else if (kp >= 4) {
            alerts.push({
                severity: 'medium',
                title: '✨ Elevated Aurora Activity',
                message: `Kp=${kp.toFixed(1)} - Aurora possible in Tasmania. Keep monitoring.`,
                timestamp: Date.now()
            });
        }

        if (bz < -10) {
            alerts.push({
                severity: 'high',
                title: '🧲 STRONG SOUTHWARD Bz',
                message: `Bz = ${bz.toFixed(1)} nT - Excellent magnetic coupling!`,
                timestamp: Date.now()
            });
        } else if (bz < -5) {
            alerts.push({
                severity: 'medium',
                title: '📉 Favorable Bz Conditions',
                message: `Bz = ${bz.toFixed(1)} nT - Good magnetic field alignment.`,
                timestamp: Date.now()
            });
        }

        if (cloudPercent > 80) {
            alerts.push({
                severity: 'medium',
                title: '☁️ High Cloud Cover',
                message: `${Math.round(cloudPercent)}% cloud coverage - May obstruct viewing.`,
                timestamp: Date.now()
            });
        }
        
        return alerts;
    }

    determineAlertLevel(kp, bz, score) {
        if (kp >= 7) return 'extreme';
        if (kp >= 5.67) return 'storm';
        if (kp >= 4 || bz < -8) return 'active';
        if (score >= 40) return 'elevated';
        return 'quiet';
    }

    generateRecommendations(alertLevel, score, cloudPercent, moonBrightness) {
        const recommendations = [];
        
        if (alertLevel === 'extreme' || alertLevel === 'storm') {
            recommendations.push('Go outside NOW - find dark southern horizon');
            recommendations.push('Use long exposure photography (10-20 seconds)');
            recommendations.push('Look south between 10pm and 2am local time');
        } else if (alertLevel === 'active') {
            recommendations.push('Monitor southern sky after 10pm');
            recommendations.push('Charge your camera and scout dark locations');
        }
        
        if (cloudPercent > 60) {
            recommendations.push(`High cloud cover (${Math.round(cloudPercent)}%) - consider finding clearer location`);
        }
        
        if (moonBrightness > 0.7) {
            recommendations.push('Bright moon will wash out faint aurora - focus on strong storms only');
        } else if (moonBrightness < 0.2) {
            recommendations.push('Dark skies tonight - excellent for photography');
        }
        
        if (score >= 70) {
            recommendations.unshift('🔥 EXCELLENT conditions - high probability of visible aurora!');
        }
        
        return recommendations.slice(0, 4);
    }

    generateSummary(kp, bz, alertLevel, score, cloudPercent, moonBrightness) {
        if (score >= 75) {
            return `🔥 EXCELLENT! Kp=${kp.toFixed(1)}. ${this.getMoonText(moonBrightness)} ${this.getCloudText(cloudPercent)}`;
        } else if (score >= 55) {
            return `✨ GOOD chance. Kp=${kp.toFixed(1)}. ${this.getMoonText(moonBrightness)}`;
        } else if (score >= 35) {
            return `⚠️ MODERATE. Kp=${kp.toFixed(1)}. Best for experienced observers.`;
        } else {
            return `❌ LOW probability. Kp=${kp.toFixed(1)}. Check again in 3-6 hours.`;
        }
    }

    getMoonText(brightness) {
        if (brightness > 0.7) return '🌕 Bright moon reduces visibility.';
        if (brightness > 0.3) return '🌙 Moderate moon interference.';
        return '🌑 Dark skies favorable.';
    }

    getCloudText(percent) {
        if (percent > 70) return '☁️ High cloud may obstruct.';
        if (percent > 40) return '⛅ Some cloud possible.';
        return '☀️ Clear skies predicted.';
    }

    shouldSendNotification(alertLevel, score, kp, bz) {
        // Check throttling
        if (this.state.lastNotificationTime && 
            (Date.now() - this.state.lastNotificationTime) < this.state.notificationThrottleMs) {
            return false;
        }

        // Notification triggers
        const stormTrigger = kp >= 5.67;
        const bzTrigger = bz < -8;
        const scoreTrigger = score >= 70 && alertLevel !== 'quiet';
        const levelTrigger = alertLevel === 'extreme' || alertLevel === 'storm';

        return stormTrigger || bzTrigger || scoreTrigger || levelTrigger;
    }

    updateState(alertLevel, score, alerts) {
        this.state = {
            lastAlertLevel: alertLevel,
            lastScore: score,
            alertHistory: [...this.state.alertHistory, {
                timestamp: Date.now(),
                alertLevel,
                score,
                alertCount: alerts.length
            }].slice(-50),
            lastNotificationTime: this.state.lastNotificationTime,
            notificationThrottleMs: this.state.notificationThrottleMs
        };

        // Persist to localStorage
        this.persistState();
    }

    persistState() {
        try {
            localStorage.setItem('aurora_agent_state', JSON.stringify(this.state));
        } catch (e) {
            console.warn('Failed to persist agent state:', e);
        }
    }

    loadPersistedState() {
        try {
            const saved = localStorage.getItem('aurora_agent_state');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.state = { ...this.state, ...parsed };
            }
        } catch (e) {
            console.warn('Failed to load agent state:', e);
        }
    }

    // Mark that a notification was sent (call this when actually sent)
    markNotificationSent() {
        this.state.lastNotificationTime = Date.now();
        this.persistState();
    }

    getActivitySummary() {
        const recentAlerts = this.state.alertHistory.slice(-5);
        return {
            recentActivityCount: recentAlerts.length,
            lastAlertLevel: this.state.lastAlertLevel,
            lastScore: this.state.lastScore,
            recentAlerts: recentAlerts
        };
    }
}
