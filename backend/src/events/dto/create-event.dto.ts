import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { LocationType } from '@prisma/client';
import { TicketTierDto } from './ticket-tier.dto';

export class CreateEventDto {
  @IsString()
  @Length(3, 160)
  title: string;

  @IsString()
  @Length(10, 20_000)
  description: string;

  @Type(() => Date)
  @IsDate()
  startsAt: Date;

  @Type(() => Date)
  @IsDate()
  endsAt: Date;

  @IsString()
  @MaxLength(80)
  timezone: string;

  @IsOptional()
  @IsEnum(LocationType)
  venueType?: LocationType;

  @IsOptional()
  @IsEnum(LocationType)
  locationType?: LocationType;

  @IsOptional()
  @IsUUID()
  venueId?: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  venueName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressLine1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @IsOptional()
  @ValidateIf((_object, value) => value !== undefined && value !== '')
  @IsUrl({ require_tld: false })
  @MaxLength(1000)
  virtualUrl?: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  capacity: number;

  @IsOptional()
  @ValidateIf((_object, value) => value !== undefined && value !== '')
  @IsUrl({ require_tld: false })
  @MaxLength(1000)
  coverImageUrl?: string;

  @IsString()
  @Length(2, 80)
  category: string;

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags: string[];

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => TicketTierDto)
  ticketTiers: TicketTierDto[];
}
