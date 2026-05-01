import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from "socket.io";
import { RelationshipResponseDTO } from "src/relationships/dto/relationship-response.dto";
import { Body, Controller, forwardRef, HttpStatus, Inject, Injectable, OnModuleInit, ValidationPipe } from "@nestjs/common";
import { Payload } from "../interfaces/payload.dto";
import { ClientGrpc, ClientProxy, ClientProxyFactory, EventPattern, MessagePattern, Transport } from "@nestjs/microservices";
import { CLIENT_READY_EVENT, FRIEND_ADDED_EVENT, FRIEND_REMOVED_EVENT, FRIEND_REQUEST_RECEIVED_EVENT, GET_DM_CHANNELS_EVENT, GET_GUILDS_EVENT, GET_RELATIONSHIPS_EVENT, MESSAGE_RECEIVED_EVENT, USER_PRESENCE_UPDATE_EVENT, USER_QUEUE, USER_PROFILE_UPDATE_EVENT, USER_TYPING_EVENT, VOICE_RING_EVENT, CHANNEL_QUEUE, VOICE_UPDATE_EVENT, GET_VOICE_STATES_EVENT, GET_VOICE_RINGS_EVENT, VOICE_RING_DISMISS_EVENT, VOICE_MUTE, GUILD_UPDATE_EVENT, SUBSCRIBE_EVENTS, USER_ONLINE_EVENT, USER_OFFLINE_EVENT, GET_USERS_PRESENCE_EVENT } from "src/constants/events";
import { UserStatusUpdateDTO } from "src/user-profiles/dto/user-status-update.dto";
import { UserTypingDTO } from "src/guilds/dto/user-typing.dto";
import { VoiceEventDTO } from "src/channels/dto/voice-event.dto";
import { SfuService } from "src/sfu/sfu.service";
import { ChannelsService } from "src/channels/grpc/channels.service";
import { firstValueFrom } from "rxjs";
import { UsersService } from "src/users/grpc/users.service";
import { RelationshipsService } from "src/relationships/grpc/relationships.service";
import { RedisService } from "src/redis/redis.service";
import { PresenceService } from "src/presence/presence.service";
import { UserProfileResponseDTO } from "src/user-profiles/dto/user-profile-response.dto";
import { Result } from "src/interfaces/result.interface";
import { GuildsService } from "src/guilds/guilds.service";
import { GuildResponseDTO } from "src/guilds/dto/guild-response.dto";
import { ConnectionsService } from "src/connections/connections.service";
import { SubscribeEventDTO } from "src/subscriptions/dto/subscribe-event.dto";
import { SubscriptionsService } from "src/subscriptions/subscriptions.service";
import { UserPresenceUpdateDTO } from "src/presence/dto/user-presence-update.dto";

@Injectable()
@WebSocketGateway({ namespace: "/ws" })
export class WsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  private channelsService: ChannelsService;
  private relationshipsService: RelationshipsService;
  private usersService: UsersService;
  private guildsService: GuildsService;
  private userMQ: ClientProxy;
  private channelMQ: ClientProxy;
  private gatewayNodeId = 'gateway-1';
  // private users: Map<string, string> = new Map();
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly sfuService: SfuService,
    @Inject(forwardRef(() => PresenceService)) private readonly presenceService: PresenceService,
    private readonly connectionsService: ConnectionsService,
    private readonly subscriptionsService: SubscriptionsService,
    @Inject('CHANNELS_SERVICE') private channelsGRPCClient: ClientGrpc,
    @Inject('USERS_SERVICE') private usersGRPCClient: ClientGrpc,
    @Inject('RELATIONSHIPS_SERVICE') private relationshipsGRPCClient: ClientGrpc,
    @Inject('GUILDS_SERVICE') private guildsGRPCClient: ClientGrpc,

  ) {
    console.log("construct1")
    this.userMQ = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [`amqp://${process.env.RMQ_HOST}:${process.env.RMQ_PORT}`],
        queue: USER_QUEUE,
        queueOptions: { durable: true }
      }
    });
    console.log("construct2")
    this.channelMQ = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [`amqp://${process.env.RMQ_HOST}:${process.env.RMQ_PORT}`],
        queue: CHANNEL_QUEUE,
        queueOptions: { durable: true }
      }
    });

    console.log("constructor finished")
  }

  async handleConnection(client: Socket) {
    const userId: string = client.handshake.headers['x-user-id'] as string;
    console.log("userId", userId)
    if (!userId) {
      client.disconnect();
      return;
    }

    console.log("1");
    await this.presenceService.setUserPresence(userId);
    console.log("2");
    await this.connectionsService.addConnection(userId, client.id, this.gatewayNodeId);
    console.log("3");
    this.userMQ.emit(USER_ONLINE_EVENT, userId);
    console.log("4");
  }

  async handleDisconnect(client: Socket) {
    const userId: string = client.handshake.headers['x-user-id'] as string;

    await this.connectionsService.removeConnection(userId, client.id);
    this.userMQ.emit(USER_OFFLINE_EVENT, userId);
  }


  async handleFriendReceived(dto: Payload<RelationshipResponseDTO>) {
    for (const userId of dto.recipients) {
      const socketIds = await this.connectionsService.getUserConnections(userId);

      for (const socketId of socketIds) {
        const nodeId = await this.connectionsService.getConnectionNode(socketId);

        if (nodeId === this.gatewayNodeId) {
          this.server.to(socketId).emit(FRIEND_REQUEST_RECEIVED_EVENT, dto.data);
        }
        else {
          //publish to that node's redis channel
        }
      }
    }
  }

  async handleFriendAdded(dto: Payload<RelationshipResponseDTO>) {
    for (const userId of dto.recipients) {
      const socketIds = await this.connectionsService.getUserConnections(userId);

      for (const socketId of socketIds) {
        const nodeId = await this.connectionsService.getConnectionNode(socketId);

        if (nodeId === this.gatewayNodeId) {
          this.server.to(socketId).emit(FRIEND_ADDED_EVENT, dto.data);
        }
        else {
          //publish to that node's redis channel
        }
      }
    }
  }

  async handleFriendRemoved(dto: Payload<RelationshipResponseDTO>) {
    for (const userId of dto.recipients) {
      const socketIds = await this.connectionsService.getUserConnections(userId);

      for (const socketId of socketIds) {
        const nodeId = await this.connectionsService.getConnectionNode(socketId);

        if (nodeId === this.gatewayNodeId) {
          this.server.to(socketId).emit(FRIEND_REMOVED_EVENT, dto.data);
        }
        else {
          //publish to that node's redis channel
        }
      }
    }
  }

  async handleBroadcastPresenceUpdate(payload: Payload<UserPresenceUpdateDTO>) {
    if (payload.data.isOnline) {
      await this.presenceService.setUserPresence(payload.data.userId);
    }
    else {
      await this.presenceService.deleteUserPresence(payload.data.userId);
    }
    for (const targetId of payload.targetIds) {
      const socketIds = await this.subscriptionsService.getEventSubscribers(USER_PRESENCE_UPDATE_EVENT, targetId);

      for (const socketId of socketIds) {
        const nodeId = await this.connectionsService.getConnectionNode(socketId);

        if (nodeId === this.gatewayNodeId) {
          this.server.to(socketId).emit(USER_PRESENCE_UPDATE_EVENT, payload.data);
        }
        else {
          //publish to that node's redis channel
        }
      }
    }
  }

  async handleMessageReceived(payload: Payload<any>) {
    for (const userId of payload.recipients) {
      const socketIds = await this.connectionsService.getUserConnections(userId);
      console.log('socketIds', socketIds);

      for (const socketId of socketIds) {
        const nodeId = await this.connectionsService.getConnectionNode(socketId);
        console.log('nodeId', nodeId, this.gatewayNodeId);

        if (nodeId === this.gatewayNodeId) {
          this.server.to(socketId).emit(MESSAGE_RECEIVED_EVENT, payload.data);
        }
        else {
          //publish to that node's redis channel
        }
      }
    }
  }

  async handleUserProfileUpdate(payload: Payload<UserProfileResponseDTO>) {
    console.log('user profile update', payload);
    for (const target of payload.targetIds) {
      const subscribers = await this.subscriptionsService.getEventSubscribers(USER_PROFILE_UPDATE_EVENT, target);
      console.log('subscribers', subscribers);
      for (const socketId of subscribers) {
        const nodeId = await this.connectionsService.getConnectionNode(socketId);

        if (nodeId === this.gatewayNodeId) {
          this.server.to(socketId).emit(USER_PROFILE_UPDATE_EVENT, payload.data);
        }
        else {
          //publish to that node's redis channel
        }
      }
    }
  }

  async handleBroadcastUserTyping(payload: Payload<UserTypingDTO>) {
    for (const userId of payload.recipients) {
      const socketIds = await this.connectionsService.getUserConnections(userId);

      for (const socketId of socketIds) {
        const nodeId = await this.connectionsService.getConnectionNode(socketId);

        if (nodeId === this.gatewayNodeId) {
          this.server.to(socketId).emit(USER_TYPING_EVENT, payload.data);
        }
        else {
          //publish to that node's redis channel
        }
      }
    }
  }

  async handleRingChannelRecipients(payload: Payload<VoiceEventDTO>) {
    for (const userId of payload.recipients) {
      const socketIds = await this.connectionsService.getUserConnections(userId);

      for (const socketId of socketIds) {
        const nodeId = await this.connectionsService.getConnectionNode(socketId);

        if (nodeId === this.gatewayNodeId) {
          this.server.to(socketId).emit(VOICE_RING_EVENT, payload.data);
        }
        else {
          //publish to that node's redis channel
        }
      }
    }
  }

  @SubscribeMessage(VOICE_UPDATE_EVENT)
  async handleVoiceUpdate(@MessageBody() payload: any, @ConnectedSocket() client: Socket) {
    const userId = client.handshake.headers['x-user-id'] as string;

    this.channelMQ.emit(VOICE_UPDATE_EVENT, { ...payload, userId: userId });
  }

  async handleVoiceStateUpdate(payload: Payload<VoiceEventDTO>) {
    for (const userId of payload.recipients) {
      const socketIds = await this.connectionsService.getUserConnections(userId);

      for (const socketId of socketIds) {
        const nodeId = await this.connectionsService.getConnectionNode(socketId);

        if (nodeId === this.gatewayNodeId) {
          this.server.to(socketId).emit(VOICE_UPDATE_EVENT, payload.data);
        }
        else {
          //publish to that node's redis channel
        }
      }
    }
  }

  @SubscribeMessage(CLIENT_READY_EVENT)
  async handleClientReady(@ConnectedSocket() client: Socket) {
    console.log("Received client ready")
    const userId = client.handshake.headers['x-user-id'] as string;
    console.log("userId: ", userId)

    try {
      const dmChannelsResponse = await firstValueFrom(this.channelsService.getDmChannels({ userId }));
      const userResponse = await firstValueFrom(this.usersService.getCurrentUser({ userId }));
      const relationshipResponse: Result<RelationshipResponseDTO[]> = await firstValueFrom(this.relationshipsService.getRelationships({ userId }));
      const visibleUsersResponse: Result<string[] | undefined> = await firstValueFrom(this.relationshipsService.getVisibleUsers({ userId }));
      const guildsResponse: Result<GuildResponseDTO[]> = await firstValueFrom(this.guildsService.findAll({ userId }));

      let userIds = visibleUsersResponse.data ?? [];
      let userPresence: string[] = [];

      if (userIds.length > 0) {
        userPresence = await this.presenceService.getUserPresence(userIds);
      }

      this.channelMQ.emit(GET_VOICE_STATES_EVENT, userId);
      this.channelMQ.emit(GET_VOICE_RINGS_EVENT, userId);

      const guilds = guildsResponse.data ?? [];
      for (const guild of guilds) {
        if (!guild.roles) guild.roles = [];
        if (!guild.channels) guild.channels = [];
        else {
          for (const channel of guild.channels) {
            if (!channel.recipients) channel.recipients = [];
            if (!channel.permissionOverwrites) channel.permissionOverwrites = [];
          }
        }
        if (!guild.members) guild.members = [];
        else {
          for (const member of guild.members) {
            if (!member.roles) member.roles = [];
          }
        }
      }

      const relationships = relationshipResponse.data ?? [];

      return { user: userResponse.data, dmChannels: dmChannelsResponse.data, relationships, presences: userPresence, guilds };
    } catch (error) {
      console.log('failed grpc request', error)
    }
  }

  async handleGetVoiceStates(payload: Payload<any>) {
    for (const userId of payload.recipients) {
      const socketIds = await this.connectionsService.getUserConnections(userId);

      for (const socketId of socketIds) {
        const nodeId = await this.connectionsService.getConnectionNode(socketId);

        if (nodeId === this.gatewayNodeId) {
          this.server.to(socketId).emit(GET_VOICE_STATES_EVENT, payload.data);
        }
        else {
          //publish to that node's redis channel
        }
      }
    }
  }

  async handleGetVoiceRings(payload: Payload<any>) {
    for (const userId of payload.recipients) {
      const socketIds = await this.connectionsService.getUserConnections(userId);

      for (const socketId of socketIds) {
        const nodeId = await this.connectionsService.getConnectionNode(socketId);

        if (nodeId === this.gatewayNodeId) {
          this.server.to(socketId).emit(GET_VOICE_RINGS_EVENT, payload.data);
        }
        else {
          //publish to that node's redis channel
        }
      }
    }
  }

  async handleVoiceRing(payload: Payload<any>) {
    for (const userId of payload.recipients) {
      const socketIds = await this.connectionsService.getUserConnections(userId);

      for (const socketId of socketIds) {
        const nodeId = await this.connectionsService.getConnectionNode(socketId);

        if (nodeId === this.gatewayNodeId) {
          this.server.to(socketId).emit(VOICE_RING_EVENT, payload.data);
        }
        else {
          //publish to that node's redis channel
        }
      }
    }
  }

  async handleVoiceRingDismiss(payload: Payload<any>) {
    for (const userId of payload.recipients) {
      const socketIds = await this.connectionsService.getUserConnections(userId);

      for (const socketId of socketIds) {
        const nodeId = await this.connectionsService.getConnectionNode(socketId);

        if (nodeId === this.gatewayNodeId) {
          this.server.to(socketId).emit(VOICE_RING_DISMISS_EVENT, payload.data);
        }
        else {
          //publish to that node's redis channel
        }
      }
    }
  }

  @SubscribeMessage(VOICE_MUTE)
  async handleMute(@ConnectedSocket() client: Socket, @Body() producerId: string) {
    const response = await this.sfuService.muteProducer(producerId);

    if (response.status !== HttpStatus.OK) return;
  }

  async handleGuildUpdate(payload: Payload<any>) {
    for (const userId of payload.recipients) {
      const socketIds = await this.connectionsService.getUserConnections(userId);

      for (const socketId of socketIds) {
        const nodeId = await this.connectionsService.getConnectionNode(socketId);

        if (nodeId === this.gatewayNodeId) {
          this.server.to(socketId).emit(GUILD_UPDATE_EVENT, payload.data);
        }
        else {
          //publish to that node's redis channel
        }
      }
    }

  }

  @SubscribeMessage(SUBSCRIBE_EVENTS)
  async subscribeEvents(@ConnectedSocket() client: Socket, @Body() subscriptions: SubscribeEventDTO[]) {
    if (!subscriptions) return;

    for (const sub of subscriptions) {
      await this.subscriptionsService.subscribeEvent(sub.event, sub.targetId, client.id);
    }
  }

  @SubscribeMessage(GET_USERS_PRESENCE_EVENT)
  async getUsersPresence(@ConnectedSocket() client: Socket, @Body() userIds: string[]) {
      const onlineUserIds = await this.presenceService.getUserPresence(userIds);
      return onlineUserIds;
  }


  afterInit(server: Server) {
    console.log("websocket gateway initialized at port", process.env.WS_PORT);
  }

  onModuleInit() {
    console.log("onmoduleinit")
    this.channelsService = this.channelsGRPCClient.getService<ChannelsService>('ChannelsService');
    console.log("channelservice")
    this.usersService = this.usersGRPCClient.getService<UsersService>('UsersService');
    console.log("userservice")
    this.relationshipsService = this.relationshipsGRPCClient.getService<RelationshipsService>('RelationshipsService');
    console.log("relationshipservice")
    this.guildsService = this.guildsGRPCClient.getService<GuildsService>('GuildsService');
    console.log("guildservice")
  }
}