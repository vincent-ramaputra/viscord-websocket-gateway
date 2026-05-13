import { Body, Controller, Get, Inject, Logger, ValidationPipe } from '@nestjs/common';
import { EventPattern, MessagePattern } from "@nestjs/microservices";
import { FRIEND_ADDED_EVENT, FRIEND_REMOVED_EVENT, FRIEND_REQUEST_RECEIVED_EVENT, USER_PRESENCE_UPDATE_EVENT, USER_ONLINE_EVENT } from "src/constants/events";
import { RelationshipResponseDTO } from "./dto/relationship-response.dto";
import { Payload } from "src/interfaces/payload.dto";
import { WsGateway } from "src/ws/ws.gateway";

@Controller('/ws/relationships')
export class RelationshipsController {
    private readonly logger = new Logger(RelationshipsController.name);

    constructor(
        private readonly gateway: WsGateway
    ) {
    }

    @MessagePattern(FRIEND_REQUEST_RECEIVED_EVENT)
    async handleFriendRequestReceived(@Body(new ValidationPipe({ transform: true })) dto: Payload<RelationshipResponseDTO>) {
        this.logger.log({ dto }, 'received friend request');
        this.gateway.handleFriendReceived(dto);
    }

    @MessagePattern(FRIEND_ADDED_EVENT)
    async handleFriendAdded(@Body(new ValidationPipe({ transform: true })) dto: Payload<RelationshipResponseDTO>) {
        this.logger.log({ dto }, 'friend added');
        this.gateway.handleFriendAdded(dto);
    }

    @MessagePattern(FRIEND_REMOVED_EVENT)
    async handleFriendRemoved(@Body(new ValidationPipe({ transform: true })) dto: Payload<RelationshipResponseDTO>) {
        this.logger.log({ dto }, 'friend removed');
        this.gateway.handleFriendRemoved(dto);
    }

}
