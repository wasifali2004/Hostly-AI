import { IsString, Length } from 'class-validator';

export class CheckInDto {
  @IsString()
  @Length(6, 256)
  code: string;
}
