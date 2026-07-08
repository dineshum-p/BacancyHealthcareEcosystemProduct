import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { TenantGuard } from '../tenant-context/tenant.guard';
import { CreateItemDto } from './dto/create-item.dto';
import { Item } from './item.entity';
import { ItemsService } from './items.service';

/**
 * Thin controller: validation via `CreateItemDto` + delegation to
 * `ItemsService`. Guarded by `TenantGuard` so every request is bound to a
 * resolved, active tenant before any query runs.
 */
@UseGuards(TenantGuard)
@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  list(): Promise<Item[]> {
    return this.itemsService.list();
  }

  @Post()
  create(@Body() dto: CreateItemDto): Promise<Item> {
    return this.itemsService.create(dto);
  }
}
