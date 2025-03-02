import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import {
  Conversation,
  ConversationDocument,
} from './schemas/conversation.schema';

/**
 * Interface for conversation messages
 */
export interface IMessage {
  id: string;
  conversationId: string;
  userId: string;
  role: string;
  content: string;
  timestamp: Date;
}

/**
 * Interface for conversation data
 */
export interface IConversation {
  id: string;
  userId: string;
  title: string;
  lastMessage: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Conversation.name)
    private conversationModel: Model<ConversationDocument>,
  ) {}

  /**
   * Get messages for a specific conversation
   * @param conversationId The ID of the conversation
   * @returns Array of messages
   * @throws NotFoundException if conversation doesn't exist
   */
  async getConversationMessages(conversationId: string): Promise<IMessage[]> {
    this.logger.log(`Getting messages for conversation: ${conversationId}`);

    // First check if the conversation exists
    const conversation = await this.conversationModel
      .findOne({ id: conversationId })
      .lean()
      .exec();
    if (!conversation) {
      this.logger.warn(`Conversation not found: ${conversationId}`);
      throw new NotFoundException(
        `Conversation with ID ${conversationId} not found`,
      );
    }

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

  /**
   * Get all conversations for a user
   * @param userId The ID of the user
   * @returns Array of conversations
   */
  async getUserConversations(userId: string): Promise<IConversation[]> {
    this.logger.log(`Getting conversations for user: ${userId}`);

    const conversations = await this.conversationModel
      .find({ userId })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();

    this.logger.log(
      `Found ${conversations.length} conversations for user ${userId}`,
    );
    return conversations;
  }

  /**
   * Get a specific conversation by ID
   * @param conversationId The ID of the conversation
   * @returns The conversation data
   * @throws NotFoundException if conversation doesn't exist
   */
  async getConversation(conversationId: string): Promise<IConversation> {
    this.logger.log(`Getting conversation: ${conversationId}`);

    const conversation = await this.conversationModel
      .findOne({ id: conversationId })
      .lean()
      .exec();

    if (!conversation) {
      this.logger.warn(`Conversation not found: ${conversationId}`);
      throw new NotFoundException(
        `Conversation with ID ${conversationId} not found`,
      );
    }

    return conversation;
  }
}
