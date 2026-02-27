import { IsNotEmpty } from 'class-validator';

export class EchoQueryDto {
  @IsNotEmpty({ message: 'validation.generic.required' })
  value!: string;
}
