import { RoomAvailabilityType } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @Length(2, 180)
  name: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  capacity: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  floor?: string;

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  equipment: string[];

  @IsOptional()
  @IsEnum(RoomAvailabilityType)
  availabilityType?: RoomAvailabilityType;
}
