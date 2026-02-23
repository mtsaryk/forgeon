import { IsNotEmpty } from 'class-validator';

export class EchoQueryDto {
  @IsNotEmpty({ message: 'validation.required' })
  value!: string;
}
