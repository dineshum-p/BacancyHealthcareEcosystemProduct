import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { TenantContextModule } from './tenant-context/tenant-context.module';
import { AuthModule } from './auth/auth.module';
import { NotificationsModule } from './notifications/notifications.module';
import { EventsModule } from './notifications/events/events.module';

@Module({
  imports: [
    DatabaseModule,
    TenantContextModule,
    AuthModule,
    NotificationsModule,
    EventsModule,
  ],
})
export class AppModule {}
