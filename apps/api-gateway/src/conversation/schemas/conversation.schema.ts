import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ConversationDocument = HydratedDocument<Conversation>;

@Schema()
export class Conversation {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  lastMessage: string;

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: true })
  updatedAt: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
