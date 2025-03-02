import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import {
  Conversation,
  ConversationDocument,
} from './schemas/conversation.schema';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Conversation.name)
    private conversationModel: Model<ConversationDocument>,
  ) {}

  async getConversationMessages(conversationId: string): Promise<any[]> {
    this.logger.log(`Getting messages for conversation: ${conversationId}`);
    const messages = await this.messageModel
      .find({ conversationId })
      .sort({ timestamp: 1 })
      .lean()
      .exec();

    this.logger.log(
      `Found ${messages.length} messages for conversation ${conversationId}`,
    );
    return messages;
  }

  async getUserConversations(userId: string): Promise<any[]> {
    this.logger.log(`Getting conversations for user: ${userId}`);
    return this.conversationModel
      .find({ userId })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();
  }
}
