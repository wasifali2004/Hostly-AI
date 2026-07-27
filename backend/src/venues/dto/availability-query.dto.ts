import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsUUID } from 'class-validator';

export class AvailabilityQueryDto {
  @Type(() => Date)
  @IsDate()
  from: Date;

  @Type(() => Date)
  @IsDate()
  to: Date;

  @IsOptional()
  @IsUUID()
  venueId?: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;
}
