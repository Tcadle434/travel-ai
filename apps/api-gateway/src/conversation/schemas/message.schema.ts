import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

@Schema()
export class Message {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  conversationId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  role: string;

  @Prop({ required: true })
  content: string;

  @Prop({ required: true })
  timestamp: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
