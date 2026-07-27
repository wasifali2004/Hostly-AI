import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @Length(2, 120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
