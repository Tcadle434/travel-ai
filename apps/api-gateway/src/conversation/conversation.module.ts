import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { Message, MessageSchema } from './schemas/message.schema';
import {
  Conversation,
  ConversationSchema,
} from './schemas/conversation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: Conversation.name, schema: ConversationSchema },
    ]),
  ],
  controllers: [ConversationController],
  providers: [ConversationService],
})
export class ConversationModule {}
