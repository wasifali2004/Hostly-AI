import { IsEnum, IsOptional } from 'class-validator';

export enum ExportFormat {
  JSON = 'json',
  CSV = 'csv',
}

export class ExportQueryDto {
  @IsOptional()
  @IsEnum(ExportFormat)
  format: ExportFormat = ExportFormat.JSON;
}
