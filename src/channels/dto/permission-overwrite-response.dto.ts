import { PermissionOverwriteTargetType } from "../enums/permission-overwrite-target-type.enum";

export class PermissionOverwriteResponseDTO {
    id: string;

    allow: string;

    deny: string;

    targetId: string;

    targetType: PermissionOverwriteTargetType;

    channelId: string;

}