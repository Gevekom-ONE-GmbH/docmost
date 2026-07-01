import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueName } from '../../../integrations/queue/constants';
import { PageVerificationController } from './page-verification.controller';
import { PageVerificationService } from './page-verification.service';

@Module({
  imports: [BullModule.registerQueue({ name: QueueName.NOTIFICATION_QUEUE })],
  controllers: [PageVerificationController],
  providers: [PageVerificationService],
})
export class PageVerificationModule {}
