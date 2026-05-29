// services/dataCache.js - Persistent Data Cache for Agent Memory
export class DataCache {
    constructor(maxAgeMs = 24 * 60 * 60 * 1000) {
        this.maxAge = maxAgeMs;
        this.cacheKey = 'aurora_data_cache';
        this.version = '2.0.0'; // Updated version
        this.checkVersion();
    }
    
    checkVersion() {
        try {
            const storedVersion = localStorage.getItem('aurora_cache_version');
            if (storedVersion !== this.version) {
                console.log('Cache version mismatch, clearing old cache');
                this.clearCache();
                localStorage.setItem('aurora_cache_version', this.version);
            }
        } catch (e) {
            console.warn('Version check failed:', e);
        }
    }

    saveData(dataType, data) {
        try {
            const cache = this.loadCache();
            cache[dataType] = {
                data: data,
                timestamp: Date.now(),
                version: this.version
            };
            localStorage.setItem(this.cacheKey, JSON.stringify(cache));
            return true;
        } catch (e) {
            console.error('Failed to cache data:', e);
            return false;
        }
    }

    loadCache() {
        try {
            const cached = localStorage.getItem(this.cacheKey);
            if (!cached) return {};
            
            const parsed = JSON.parse(cached);
            // Check version compatibility
            for (const key in parsed) {
                if (parsed[key] && parsed[key].version && parsed[key].version !== this.version) {
                    console.log(`Cache entry ${key} version mismatch, invalidating`);
                    delete parsed[key];
                }
            }
            return parsed;
        } catch (e) {
            console.warn('Failed to load cache, clearing:', e);
            this.clearCache();
            return {};
        }
    }

    getData(dataType) {
        const cache = this.loadCache();
        const entry = cache[dataType];
        
        if (!entry) return null;
        
        // Check if data is stale
        if (Date.now() - entry.timestamp > this.maxAge) {
            delete cache[dataType];
            localStorage.setItem(this.cacheKey, JSON.stringify(cache));
            return null;
        }
        
        return entry.data;
    }

    getLastUpdateTime(dataType) {
        const cache = this.loadCache();
        const entry = cache[dataType];
        return entry ? entry.timestamp : null;
    }

    clearCache() {
        localStorage.removeItem(this.cacheKey);
    }

    saveAuroraData(currentData, forecastData) {
        this.saveData('current', currentData);
        this.saveData('forecast', forecastData);
        this.saveData('last_update', new Date().toISOString());
        // Store version for compatibility checking
        const cache = this.loadCache();
        cache._version = this.version;
        localStorage.setItem(this.cacheKey, JSON.stringify(cache));
    }

    getCachedAuroraData() {
        return {
            current: this.getData('current'),
            forecast: this.getData('forecast'),
            lastUpdate: this.getData('last_update')
        };
    }

    hasValidData() {
        const current = this.getData('current');
        const forecast = this.getData('forecast');
        return current !== null && forecast !== null;
    }
}
