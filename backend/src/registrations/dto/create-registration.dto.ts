import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateRegistrationDto {
  @IsUUID()
  ticketTierId: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  attendeeName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  attendeeEmail?: string;

  // Compatibility aliases used by simple guest checkout clients.
  @IsOptional()
  @IsString()
  @Length(2, 120)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  attendeePhone?: string;

  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;
}
