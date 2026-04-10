import { IsEmail } from 'class-validator';

export class SendCommunicationsProbeDto {
  @IsEmail()
  email!: string;
}
