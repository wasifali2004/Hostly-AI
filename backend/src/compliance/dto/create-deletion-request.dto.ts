import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDeletionRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  reason?: string;
}
