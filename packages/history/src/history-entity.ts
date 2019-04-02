import {
  Column,
  EntitySubscriberInterface,
  InsertEvent,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { monotonicFactory } from 'ulid';
import { HistoryActionType } from './history-action.enum';
const ulid = monotonicFactory();
export function HistoryActionColumn() {
  return Column({
    type: 'enum',
    enum: Object.values(HistoryActionType),
    default: HistoryActionType.CREATED,
  });
}
export interface HistoryEntityInterface {
  id: number | string;
  originalID: number | string;

  action: HistoryActionType;

  deleted: boolean;

  // Generated by ulid
  historyReportID: string;
}

export abstract class HistoryEntitySubscriber<
  EntityType,
  HistoryEntityType extends HistoryEntityInterface & EntityType
> implements EntitySubscriberInterface<EntityType> {
  public abstract listenTo(): Function;
  public abstract createHistoryEntity(
    entity: EntityType,
  ): HistoryEntityType | Promise<HistoryEntityType>;

  public async afterInsert(event: InsertEvent<EntityType>): Promise<void> {
    if (Object.keys(event.entity).includes('action')) {
      return;
    }
    const history = await this.createHistoryEntity(event.entity);
    delete history.id;
    history.action = HistoryActionType.CREATED;
    history.historyReportID = ulid();
    await event.manager.save(history);
  }

  public async afterUpdate(event: UpdateEvent<EntityType>): Promise<void> {
    if (Object.keys(event.databaseEntity).includes('action')) {
      return;
    }
    const history = await this.createHistoryEntity(event.entity);
    delete history.id;
    history.action = history.deleted
      ? HistoryActionType.DELETED
      : HistoryActionType.UPDATED;
    history.historyReportID = ulid();
    await event.manager.save(history);
  }

  public async beforeRemove(event: RemoveEvent<EntityType>): Promise<void> {
    if (
      !event ||
      !event.entity ||
      Object.keys(event.databaseEntity).includes('action')
    ) {
      return;
    }
    const history = await this.createHistoryEntity(event.entity);
    delete history.id;
    history.deleted = true;
    history.action = HistoryActionType.DELETED;
    history.historyReportID = ulid();
    await event.manager.save(history);
  }
}
