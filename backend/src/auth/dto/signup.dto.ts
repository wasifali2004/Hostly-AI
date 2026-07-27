import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class SignupDto {
  @IsString()
  @Length(2, 100)
  name: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @Length(8, 72)
  password: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  organizationName?: string;
}
