// @flow

import { DateConversions } from '@adexchange/aeg-common';
import aurora from '../test/integration/aurora';
import uuid from 'uuid';
import Organization from './organization';
import Group from './group';
import Account from './account';
import moment from 'moment-timezone';

import type { DirectoryOptionsType, GroupOptionsType, AccountOptionsType } from './flow-typed/types';

declare type DirectoryRecordType = {
	id: string,
	organization_id: string,
	name: string,
	is_default: boolean,
	status: string,
	created: moment
}

declare type DraftDirectoryRecordType = {
	id: string,
	organization_id: string,
	name: string,
	is_default?: boolean,
	status: string,
	created?: moment
}

const ATTRIBUTES = 'd.id, d.organization_id, d.name, d.is_default, d.status, d.created';

const NAME_LEN = 255;
const STATUS_LEN = 15;

class Directory {

	_id: string;

	_organizationId: string;

	_name: string;

	_isDefault: boolean;

	_status: string;

	_created: ?moment;

	constructor (organizationId: string, name: string, options: DirectoryOptionsType = {}) {

		this._id = options.id || uuid.v4();
		this._organizationId = organizationId;
		this._name = name;
		this._isDefault = options.isDefault || false;
		this._status = options.status || 'ENABLED';
		this._created = options.created;

	}

	get id (): string {

		return this._id;

	}

	get organizationId (): string {

		return this._organizationId;

	}

	set organizationId (id: string): void {

		this._organizationId = id;

	}

	get organization (): Promise<?Organization> {

		return Organization.byId(this._organizationId);

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

	get isDefault (): boolean {

		return this._isDefault;

	}

	set isDefault (isDefault: boolean): void {

		this._isDefault = isDefault;

	}

	get created (): ?moment {

		return this._created;

	}

	async save (): Promise<void> {

		this.validate();

		await aurora.withTransaction(async (connection) => {

			const directoryByName = await Directory.byNameAndOrganization(this.name, this.organizationId, {connection});

			if (directoryByName && directoryByName.id !== this.id) {

				throw new Error('Directory by that name already exists');

			}

			const defaultDirectory = await Directory.byIsDefaultAndOrganization(this.organizationId, {connection});

			if (!defaultDirectory) {

				this.isDefault = true;

			} else {

				if (this.isDefault) {

					await connection.query('UPDATE security_service.directory SET is_default = 0 WHERE is_default = 1 AND organization_id = ? AND id <> ?', [this.organizationId, this.id]);

				} else {

					const count = await connection.query('SELECT COUNT(1) as c FROM security_service.directory WHERE organization_id = ? AND is_default = 1 AND id <> ?', [this.organizationId, this.id]);

					if (!count[0].c) {

						await connection.query('UPDATE security_service.directory SET is_default = 1 WHERE organization_id = ? AND id <> ? LIMIT 1', [this.organizationId, this.id]);

					}

				}

			}

			const directory = await Directory.byId(this.id, {connection});

			if (directory) {

				await connection.query('UPDATE security_service.directory SET ? WHERE id = ?', [Directory._mapToRecord(this), directory.id]);

			} else {

				await connection.query('INSERT INTO security_service.directory SET ?', [Directory._mapToRecord(this)]);

			}

		});

	}

	async del (): Promise<void> {

		await aurora.withTransaction(async (connection) => {

			await connection.query('DELETE FROM security_service.directory WHERE id = ?', [this.id]);

			const result = await connection.query('SELECT COUNT(1) as c FROM security_service.directory WHERE organization_id = ? AND is_default = 1', [this.organizationId]);

			if (!result[0].c) {

				await connection.query('UPDATE security_service.directory SET is_default = 1 WHERE organization_id = ? LIMIT 1', [this.organizationId]);

			}

		});

	}

	validate (): void {

		if (this.name.length > NAME_LEN) {

			throw new Error(`name cannot have string length greater than ${NAME_LEN}`);

		}

		if (this.status.length > STATUS_LEN) {

			throw new Error(`status cannot have string length greater than ${STATUS_LEN}`);

		}

	}

	async addGroup (name: string, options: GroupOptionsType = {}) {

		const group = new Group(this.id, name, options);
		await group.save();
		return group;

	}

	async removeGroupById (id: string): Promise<void> {

		const group = await Group.byId(id);

		if (group && group.directoryId === this.id) {

			return group.del();

		} else {

			throw new Error('group not found');

		}

	}

	async removeGroupByName (name: string): Promise<void> {

		const group = await Group.byNameAndDirectory(name, this.id);

		if (group) {

			return group.del();

		} else {

			throw new Error('group not found');

		}

	}

	async addAccount (email: string,
	                  firstName: string,
	                  lastName: string,
	                  password: string,
	                  options: AccountOptionsType = {}): Promise<Account> {

		const account = new Account(this.id, email, firstName, lastName, options);
		await account.changePassword(password);
		await account.save();
		return account;

	}

	async removeAccountById (id: string): Promise<void> {

		const account = await Account.byId(id);

		if (account && account.directoryId === this.id) {

			return account.del();

		} else {

			throw new Error('account not found');

		}

	}

	async addToApplication (id: string): Promise<void> {

		return aurora.query('INSERT INTO security_service.application_directory (application_id, directory_id) VALUES (?, ?)', [id, this.id]);

	}

	async removeFromApplication (id: string): Promise<void> {

		return aurora.query('DELETE FROM security_service.application_directory WHERE application_id = ? AND directory_id = ?', [id, this.id]);

	}

	async belongsToApplication (applicationId: string): Promise<boolean> {

		const result = await aurora.query('SELECT count(1) as c FROM security_service.application_directory WHERE directory_id = ? AND application_id = ?', [this.id, applicationId]);
		return result[0].c > 0;

	}

	static async byId (id: string, options: { connection?: Object } = {}): Promise<?Directory> {

		const query = `SELECT ${ATTRIBUTES} FROM security_service.directory d WHERE id = ?`;
		const db = options.connection || aurora;
		const records = await db.query(query, [id]);

		if (!records.length) {

			return null;

		}

		return this._mapToEntity(records[0]);

	}

	static async byNameAndOrganization (name: string, organizationId: string, options: { connection?: Object } = {}): Promise<?Directory> {

		const query = `SELECT ${ATTRIBUTES} FROM security_service.directory d WHERE name = ? and organization_id = ?`;
		const db = options.connection || aurora;
		const records = await db.query(query, [name, organizationId]);

		if (!records.length) {

			return null;

		}

		return this._mapToEntity(records[0]);

	}

	static async byOrganizationCount (organizationId: string, options: { connection?: Object } = {}): Promise<number> {

		const db = options.connection || aurora;
		const result = await db.query('SELECT COUNT(1) as c FROM security_service.directory WHERE organization_id = ?', [organizationId]);
		return result[0].c;

	}

	static async byIsDefaultAndOrganization (organizationId: string, options: { connection?: Object } = {}): Promise<?Directory> {

		const query = `SELECT ${ATTRIBUTES} FROM security_service.directory d WHERE organization_id = ? AND is_default = 1`;
		const db = options.connection || aurora;
		const records = await db.query(query, [organizationId]);

		if (!records.length) {

			return null;

		}

		return this._mapToEntity(records[0]);

	}

	static async byApplication (applicationId: string, options: { connection?: Object } = {}): Promise<Array<Directory>> {

		const query = `SELECT ${ATTRIBUTES} FROM security_service.directory d 
					   INNER JOIN security_service.application_directory ad ON ad.directory_id = d.id
					   WHERE ad.application_id = ?`;
		const db = options.connection || aurora;
		const records = await db.query(query, [applicationId]);
		return records.map(this._mapToEntity);

	}

	static _mapToEntity (record: DirectoryRecordType): Directory {

		return new Directory(
			record.organization_id,
			record.name,
			{
				id: record.id,
				isDefault: record.is_default,
				status: record.status,
				created: DateConversions.utcStringToMoment(record.created)
			}
		);

	}

	static _mapToRecord (directory: Directory): DraftDirectoryRecordType {

		return {
			id: directory.id,
			organization_id: directory.organizationId,
			name: directory.name,
			status: directory.status,
			is_default: directory.isDefault
		};

	}

}

export default Directory;
