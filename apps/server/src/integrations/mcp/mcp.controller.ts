import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { McpService } from './mcp.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';

/**
 * Clean-room MCP server endpoint. External AI clients connect here (Streamable
 * HTTP, stateless) authenticating with a Docmost API key (Bearer). Tools are
 * scoped to the authenticated user's permissions. Write tools are only exposed
 * when MCP_ALLOW_WRITE is not 'false'.
 */
@UseGuards(JwtAuthGuard)
@Controller()
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  private context(user: User, workspace: Workspace) {
    return {
      user,
      workspace,
      writeEnabled: process.env.MCP_ALLOW_WRITE !== 'false',
    };
  }

  private isEnabled(workspace: Workspace): boolean {
    return (workspace as any).settings?.ai?.mcp === true;
  }

  @Post('mcp')
  async post(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() body: any,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ) {
    if (!this.isEnabled(workspace)) {
      res.status(403).send({ error: 'MCP is not enabled for this workspace' });
      return;
    }
    await this.mcpService.handlePost(
      req.raw as any,
      res.raw as any,
      body,
      this.context(user, workspace),
    );
  }

  @Get('mcp')
  async get(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ) {
    if (!this.isEnabled(workspace)) {
      res.status(403).send({ error: 'MCP is not enabled for this workspace' });
      return;
    }
    await this.mcpService.handleSessionRequest(
      req.raw as any,
      res.raw as any,
      this.context(user, workspace),
    );
  }

  @Delete('mcp')
  async delete(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ) {
    await this.mcpService.handleSessionRequest(
      req.raw as any,
      res.raw as any,
      this.context(user, workspace),
    );
  }
}
