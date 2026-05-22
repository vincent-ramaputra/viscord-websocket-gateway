import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WsGateway } from './ws/ws.gateway';
import { ConfigModule } from "@nestjs/config";
import { WsModule } from './ws/ws.module';
import { createMapper } from "@automapper/core";
import { classes } from "@automapper/classes";
import { RelationshipsController } from './relationships/relationships.controller';
import { RelationshipsModule } from './relationships/relationships.module';
import { MessagesController } from './messages/messages.controller';
import { MessagesModule } from './messages/messages.module';
import { UserProfilesController } from './user-profiles/user-profiles.controller';
import { UserProfilesModule } from './user-profiles/user-profiles.module';
import { GuildsController } from './guilds/guilds.controller';
import { GuildsModule } from './guilds/guilds.module';
import { ChannelsController } from './channels/channels.controller';
import { SfuService } from './sfu/sfu.service';
import { SfuModule } from './sfu/sfu.module';
import { HttpModule } from "@nestjs/axios";
import { GrpcClientModule } from './grpc-client/grpc-client.module';
import { RedisModule } from "./redis/redis.module";
import { PresenceModule } from './presence/presence.module';
import { ConnectionsModule } from './connections/connections.module';
import { SubscriptionsService } from './subscriptions/subscriptions.service';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { LoggerModule } from 'nestjs-pino';
import { IncomingMessage, ServerResponse } from 'http';

export const mapper = createMapper({
  strategyInitializer: classes(),
})

@Module({
  imports: [ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: '.env'
  }), LoggerModule.forRoot({
    pinoHttp: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      formatters: {
        level: (label: string) => ({ level: label })
      },
      redact: [
        'req.headers.cookie',
        'req.headers.authorization',
        'res.headers["set-cookie"]',
      ],
      serializers: {
        req(req: IncomingMessage & { id: number }) {
          return {
            id: req.id,
            method: req.method,
            url: req.url,
            'x-forwarded-uri': req.headers['x-forwarded-uri']
          };
        },
        res(res: ServerResponse) {
          return { statusCode: res.statusCode };
        }
      }
    }
  }), WsModule, RelationshipsModule, MessagesModule, UserProfilesModule, GuildsModule, SfuModule, HttpModule, GrpcClientModule, RedisModule, PresenceModule, ConnectionsModule, SubscriptionsModule],
  controllers: [AppController, UserProfilesController, GuildsController, ChannelsController],
  providers: [AppService, SfuService, SubscriptionsService]
})
export class AppModule {
}
