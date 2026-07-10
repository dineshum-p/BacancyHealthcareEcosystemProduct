import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { TenantContextModule } from './tenant-context/tenant-context.module';
import { AuthModule } from './auth/auth.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    DatabaseModule,
    TenantContextModule,
    AuthModule,
    NotificationsModule,
  ],
})
export class AppModule {}
