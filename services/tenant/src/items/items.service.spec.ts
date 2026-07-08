import { ItemsService } from './items.service';
import { ItemsRepository } from './items.repository';
import { CreateItemDto } from './dto/create-item.dto';

describe('ItemsService', () => {
  let repository: jest.Mocked<ItemsRepository>;
  let service: ItemsService;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<ItemsRepository>;
    service = new ItemsService(repository);
  });

  it('delegates listing to the repository', async () => {
    const items = [{ id: 1, name: 'widget', createdAt: new Date() }];
    repository.findAll.mockResolvedValue(items);

    await expect(service.list()).resolves.toBe(items);
  });

  it('trims the name before delegating creation to the repository', async () => {
    const dto: CreateItemDto = { name: '  widget  ' };
    repository.create.mockResolvedValue({
      id: 1,
      name: 'widget',
      createdAt: new Date(),
    });

    await service.create(dto);

    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock, `this` binding is irrelevant
    expect(repository.create).toHaveBeenCalledWith('widget');
  });
});
