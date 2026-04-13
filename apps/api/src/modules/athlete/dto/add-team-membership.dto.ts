import { IsUUID } from 'class-validator';

export class AddTeamMembershipDto {
  @IsUUID()
  teamId!: string;
}
