import { IsBoolean, IsJSON, IsUUID } from 'class-validator';

export class UpdateCommentDto {
  @IsUUID()
  commentId: string;

  @IsJSON()
  content: any;
}

export class ResolveCommentDto {
  @IsUUID()
  commentId: string;

  @IsBoolean()
  resolved: boolean;
}
