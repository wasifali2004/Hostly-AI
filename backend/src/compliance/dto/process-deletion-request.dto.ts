import { DataDeletionStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const PROCESSING_STATUSES = [
  DataDeletionStatus.APPROVED,
  DataDeletionStatus.REJECTED,
  DataDeletionStatus.COMPLETED,
] as const;

export class ProcessDeletionRequestDto {
  @IsIn(PROCESSING_STATUSES)
  status:
    | typeof DataDeletionStatus.APPROVED
    | typeof DataDeletionStatus.REJECTED
    | typeof DataDeletionStatus.COMPLETED;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  adminNote?: string;
}
