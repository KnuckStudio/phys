import knex from 'knex';
import { Connection } from '../connection';
import { GroupCreationInfo, GroupEditionInfo } from '../models/Group';

const groupsTable = 'groups';

export class GroupsService {
  private db: knex;

  constructor() {
    this.db = new Connection().knex();
  }

  public getAll() {
    return this.db(groupsTable).select('*');
  }

  public getSingle(id: number) {
    return this.db(groupsTable)
      .select('*')
      .where({
        id
      })
      .first();
  }

  public create(data: GroupCreationInfo) {
    return this.db(groupsTable)
      .insert({
        name: data.name
      })
      .returning('id');
  }

  public update(data: GroupEditionInfo) {
    return this.db(groupsTable)
      .update({
        name: data.name
      })
      .where('id', data.id);
  }

  public remove(id: number) {
    return this.db(groupsTable)
      .where('id', id)
      .delete();
  }
}