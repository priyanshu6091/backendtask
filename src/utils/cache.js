const Redis = require('redis');

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionAttempted = false;
    this.fallbackCache = new Map();
  }

  async connect() {
    // Only attempt connection once
    if (this.connectionAttempted) {
      return;
    }
    
    this.connectionAttempted = true;
    
    try {
      this.client = Redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          // Limited number of retries (3 max) with a short timeout
          reconnectStrategy: (retries) => {
            if (retries >= 3) {
              // Stop retrying after 3 attempts
              console.log('Max Redis connection retries reached, using in-memory cache');
              return false;
            }
            return Math.min(retries * 100, 1000);
          },
          connectTimeout: 2000 // 2 second timeout
        }
      });

      // Handle error once, then switch to fallback
      this.client.on('error', (err) => {
        if (this.isConnected) {
          console.log('Redis connection lost, using fallback cache');
        } else {
          console.log('Redis connection failed, using fallback cache');
        }
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('Redis Connected');
        this.isConnected = true;
      });

      // Set a timeout for the connection attempt
      const connectionPromise = this.client.connect();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 3000)
      );
      
      await Promise.race([connectionPromise, timeoutPromise]);
    } catch (error) {
      console.log('Redis unavailable, using fallback in-memory cache');
      this.isConnected = false;
    }
  }

  async set(key, value, expireSeconds = 3600) {
    try {
      if (this.isConnected) {
        await this.client.set(key, JSON.stringify(value), { EX: expireSeconds });
      } else {
        this.fallbackCache.set(key, {
          value,
          expiry: Date.now() + (expireSeconds * 1000)
        });
      }
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async get(key) {
    try {
      if (this.isConnected) {
        const value = await this.client.get(key);
        return value ? JSON.parse(value) : null;
      } else {
        const item = this.fallbackCache.get(key);
        if (!item) return null;
        if (Date.now() > item.expiry) {
          this.fallbackCache.delete(key);
          return null;
        }
        return item.value;
      }
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }
}

module.exports = new CacheService();
