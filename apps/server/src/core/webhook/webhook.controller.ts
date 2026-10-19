import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { UserRole } from '../../common/helpers/types/permission';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import {
  CreateWebhookDto,
  UpdateWebhookDto,
  WebhookIdDto,
  WEBHOOK_EVENTS,
} from './dto/webhook.dto';

@UseGuards(JwtAuthGuard)
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  private assertAdmin(user: User) {
    if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException();
    }
  }

  @Get('events')
  listEvents() {
    return { events: WEBHOOK_EVENTS };
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  async list(
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertAdmin(user);
    return this.webhookService.list(workspace.id, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(
    @Body() dto: CreateWebhookDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertAdmin(user);
    return this.webhookService.create(dto, user.id, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(
    @Body() dto: UpdateWebhookDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertAdmin(user);
    return this.webhookService.update(dto, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async delete(
    @Body() dto: WebhookIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertAdmin(user);
    await this.webhookService.delete(dto.webhookId, workspace.id);
    return { success: true };
  }
}
