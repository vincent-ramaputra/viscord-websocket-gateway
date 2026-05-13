import { Controller, Logger } from '@nestjs/common';
import { EventPattern } from "@nestjs/microservices";
import { MESSAGE_RECEIVED_EVENT } from "src/constants/events";
import { Payload } from "src/interfaces/payload.dto";
import { WsGateway } from "src/ws/ws.gateway";

@Controller('/ws/messages')
export class MessagesController {
    private readonly logger = new Logger(MessagesController.name);

    constructor(
         private readonly gateway: WsGateway
    ) {}

    @EventPattern(MESSAGE_RECEIVED_EVENT)
    async handleMessageReceived(payload: Payload<any>) {
        this.logger.log({ payload }, 'message received');
        this.gateway.handleMessageReceived(payload);
    }
}
