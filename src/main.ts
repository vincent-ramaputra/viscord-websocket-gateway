import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { GATEWAY_QUEUE } from "./constants/events";
import { Logger } from 'nestjs-pino';
import pino from 'pino';
import { LoggerService } from '@nestjs/common';

const _pino = pino({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' });
const bootstrapLogger: LoggerService = {
  log: (msg: string, ctx?: string) => _pino.info({ context: ctx }, msg),
  error: (msg: string, trace?: string, ctx?: string) => _pino.error({ context: ctx, trace }, msg),
  warn: (msg: string, ctx?: string) => _pino.warn({ context: ctx }, msg),
  debug: (msg: string, ctx?: string) => _pino.debug({ context: ctx }, msg),
  verbose: (msg: string, ctx?: string) => _pino.trace({ context: ctx }, msg),
};


async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: bootstrapLogger
  });

  app.useLogger(app.get(Logger));

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [`amqp://${process.env.RMQ_HOST}:${process.env.RMQ_PORT}`],
      queue: GATEWAY_QUEUE,
      queueOptions: {
        durable: true
      }
    }
  });
  
  await app.listen(process.env.WS_PORT);
  await app.startAllMicroservices();
}
bootstrap();
