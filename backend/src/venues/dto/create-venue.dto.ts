import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateVenueDto {
  @IsString()
  @Length(2, 180)
  name: string;

  @IsString()
  @Length(5, 500)
  address: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  capacity: number;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string;

  @IsOptional()
  @ValidateIf((_object, value) => value !== undefined && value !== '')
  @IsUrl({ require_tld: false })
  @MaxLength(1_000)
  imageUrl?: string;
}
