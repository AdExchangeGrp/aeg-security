// @flow

import { DateConversions } from '@adexchange/aeg-common';
import DB from './db';
import Directory from './directory';
import Account from './account';
import uuid from 'uuid';
import moment from 'moment-timezone';

import type { GroupOptionsType } from './flow-typed/types';

declare type GroupRecordType = {
	id: string,
	directory_id: string,
	name: string,
	status: string,
	created: moment
}

declare type DraftGroupRecordType = {
	id: string,
	directory_id: string,
	name: string,
	status: string,
	created?: moment
}

const ATTRIBUTES = 'g.id, g.directory_id, g.name, g.status, g.created';

const NAME_LEN = 50;
const STATUS_LEN = 15;

class Group {

	_id: string;

	_directoryId: string;

	_name: string;

	_status: string;

	_created: ?moment;

	constructor (directoryId: string, name: string, options: GroupOptionsType = {}) {

		this._id = options.id || uuid.v4();
		this._directoryId = directoryId;
		this._name = name;
		this._status = options.status || 'ENABLED';
		this._created = options.created;

	}

	get id (): string {

		return this._id;

	}

	get directoryId (): string {

		return this._directoryId;

	}

	set directoryId (id: string): void {

		this._directoryId = id;

	}

	get directory (): Promise<?Directory> {

		return Directory.byId(this._directoryId);

	}

	get name (): string {

		return this._name;

	}

	set name (name: string): void {

		this._name = name;

	}

	get status (): string {

		return this._status;

	}

	set status (status: string): void {

		this._status = status;

	}

	get created (): ?moment {

		return this._created;

	}

	async save (): Promise<void> {

		this.validate();

		await DB.pool.withTransaction(async (connection) => {

			const groupByName = await Group.byNameAndDirectory(this.name, this.directoryId, {connection});

			if (groupByName && groupByName.id !== this.id) {

				throw new Error('Group by that name already exists');

			}

			const group = await Group.byId(this.id, {connection});

			if (group) {

				await connection.query('UPDATE security_service.group SET ? WHERE id = ?', [Group._mapToRecord(this), group.id]);

			} else {

				await connection.query('INSERT INTO security_service.group SET ?', [Group._mapToRecord(this)]);

			}

		});

	}

	async del (): Promise<void> {

		await DB.pool.query('DELETE FROM security_service.group WHERE id = ?', [this.id]);

	}

	validate (): void {

		if (this.name.length > NAME_LEN) {

			throw new Error(`name cannot have string length greater than ${NAME_LEN}`);

		}

		if (this.status.length > STATUS_LEN) {

			throw new Error(`status cannot have string length greater than ${STATUS_LEN}`);

		}

	}

	async accounts (): Promise<Array<Account>> {

		return Account.byGroupId(this.id);

	}

	async addAccount (id: string): Promise<void> {

		await DB.pool.query('INSERT INTO security_service.account_group (account_id, group_id) VALUES (?, ?)', [id, this.id]);

	}

	async removeAccount (id: string): Promise<void> {

		await DB.pool.query('DELETE FROM security_service.account_group WHERE account_id = ? AND group_id = ?', [id, this.id]);

	}

	static async byId (id: string, options: { connection?: Object } = {}): Promise<?Group> {

		const query = `SELECT ${ATTRIBUTES} FROM security_service.group g WHERE g.id = ?`;
		const db = options.connection || DB.pool;
		const records = await db.query(query, [id]);

		if (!records.length) {

			return null;

		}

		return this._mapToEntity(records[0]);

	}

	static async byNameAndDirectory (name: string, directoryId: string, options: { connection?: Object } = {}): Promise<?Group> {

		const query = `SELECT ${ATTRIBUTES} FROM security_service.group g WHERE g.name = ? and g.directory_id = ?`;
		const db = options.connection || DB.pool;
		const records = await db.query(query, [name, directoryId]);

		if (!records.length) {

			return null;

		}

		return this._mapToEntity(records[0]);

	}

	static async byAccountIdAndEnabled (id: string, options: { connection?: Object } = {}): Promise<Array<Group>> {

		const db = options.connection || DB.pool;

		const query =
			`SELECT ${ATTRIBUTES} FROM security_service.group g \
			 INNER JOIN security_service.account_group ag ON g.id = ag.group_id 
			 WHERE ag.account_id = ? AND g.status = 'ENABLED'`;

		const accountRecords = await db.query(query, [id]);

		return accountRecords.map(this._mapToEntity);

	}

	static _mapToEntity (record: GroupRecordType): Group {

		return new Group(
			record.directory_id,
			record.name,
			{
				id: record.id,
				status: record.status,
				created: DateConversions.utcStringToMoment(record.created)
			}
		);

	}

	static _mapToRecord (group: Group): DraftGroupRecordType {

		return {
			id: group.id,
			directory_id: group.directoryId,
			name: group.name,
			status: group.status
		};

	}

}

export default Group;
