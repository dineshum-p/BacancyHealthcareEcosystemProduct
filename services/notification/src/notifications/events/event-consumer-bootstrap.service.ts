import {
  Injectable,
  Optional,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import type { UserRegisteredEvent } from '@hep/shared-types';
import {
  EventConsumerConfig,
  getEventConsumerConfig,
} from '../../config/event-consumer.config';
import { UserRegisteredEventHandler } from './user-registered-event.handler';
import { KafkaEventConsumerAdapter } from './kafka-event-consumer.adapter';
import type { EventConsumer } from './event-consumer.interface';

type ConsumerFactory = (
  config: EventConsumerConfig,
  dispatch: (event: UserRegisteredEvent) => Promise<void>,
) => EventConsumer;

const defaultConsumerFactory: ConsumerFactory = (config, dispatch) =>
  new KafkaEventConsumerAdapter(config, dispatch);

/**
 * Application-lifecycle wiring for AC4's domain-event consumption:
 * conditionally starts `KafkaEventConsumerAdapter` on app bootstrap (ONLY
 * when `KAFKA_CONSUMER_ENABLED=true` -- disabled is the default everywhere,
 * since no real broker exists in this repo/sandbox; see
 * `events/README.md`), and stops it on shutdown. Kept as a thin NestJS
 * lifecycle hook, separate from `KafkaEventConsumerAdapter` itself, so the
 * "should we even connect" decision and the connection mechanics are
 * independently testable.
 */
@Injectable()
export class EventConsumerBootstrapService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private consumer: EventConsumer | null = null;

  constructor(
    private readonly userRegisteredEventHandler: UserRegisteredEventHandler,
    @Optional()
    private readonly configFactory: () => EventConsumerConfig = getEventConsumerConfig,
    @Optional()
    private readonly consumerFactory: ConsumerFactory = defaultConsumerFactory,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const config = this.configFactory();
    if (!config.enabled) {
      return;
    }

    this.consumer = this.consumerFactory(config, (event) =>
      this.userRegisteredEventHandler.handle(event).then(() => undefined),
    );
    await this.consumer.start();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.consumer?.stop();
  }
}
