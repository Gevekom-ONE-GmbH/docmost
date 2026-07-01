import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { createHmac } from 'crypto';
import { WebhookRepo } from '@docmost/db/repos/webhook/webhook.repo';
import { Webhook } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { EventName } from '../../common/events/event.contants';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';

const DELIVERY_TIMEOUT_MS = 10_000;

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly webhookRepo: WebhookRepo) {}

  // ---- CRUD ----

  async create(dto: CreateWebhookDto, userId: string, workspaceId: string) {
    return this.webhookRepo.insert({
      name: dto.name ?? null,
      url: dto.url,
      secret: dto.secret ?? null,
      events: dto.events,
      isActive: dto.isActive ?? true,
      workspaceId,
      creatorId: userId,
    });
  }

  async update(dto: UpdateWebhookDto, workspaceId: string) {
    const existing = await this.webhookRepo.findById(dto.webhookId, workspaceId);
    if (!existing) throw new NotFoundException('Webhook not found');

    await this.webhookRepo.update(
      {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.url !== undefined && { url: dto.url }),
        ...(dto.secret !== undefined && { secret: dto.secret }),
        ...(dto.events !== undefined && { events: dto.events }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      dto.webhookId,
      workspaceId,
    );
    return this.webhookRepo.findById(dto.webhookId, workspaceId);
  }

  async delete(webhookId: string, workspaceId: string) {
    const existing = await this.webhookRepo.findById(webhookId, workspaceId);
    if (!existing) throw new NotFoundException('Webhook not found');
    await this.webhookRepo.softDelete(webhookId, workspaceId);
  }

  async list(workspaceId: string, pagination: PaginationOptions) {
    return this.webhookRepo.listByWorkspace(workspaceId, pagination);
  }

  // ---- Event listeners (explicit, since wildcard is not enabled globally) ----

  @OnEvent(EventName.PAGE_CREATED)
  onPageCreated(p: any) {
    void this.dispatch('page.created', p);
  }
  @OnEvent(EventName.PAGE_UPDATED)
  onPageUpdated(p: any) {
    void this.dispatch('page.updated', p);
  }
  @OnEvent(EventName.PAGE_DELETED)
  onPageDeleted(p: any) {
    void this.dispatch('page.deleted', p);
  }
  @OnEvent(EventName.PAGE_SOFT_DELETED)
  onPageSoftDeleted(p: any) {
    void this.dispatch('page.soft_deleted', p);
  }
  @OnEvent(EventName.PAGE_RESTORED)
  onPageRestored(p: any) {
    void this.dispatch('page.restored', p);
  }
  @OnEvent(EventName.SPACE_CREATED)
  onSpaceCreated(p: any) {
    void this.dispatch('space.created', p);
  }
  @OnEvent(EventName.SPACE_UPDATED)
  onSpaceUpdated(p: any) {
    void this.dispatch('space.updated', p);
  }
  @OnEvent(EventName.SPACE_DELETED)
  onSpaceDeleted(p: any) {
    void this.dispatch('space.deleted', p);
  }
  @OnEvent(EventName.WORKSPACE_CREATED)
  onWorkspaceCreated(p: any) {
    void this.dispatch('workspace.created', p);
  }
  @OnEvent(EventName.WORKSPACE_UPDATED)
  onWorkspaceUpdated(p: any) {
    void this.dispatch('workspace.updated', p);
  }
  @OnEvent(EventName.WORKSPACE_DELETED)
  onWorkspaceDeleted(p: any) {
    void this.dispatch('workspace.deleted', p);
  }

  // ---- Dispatch ----

  private async dispatch(eventName: string, payload: any) {
    const workspaceId = payload?.workspaceId;
    if (!workspaceId) return;

    let webhooks: Webhook[];
    try {
      webhooks = await this.webhookRepo.findActiveByWorkspace(workspaceId);
    } catch (err) {
      this.logger.warn(`Webhook lookup failed: ${this.msg(err)}`);
      return;
    }

    const targets = webhooks.filter(
      (w) => w.events.includes(eventName) || w.events.includes('*'),
    );
    if (targets.length === 0) return;

    const body = JSON.stringify({
      event: eventName,
      timestamp: new Date().toISOString(),
      workspaceId,
      data: payload,
    });

    await Promise.allSettled(
      targets.map((webhook) => this.deliver(webhook, eventName, body)),
    );
  }

  private async deliver(webhook: Webhook, eventName: string, body: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Docmost-Webhook',
      'X-Docmost-Event': eventName,
      'X-Docmost-Webhook-Id': webhook.id,
    };
    if (webhook.secret) {
      const signature = createHmac('sha256', webhook.secret)
        .update(body)
        .digest('hex');
      headers['X-Docmost-Signature'] = `sha256=${signature}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
    try {
      await fetch(webhook.url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
      await this.webhookRepo.touchLastTriggered(webhook.id);
    } catch (err) {
      // Delivery failures must never affect the originating request.
      this.logger.debug(
        `Webhook ${webhook.id} delivery failed: ${this.msg(err)}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private msg(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
