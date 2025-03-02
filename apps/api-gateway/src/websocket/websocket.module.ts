import { Module } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';
import { RabbitmqModule } from '../rabbitmq/rabbitmq.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RabbitmqModule, RedisModule],
  providers: [WebsocketGateway],
  exports: [WebsocketGateway],
})
export class WebsocketModule {}
