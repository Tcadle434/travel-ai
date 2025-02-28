import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { RabbitmqService } from './rabbitmq/rabbitmq.service';
import { QUEUE_CONFIG, generateId } from '@travel-ai/shared';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly rabbitmqService: RabbitmqService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('test-message')
  async sendTestMessage(@Body() body: any) {
    const success = await this.rabbitmqService.publishMessage(
      QUEUE_CONFIG.ROUTING_KEYS.CONVERSATION_UPDATED,
      {
        id: generateId(),
        type: 'TEST_MESSAGE',
        payload: body,
        timestamp: new Date(),
      },
    );

    return { success, message: 'Test message published to RabbitMQ' };
  }
}
