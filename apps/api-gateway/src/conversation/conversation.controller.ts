import {
  Controller,
  Get,
  Param,
  Query,
  Logger,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  ConversationService,
  IMessage,
  IConversation,
} from './conversation.service';
import { RedisCacheService } from '../redis/redis-cache.service';

/**
 * Response interface for API endpoints
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

@Controller('conversations')
export class ConversationController {
  private readonly logger = new Logger(ConversationController.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly cacheService: RedisCacheService,
  ) {}

  /**
   * Get messages for a specific conversation
   * @param conversationId The ID of the conversation
   * @returns Messages for the conversation
   */
  @Get(':conversationId/messages')
  async getConversationMessages(
    @Param('conversationId') conversationId: string,
  ): Promise<ApiResponse<IMessage[]>> {
    try {
      this.logger.log(
        `Request for messages in conversation: ${conversationId}`,
      );

      // Try to get messages from cache first
      let messages =
        await this.cacheService.getCachedConversationMessages(conversationId);

      // If not in cache, get from database and cache the result
      if (!messages) {
        this.logger.log(
          `Cache miss, fetching from database: ${conversationId}`,
        );
        messages =
          await this.conversationService.getConversationMessages(
            conversationId,
          );

        // Cache the messages for future requests
        await this.cacheService.cacheConversationMessages(
          conversationId,
          messages,
        );
      } else {
        this.logger.log(`Cache hit for conversation: ${conversationId}`);
      }

      return {
        success: true,
        data: messages,
      };
    } catch (error) {
      this.logger.error(
        `Error getting conversation messages: ${error.message}`,
        error.stack,
      );

      if (error instanceof NotFoundException) {
        throw new HttpException(
          {
            success: false,
            error: `Conversation not found: ${conversationId}`,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: false,
        error: 'Failed to get conversation messages',
      };
    }
  }

  /**
   * Get all conversations for a user
   * @param userId The ID of the user
   * @returns Conversations for the user
   */
  @Get()
  async getUserConversations(
    @Query('userId') userId: string,
  ): Promise<ApiResponse<IConversation[]>> {
    try {
      this.logger.log(`Request for conversations of user: ${userId}`);

      if (!userId) {
        return {
          success: false,
          error: 'UserId is required',
        };
      }

      // Try to get conversations from cache first
      let conversations =
        await this.cacheService.getCachedUserConversations(userId);

      // If not in cache, get from database and cache the result
      if (!conversations) {
        this.logger.log(
          `Cache miss, fetching from database for user: ${userId}`,
        );
        conversations =
          await this.conversationService.getUserConversations(userId);

        // Cache the conversations for future requests
        await this.cacheService.cacheUserConversations(userId, conversations);
      } else {
        this.logger.log(`Cache hit for user conversations: ${userId}`);
      }

      return {
        success: true,
        data: conversations,
      };
    } catch (error) {
      this.logger.error(
        `Error getting user conversations: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        error: 'Failed to get user conversations',
      };
    }
  }

  /**
   * Test endpoint to verify controller is working
   */
  @Get('test')
  async testEndpoint() {
    this.logger.log('Test endpoint called');
    return {
      success: true,
      message: 'Controller is working',
    };
  }
}
