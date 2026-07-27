import { IsString, Length, MaxLength } from 'class-validator';

export class AiChatDto {
  @IsString()
  @Length(1, 2_000)
  message: string;
}

export class GenerateDescriptionDto {
  @IsString()
  @Length(3, 160)
  title: string;

  @IsString()
  @Length(3, 4_000)
  bullets: string;
}

export class ConfirmAiActionDto {
  @IsString()
  @MaxLength(20_000)
  confirmationToken: string;
}
