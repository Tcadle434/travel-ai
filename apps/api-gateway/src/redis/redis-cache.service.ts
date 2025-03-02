import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { IMessage, IConversation } from '../conversation/conversation.service';

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);

  // TTL constants in seconds
  private readonly MESSAGE_CACHE_TTL = 86400; // 1 day
  private readonly CONVERSATION_CACHE_TTL = 2592000; // 30 days
  private readonly SESSION_CACHE_TTL = 86400; // 1 day
  private readonly TYPING_CACHE_TTL = 30; // 30 seconds
  private readonly PARAMETERS_CACHE_TTL = 86400; // 1 day

  constructor(private readonly redisService: RedisService) {}

  /**
   * Get cached conversation messages
   * @param conversationId The conversation ID
   * @returns Promise resolving to messages or null if not in cache
   */
  async getCachedConversationMessages(
    conversationId: string,
  ): Promise<IMessage[] | null> {
    try {
      const cacheKey = this.getMessagesCacheKey(conversationId);
      const cachedData = await this.redisService.get(cacheKey);

      if (cachedData) {
        this.logger.log(
          `Cache hit for conversation messages: ${conversationId}`,
        );
        return JSON.parse(cachedData);
      }

      this.logger.log(
        `Cache miss for conversation messages: ${conversationId}`,
      );
      return null;
    } catch (error) {
      this.logger.error(
        `Error getting cached conversation messages: ${error.message}`,
        error.stack,
      );
      return null; // Return null on error to fall back to database
    }
  }

  /**
   * Cache conversation messages
   * @param conversationId The conversation ID
   * @param messages The messages to cache
   */
  async cacheConversationMessages(
    conversationId: string,
    messages: IMessage[],
  ): Promise<void> {
    try {
      if (messages.length === 0) {
        return;
      }

      const cacheKey = this.getMessagesCacheKey(conversationId);
      await this.redisService.set(
        cacheKey,
        JSON.stringify(messages),
        this.MESSAGE_CACHE_TTL,
      );
      this.logger.log(
        `Cached ${messages.length} messages for conversation: ${conversationId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error caching conversation messages: ${error.message}`,
        error.stack,
      );
      // Don't throw error, just log it - caching failures shouldn't break the app
    }
  }

  /**
   * Get cached user conversations
   * @param userId The user ID
   * @returns Promise resolving to conversations or null if not in cache
   */
  async getCachedUserConversations(
    userId: string,
  ): Promise<IConversation[] | null> {
    try {
      const cacheKey = this.getConversationsCacheKey(userId);
      const cachedData = await this.redisService.get(cacheKey);

      if (cachedData) {
        this.logger.log(`Cache hit for user conversations: ${userId}`);
        return JSON.parse(cachedData);
      }

      this.logger.log(`Cache miss for user conversations: ${userId}`);
      return null;
    } catch (error) {
      this.logger.error(
        `Error getting cached user conversations: ${error.message}`,
        error.stack,
      );
      return null; // Return null on error to fall back to database
    }
  }

  /**
   * Cache user conversations
   * @param userId The user ID
   * @param conversations The conversations to cache
   */
  async cacheUserConversations(
    userId: string,
    conversations: IConversation[],
  ): Promise<void> {
    try {
      if (conversations.length === 0) {
        return;
      }

      const cacheKey = this.getConversationsCacheKey(userId);
      await this.redisService.set(
        cacheKey,
        JSON.stringify(conversations),
        this.CONVERSATION_CACHE_TTL,
      );
      this.logger.log(
        `Cached ${conversations.length} conversations for user: ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error caching user conversations: ${error.message}`,
        error.stack,
      );
      // Don't throw error, just log it - caching failures shouldn't break the app
    }
  }

  /**
   * Update conversation cache with a new message
   * @param conversationId The conversation ID
   * @param message The new message
   */
  async updateConversationCache(
    conversationId: string,
    message: IMessage,
  ): Promise<void> {
    try {
      const cacheKey = this.getMessagesCacheKey(conversationId);
      const cachedData = await this.redisService.get(cacheKey);

      if (cachedData) {
        const messages: IMessage[] = JSON.parse(cachedData);
        messages.push(message);

        await this.redisService.set(
          cacheKey,
          JSON.stringify(messages),
          this.MESSAGE_CACHE_TTL,
        );
        this.logger.log(
          `Updated cache with new message for conversation: ${conversationId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error updating conversation cache: ${error.message}`,
        error.stack,
      );
      // Don't throw error, just log it - caching failures shouldn't break the app
    }
  }

  /**
   * Invalidate conversation cache
   * @param conversationId The conversation ID
   */
  async invalidateConversationCache(conversationId: string): Promise<void> {
    try {
      const cacheKey = this.getMessagesCacheKey(conversationId);
      await this.redisService.del(cacheKey);
      this.logger.log(`Invalidated cache for conversation: ${conversationId}`);
    } catch (error) {
      this.logger.error(
        `Error invalidating conversation cache: ${error.message}`,
        error.stack,
      );
      // Don't throw error, just log it - caching failures shouldn't break the app
    }
  }

  /**
   * Invalidate user conversations cache
   * @param userId The user ID
   */
  async invalidateUserConversationsCache(userId: string): Promise<void> {
    try {
      const cacheKey = this.getConversationsCacheKey(userId);
      await this.redisService.del(cacheKey);
      this.logger.log(`Invalidated conversations cache for user: ${userId}`);
    } catch (error) {
      this.logger.error(
        `Error invalidating user conversations cache: ${error.message}`,
        error.stack,
      );
      // Don't throw error, just log it - caching failures shouldn't break the app
    }
  }

  /**
   * Set typing indicator
   * @param conversationId The conversation ID
   * @param userId The user ID
   */
  async setTypingIndicator(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    try {
      const cacheKey = this.getTypingCacheKey(conversationId);
      await this.redisService.set(cacheKey, userId, this.TYPING_CACHE_TTL);
      this.logger.log(
        `Set typing indicator for user ${userId} in conversation: ${conversationId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error setting typing indicator: ${error.message}`,
        error.stack,
      );
      // Don't throw error, just log it - caching failures shouldn't break the app
    }
  }

  /**
   * Get typing indicator
   * @param conversationId The conversation ID
   * @returns Promise resolving to the user ID or null if not typing
   */
  async getTypingIndicator(conversationId: string): Promise<string | null> {
    try {
      const cacheKey = this.getTypingCacheKey(conversationId);
      return await this.redisService.get(cacheKey);
    } catch (error) {
      this.logger.error(
        `Error getting typing indicator: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Store travel parameters
   * @param conversationId The conversation ID
   * @param parameters The travel parameters
   */
  async storeTravelParameters(
    conversationId: string,
    parameters: any,
  ): Promise<void> {
    try {
      const cacheKey = this.getParametersCacheKey(conversationId);
      await this.redisService.set(
        cacheKey,
        JSON.stringify(parameters),
        this.PARAMETERS_CACHE_TTL,
      );
      this.logger.log(
        `Stored travel parameters for conversation: ${conversationId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error storing travel parameters: ${error.message}`,
        error.stack,
      );
      // Don't throw error, just log it - caching failures shouldn't break the app
    }
  }

  /**
   * Get travel parameters
   * @param conversationId The conversation ID
   * @returns Promise resolving to the travel parameters or null if not found
   */
  async getTravelParameters(conversationId: string): Promise<any | null> {
    try {
      const cacheKey = this.getParametersCacheKey(conversationId);
      const cachedData = await this.redisService.get(cacheKey);

      if (cachedData) {
        return JSON.parse(cachedData);
      }

      return null;
    } catch (error) {
      this.logger.error(
        `Error getting travel parameters: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  // Helper methods for cache keys
  private getMessagesCacheKey(conversationId: string): string {
    return `messages:${conversationId}`;
  }

  private getConversationsCacheKey(userId: string): string {
    return `conversations:${userId}`;
  }

  private getTypingCacheKey(conversationId: string): string {
    return `typing:${conversationId}`;
  }

  private getParametersCacheKey(conversationId: string): string {
    return `parameters:${conversationId}`;
  }
}
