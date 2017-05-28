// @flow

import { DateConversions } from '@adexchange/aeg-common';
import DB from './db';
import moment from 'moment-timezone';
import slug from 'slug';
import uuid from 'uuid';
import Directory from './directory';

import type { OrganizationOptionsType, DirectoryOptionsType } from './flow-typed/types';

declare type OrganizationRecordType = {
	id: string,
	name: string,
	name_key: string,
	type: string,
	status: string,
	created: moment
}

declare type DraftOrganizationRecordType = {
	id: string,
	name: string,
	name_key: string,
	type: string,
	status: string,
	created?: moment
}

const ATTRIBUTES = 'id, name, name_key, type, status, created';

const NAME_LEN = 255;
const NAME_KEY_LEN = 255;
const STATUS_LEN = 15;
const TYPE_LEN = 25;

class Organization {

	_id: string;

	_name: string;

	_type: string;

	_status: string;

	_created: ?moment;

	constructor (name: string, type: string, options: OrganizationOptionsType = {}) {

		this._id = options.id || uuid.v4();
		this._name = name;
		this._type = type;
		this._status = options.status || 'ENABLED';
		this._created = options.created;

	}

	get id (): string {

		return this._id;

	}

	get name (): string {

		return this._name;

	}

	set name (name: string): void {

		this._name = name;

	}

	get nameKey (): string {

		return slug(this._name, {lower: true});

	}

	get type (): string {

		return this._type;

	}

	set type (type: string): void {

		this._type = type;

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

			const organizationByName = await Organization.byNameKey(this.nameKey, {connection});

			if (organizationByName && organizationByName.id !== this.id) {

				throw new Error('Organization by that name already exists');

			}

			const organization = await Organization.byId(this.id, {connection});

			if (organization) {

				await connection.query('UPDATE security_service.organization SET ? WHERE id = ?', [Organization._mapToRecord(this), organization.id]);

			} else {

				await connection.query('INSERT INTO security_service.organization SET ?', [Organization._mapToRecord(this)]);

			}

		});

	}

	async del (): Promise<void> {

		await DB.pool.query('DELETE FROM security_service.organization WHERE id = ?', [this.id]);

	}

	async addDirectory (name: string, options: DirectoryOptionsType): Promise<Directory> {

		const directory = new Directory(this.id, name, options);
		await directory.save();
		return directory;

	}

	async removeDirectoryById (id: string): Promise<void> {

		const directory = await Directory.byId(id);

		if (directory && directory.organizationId === this.id) {

			return directory.del();

		} else {

			throw new Error('directory not found');

		}

	}

	async removeDirectoryByName (name: string): Promise<void> {

		const directory = await Directory.byNameAndOrganization(name, this.id);

		if (directory) {

			return directory.del();

		} else {

			throw new Error('directory not found');

		}

	}

	async defaultDirectory (): Promise<?Directory> {

		return Directory.byIsDefaultAndOrganization(this.id);

	}

	validate (): void {

		if (this.name.length > NAME_LEN) {

			throw new Error(`name cannot have string length greater than ${NAME_LEN}`);

		}

		if (this.nameKey.length > NAME_KEY_LEN) {

			throw new Error(`nameKey cannot have string length greater than ${NAME_KEY_LEN}`);

		}

		if (this.status.length > STATUS_LEN) {

			throw new Error(`status cannot have string length greater than ${STATUS_LEN}`);

		}

		if (this.type.length > TYPE_LEN) {

			throw new Error(`type cannot have string length greater than ${TYPE_LEN}`);

		}

	}

	static async all (options: { connection?: Object } = {}): Promise<Array<Organization>> {

		const query = `SELECT ${ATTRIBUTES} FROM security_service.organization ORDER BY name`;
		const db = options.connection || DB.pool;
		const records = await db.query(query);
		return records.map(this._mapToEntity);

	}

	static async byType (type: string, options: { connection?: Object } = {}): Promise<Array<Organization>> {

		const query = `SELECT ${ATTRIBUTES} FROM security_service.organization WHERE type = ? ORDER BY name`;
		const db = options.connection || DB.pool;
		const records = await db.query(query, [type]);
		return records.map(this._mapToEntity);

	}

	static async byId (id: string, options: { connection?: Object } = {}): Promise<?Organization> {

		const query = `SELECT ${ATTRIBUTES} FROM security_service.organization WHERE id = ?`;
		const db = options.connection || DB.pool;
		const records = await db.query(query, [id]);

		if (!records.length) {

			return null;

		}

		return this._mapToEntity(records[0]);

	}

	static async byName (name: string, options: { connection?: Object } = {}): Promise<?Organization> {

		const query = `SELECT ${ATTRIBUTES} FROM security_service.organization WHERE name = ?`;
		const db = options.connection || DB.pool;
		const records = await db.query(query, [name]);

		if (!records.length) {

			return null;

		}

		return this._mapToEntity(records[0]);

	}

	static async byNameKey (nameKey: string, options: { connection?: Object } = {}): Promise<?Organization> {

		const query = `SELECT ${ATTRIBUTES} FROM security_service.organization WHERE name_key = ?`;
		const db = options.connection || DB.pool;
		const records = await db.query(query, [nameKey]);

		if (!records.length) {

			return null;

		}

		return this._mapToEntity(records[0]);

	}

	static _mapToEntity (record: OrganizationRecordType): Organization {

		return new Organization(
			record.name,
			record.type,
			{
				id: record.id,
				nameKey: record.name_key,
				status: record.status,
				created: DateConversions.utcStringToMoment(record.created)
			}
		);

	}

	static _mapToRecord (organization: Organization): DraftOrganizationRecordType {

		return {
			id: organization.id,
			name: organization.name,
			name_key: organization.nameKey,
			type: organization.type,
			status: organization.status
		};

	}

}

export default Organization;
