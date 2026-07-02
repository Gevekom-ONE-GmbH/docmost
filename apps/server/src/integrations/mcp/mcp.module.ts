import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { SearchModule } from '../../core/search/search.module';
import { PageModule } from '../../core/page/page.module';

@Module({
  imports: [SearchModule, PageModule],
  controllers: [McpController],
  providers: [McpService],
})
export class McpModule {}
