import { Controller, Get, Param, Query, Logger } from '@nestjs/common';
import { ConversationService } from './conversation.service';

@Controller('conversations')
export class ConversationController {
  private readonly logger = new Logger(ConversationController.name);

  constructor(private readonly conversationService: ConversationService) {}

  @Get(':conversationId/messages')
  async getConversationMessages(
    @Param('conversationId') conversationId: string,
  ) {
    try {
      console.log('getConversationMessages', conversationId);
      this.logger.log(
        `Request for messages in conversation: ${conversationId}`,
      );
      const messages =
        await this.conversationService.getConversationMessages(conversationId);

      return {
        success: true,
        conversationId,
        messages,
      };
    } catch (error) {
      this.logger.error(
        `Error getting conversation messages: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: 'Failed to get conversation messages',
      };
    }
  }

  @Get()
  async getUserConversations(@Query('userId') userId: string) {
    try {
      this.logger.log(`Request for conversations of user: ${userId}`);
      if (!userId) {
        return {
          success: false,
          error: 'UserId is required',
        };
      }

      const conversations =
        await this.conversationService.getUserConversations(userId);

      return {
        success: true,
        conversations,
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

  @Get('test')
  async testEndpoint() {
    this.logger.log('Test endpoint called');
    return {
      success: true,
      message: 'Controller is working',
    };
  }
}
