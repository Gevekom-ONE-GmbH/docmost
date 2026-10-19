import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PageVerificationService } from './page-verification.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../../common/decorators/auth-user.decorator';
import { User } from '@docmost/db/types/entity.types';
import {
  ListVerificationsDto,
  PageVerificationPageIdDto,
  RejectApprovalDto,
  SetupVerificationDto,
  UpdateVerificationDto,
} from './dto/page-verification.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class PageVerificationController {
  constructor(private readonly service: PageVerificationService) {}

  @HttpCode(HttpStatus.OK)
  @Post('pages/verification-info')
  info(@Body() dto: PageVerificationPageIdDto, @AuthUser() user: User) {
    return this.service.getInfo(dto.pageId, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('pages/create-verification')
  create(@Body() dto: SetupVerificationDto, @AuthUser() user: User) {
    return this.service.setup(dto, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('pages/update-verification')
  update(@Body() dto: UpdateVerificationDto, @AuthUser() user: User) {
    return this.service.update(dto, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('pages/delete-verification')
  remove(@Body() dto: PageVerificationPageIdDto, @AuthUser() user: User) {
    return this.service.remove(dto.pageId, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('pages/verify')
  verify(@Body() dto: PageVerificationPageIdDto, @AuthUser() user: User) {
    return this.service.verify(dto.pageId, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('pages/submit-for-approval')
  submit(@Body() dto: PageVerificationPageIdDto, @AuthUser() user: User) {
    return this.service.submitForApproval(dto.pageId, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('pages/reject-approval')
  reject(@Body() dto: RejectApprovalDto, @AuthUser() user: User) {
    return this.service.rejectApproval(dto.pageId, user, dto.comment);
  }

  @HttpCode(HttpStatus.OK)
  @Post('pages/mark-obsolete')
  obsolete(@Body() dto: PageVerificationPageIdDto, @AuthUser() user: User) {
    return this.service.markObsolete(dto.pageId, user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('pages/verifications')
  list(@Body() dto: ListVerificationsDto, @AuthUser() user: User) {
    return this.service.list(dto, user);
  }
}
