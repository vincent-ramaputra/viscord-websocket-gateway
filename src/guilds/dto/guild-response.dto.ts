import { ChannelResponseDTO } from "src/channels/dto/channel-response.dto";
import { UserProfileResponseDTO } from "src/user-profiles/dto/user-profile-response.dto";
import { GuildMemberResponseDTO } from "./guild-member-response.dto";
import { RoleResponseDTO } from "./role-response.dto";

export class GuildResponseDTO {
    id: string;

    name: string;

    ownerId: string;

    iconURL?: string;

    channels: ChannelResponseDTO[]

    createdAt: Date

    updatedAt: Date

    members: GuildMemberResponseDTO[];

    roles: RoleResponseDTO[];
}