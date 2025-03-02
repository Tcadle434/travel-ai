import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Set a key-value pair in Redis
   * @param key The key to set
   * @param value The value to set
   * @param ttl Optional TTL in seconds
   * @returns Promise resolving to 'OK' if successful
   */
  async set(key: string, value: string, ttl?: number): Promise<'OK' | null> {
    try {
      this.logger.debug(`Setting key: ${key}`);
      if (ttl) {
        return await this.redis.set(key, value, 'EX', ttl);
      }
      return await this.redis.set(key, value);
    } catch (error) {
      this.logger.error(
        `Error setting key ${key}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Set a key-value pair in Redis with custom options
   * @param key The key to set
   * @param value The value to set
   * @param mode The mode (EX, PX, NX, XX)
   * @param value The value for the mode (e.g., TTL in seconds for EX)
   * @returns Promise resolving to 'OK' if successful
   */
  async setWithOptions(
    key: string,
    value: string,
    mode: string,
    modeValue: number | string,
  ): Promise<'OK' | null> {
    try {
      this.logger.debug(`Setting key with options: ${key}, mode: ${mode}`);
      const result = await this.redis.set(
        key,
        value,
        mode as any,
        modeValue as any,
      );
      return result === 'OK' ? 'OK' : null;
    } catch (error) {
      this.logger.error(
        `Error setting key with options ${key}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get a value from Redis by key
   * @param key The key to get
   * @returns Promise resolving to the value or null if not found
   */
  async get(key: string): Promise<string | null> {
    try {
      this.logger.debug(`Getting key: ${key}`);
      return await this.redis.get(key);
    } catch (error) {
      this.logger.error(
        `Error getting key ${key}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Delete a key from Redis
   * @param key The key to delete
   * @returns Promise resolving to the number of keys deleted
   */
  async del(key: string): Promise<number> {
    try {
      this.logger.debug(`Deleting key: ${key}`);
      return await this.redis.del(key);
    } catch (error) {
      this.logger.error(
        `Error deleting key ${key}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Check if a key exists in Redis
   * @param key The key to check
   * @returns Promise resolving to 1 if the key exists, 0 otherwise
   */
  async exists(key: string): Promise<number> {
    try {
      this.logger.debug(`Checking if key exists: ${key}`);
      return await this.redis.exists(key);
    } catch (error) {
      this.logger.error(
        `Error checking if key ${key} exists: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Set a key's time to live in seconds
   * @param key The key to set TTL for
   * @param seconds The TTL in seconds
   * @returns Promise resolving to 1 if successful, 0 if key doesn't exist
   */
  async expire(key: string, seconds: number): Promise<number> {
    try {
      this.logger.debug(`Setting TTL for key: ${key} to ${seconds} seconds`);
      return await this.redis.expire(key, seconds);
    } catch (error) {
      this.logger.error(
        `Error setting TTL for key ${key}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get all keys matching a pattern
   * @param pattern The pattern to match
   * @returns Promise resolving to an array of keys
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      this.logger.debug(`Getting keys matching pattern: ${pattern}`);
      return await this.redis.keys(pattern);
    } catch (error) {
      this.logger.error(
        `Error getting keys matching pattern ${pattern}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
