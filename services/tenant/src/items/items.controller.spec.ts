import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';

describe('ItemsController', () => {
  let service: jest.Mocked<ItemsService>;
  let controller: ItemsController;

  beforeEach(() => {
    service = {
      list: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<ItemsService>;
    controller = new ItemsController(service);
  });

  it('delegates listing to the service', async () => {
    const items = [{ id: 1, name: 'widget', createdAt: new Date() }];
    service.list.mockResolvedValue(items);

    await expect(controller.list()).resolves.toBe(items);
  });

  it('delegates creation to the service', async () => {
    const created = { id: 1, name: 'widget', createdAt: new Date() };
    service.create.mockResolvedValue(created);

    await expect(controller.create({ name: 'widget' })).resolves.toBe(created);
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock, `this` binding is irrelevant
    expect(service.create).toHaveBeenCalledWith({ name: 'widget' });
  });
});
