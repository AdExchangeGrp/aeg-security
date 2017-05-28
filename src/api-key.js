// @flow

import { DateConversions } from '@adexchange/aeg-common';
import aurora from '../test/integration/aurora';
import Account from './account';
import uuid from 'uuid';
import moment from 'moment-timezone';
import crypto from 'crypto';

import type { ApiKeyOptionsType } from './flow-typed/types';

declare type ApiKeyRecordType = {
	id: string,
	account_id: string,
	'public': string,
	'private': string,
	created: moment
}

declare type DraftApiKeyRecordType = {
	id: string,
	account_id: string,
	'public': string,
	'private': string,
	created?: moment
}

const ATTRIBUTES = 'k.id, k.account_id, k.public, k.private, k.created';

class ApiKey {

	_id: string;

	_accountId: string;

	_public: string;

	_private: string;

	_created: ?moment;

	constructor (accountId: string, options: ApiKeyOptionsType = {}) {

		this._id = options.id || uuid.v4();
		this._accountId = accountId;
		const diffieHellman = crypto.createDiffieHellman(256);
		diffieHellman.generateKeys('base64');
		this._public = options.pub || diffieHellman.getPublicKey('base64');
		this._private = options.pri || diffieHellman.getPrivateKey('base64');
		this._created = options.created;

	}

	get id (): string {

		return this._id;

	}

	get accountId (): string {

		return this._accountId;

	}

	set accountId (id: string): void {

		this._accountId = id;

	}

	get account (): Promise<?Account> {

		return Account.byId(this._accountId);

	}

	get pub (): string {

		return this._public;

	}

	set pub (pub: string): void {

		this._public = pub;

	}

	get pri (): string {

		return this._private;

	}

	set pri (pri: string): void {

		this._private = pri;

	}

	get created (): ?moment {

		return this._created;

	}

	async save (): Promise<void> {

		await aurora.withTransaction(async (connection) => {

			const apiKey = await ApiKey.byId(this.id, {connection});

			if (apiKey) {

				await connection.query('UPDATE security_service.account_api_key SET ? WHERE id = ?', [ApiKey._mapToRecord(this), apiKey.id]);

			} else {

				await connection.query('INSERT INTO security_service.account_api_key SET ?', [ApiKey._mapToRecord(this)]);

			}

		});

	}

	async del (): Promise<void> {

		await aurora.query('DELETE FROM security_service.account_api_key WHERE id = ?', [this.id]);

	}

	tokenize (): string {

		return Buffer.from(`${this.pub}:${this.pri}`, 'utf8').toString('base64');

	}

	static async byId (id: string, options: { connection?: Object } = {}): Promise<?ApiKey> {

		const query = `SELECT ${ATTRIBUTES} FROM security_service.account_api_key k WHERE k.id = ?`;
		const db = options.connection || aurora;
		const records = await db.query(query, [id]);

		if (!records.length) {

			return null;

		}

		return this._mapToEntity(records[0]);

	}

	static async byPublic (pub: string, options: { connection?: Object } = {}): Promise<?ApiKey> {

		const query = `SELECT ${ATTRIBUTES} FROM security_service.account_api_key k WHERE k.public = ?`;
		const db = options.connection || aurora;
		const records = await db.query(query, [pub]);

		if (!records.length) {

			return null;

		}

		return this._mapToEntity(records[0]);

	}

	static async byAccountId (id: string, options: { connection?: Object } = {}): Promise<Array<ApiKey>> {

		const db = options.connection || aurora;

		const query = `SELECT ${ATTRIBUTES} FROM security_service.account_api_key k WHERE k.account_id = ? ORDER BY k.public`;

		const records = await db.query(query, [id]);

		return records.map(this._mapToEntity);

	}

	static _mapToEntity (record: ApiKeyRecordType): ApiKey {

		return new ApiKey(
			record.account_id,
			{
				id: record.id,
				pub: record.public,
				pri: record.private,
				created: DateConversions.utcStringToMoment(record.created)
			}
		);

	}

	static _mapToRecord (apiKey: ApiKey): DraftApiKeyRecordType {

		return {
			id: apiKey.id,
			account_id: apiKey.accountId,
			'public': apiKey.pub,
			'private': apiKey.pri
		};

	}

}

export default ApiKey;
