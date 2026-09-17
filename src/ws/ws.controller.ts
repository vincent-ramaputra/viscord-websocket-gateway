import { Body, Controller, Inject, ValidationPipe } from '@nestjs/common';
import { EventPattern } from "@nestjs/microservices";
import { Payload } from "../interfaces/payload.dto";
import { RelationshipResponseDTO } from "src/relationships/dto/relationship-response.dto";
import { WsGateway } from "./ws.gateway";
import { FRIEND_REQUEST_SENT_EVENT } from "src/constants/events";

@Controller('ws-gateway')
export class WsController {


}
