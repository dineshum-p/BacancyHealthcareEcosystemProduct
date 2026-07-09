import { Injectable } from '@nestjs/common';
import { ItemsRepository } from './items.repository';
import { Item } from './item.entity';
import { CreateItemDto } from './dto/create-item.dto';

@Injectable()
export class ItemsService {
  constructor(private readonly itemsRepository: ItemsRepository) {}

  list(): Promise<Item[]> {
    return this.itemsRepository.findAll();
  }

  create(dto: CreateItemDto): Promise<Item> {
    return this.itemsRepository.create(dto.name.trim());
  }
}
