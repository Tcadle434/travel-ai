import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule as NestRedisModule } from '@nestjs-modules/ioredis';
import { RedisService } from './redis.service';
import { RedisCacheService } from './redis-cache.service';

@Module({
  imports: [
    NestRedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'single',
        url: `redis://${configService.get('REDIS_HOST', 'localhost')}:${configService.get(
          'REDIS_PORT',
          6379,
        )}`,
        password: configService.get('REDIS_PASSWORD', ''),
      }),
    }),
  ],
  providers: [RedisService, RedisCacheService],
  exports: [RedisService, RedisCacheService],
})
export class RedisModule {}
