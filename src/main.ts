import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { GATEWAY_QUEUE } from "./constants/events";
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
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
