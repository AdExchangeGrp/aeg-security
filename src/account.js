// @flow

// https://nakedsecurity.sophos.com/2016/08/18/nists-new-password-rules-what-you-need-to-know/

import { DateConversions } from '@adexchange/aeg-common';
import DB from './db';
import ApiKey from './api-key';
import Directory from './directory';
import Group from './group';
import uuid from 'uuid';
import moment from 'moment-timezone';
import bcrypt from 'bcrypt';

import type { AccountOptionsType } from './flow-typed/types';

declare type AccountRecordType = {
	id: string,
	directory_id: string,
	user_name: ?string,
	password: string,
	email: string,
	title: ?string,
	first_name: string,
	middle_name: ?string,
	last_name: string,
	address_1: ?string,
	address_2: ?string,
	city: ?string,
	state: ?string,
	postal_code: ?string,
	country: ?string,
	phone: ?string,
	timezone: ?string,
	status: string,
	created: moment
}

declare type DraftAccountRecordType = {
	id: string,
	directory_id: string,
	user_name: ?string,
	password: string,
	email: string,
	title: ?string,
	first_name: string,
	middle_name: ?string,
	last_name: string,
	address_1: ?string,
	address_2: ?string,
	city: ?string,
	state: ?string,
	postal_code: ?string,
	country: ?string,
	phone: ?string,
	timezone: ?string,
	status: string,
	created?: moment
}

const ATTRIBUTES = 'a.id, a.directory_id, a.user_name, a.password, a.email, a.title, a.first_name, a.middle_name, a.last_name, a.address_1, a.address_2, a.city, a.state, a.postal_code, a.country, a.phone, a.timezone, a.status, a.created';

const USERNAME_LEN = 100;
const PASSWORD_LEN = 255;
const EMAIL_LEN = 255;
const TITLE_LEN = 5;
const FIRST_NAME_LEN = 64;
const MIDDLE_NAME_LEN = 64;
const LAST_NAME_LEN = 64;
const ADDRESS1_LEN = 255;
const ADDRESS2_LEN = 255;
const CITY_LEN = 50;
const STATE_LEN = 2;
const POSTAL_CODE_LEN = 15;
const COUNTRY_LEN = 2;
const PHONE_LEN = 25;
const TZ_LEN = 25;
const STATUS_LEN = 15;

class Account {

	_id: string;

	_directoryId: string;

	_username: ?string;

	_password: ?string;

	_email: string;

	_title: ?string;

	_firstName: string;

	_middleName: ?string;

	_lastName: string;

	_address1: ?string;

	_address2: ?string;

	_city: ?string;

	_state: ?string;

	_postalCode: ?string;

	_country: ?string;

	_phone: ?string;

	_timezone: ?string;

	_status: string;

	_created: ?moment;

	constructor (directoryId: string,
	             email: string,
	             firstName: string,
	             lastName: string,
	             options: AccountOptionsType = {}) {

		this._id = options.id || uuid.v4();
		this._directoryId = directoryId;
		this._username = options.username;
		this._email = email;
		this._password = options.password;
		this._title = options.title;
		this._firstName = firstName;
		this._middleName = options.middleName;
		this._lastName = lastName;
		this._address1 = options.address1;
		this._address2 = options.address2;
		this._city = options.city;
		this._state = options.state;
		this._postalCode = options.postalCode;
		this._country = options.country;
		this._phone = options.phone;
		this._timezone = options.timezone;
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

	get username (): ?string {

		return this._username;

	}

	set username (username: ?string): void {

		this._username = username;

	}

	get email (): string {

		return this._email;

	}

	set email (email: string): void {

		this._email = email;

	}

	get title (): ?string {

		return this._title;

	}

	set title (title: ?string): void {

		this._title = title;

	}

	get firstName (): string {

		return this._firstName;

	}

	set firstName (firstName: string): void {

		this._firstName = firstName;

	}

	get middleName (): ?string {

		return this._middleName;

	}

	set middleName (middleName: ?string): void {

		this._middleName = middleName;

	}

	get lastName (): string {

		return this._lastName;

	}

	set lastName (lastName: string): void {

		this._lastName = lastName;

	}

	get address1 (): ?string {

		return this._address1;

	}

	set address1 (address1: ?string): void {

		this._address1 = address1;

	}

	get address2 (): ?string {

		return this._address2;

	}

	set address2 (address2: ?string): void {

		this._address2 = address2;

	}

	get city (): ?string {

		return this._city;

	}

	set city (city: ?string): void {

		this._city = city;

	}

	get state (): ?string {

		return this._state;

	}

	set state (state: ?string): void {

		this._state = state;

	}

	get postalCode (): ?string {

		return this._postalCode;

	}

	set postalCode (postalCode: ?string): void {

		this._postalCode = postalCode;

	}

	get country (): ?string {

		return this._country;

	}

	set country (country: ?string): void {

		this._country = country;

	}

	get phone (): ?string {

		return this._phone;

	}

	set phone (phone: ?string): void {

		this._phone = phone;

	}

	get timezone (): ?string {

		return this._timezone;

	}

	set timezone (timezone: ?string): void {

		this._timezone = timezone;

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

			const accountByEmail = await Account.byEmailAndDirectory(this.email, this.directoryId, {connection});

			if (accountByEmail && accountByEmail.id !== this.id) {

				throw new Error('Account by that email already exists');

			}

			if (this.username) {

				const accountByUsername = await Account.byUserNameAndDirectory(this.username, this.directoryId, {connection});

				if (accountByUsername && accountByUsername.id !== this.id) {

					throw new Error('Account by that username already exists');

				}

			}

			const account = await Account.byId(this.id, {connection});

			if (account) {

				await connection.query('UPDATE security_service.account SET ? WHERE id = ?', [Account._mapToRecord(this), account.id]);

			} else {

				await connection.query('INSERT INTO security_service.account SET ?', [Account._mapToRecord(this)]);

			}

		});

	}

	async del (): Promise<void> {

		await DB.pool.query('DELETE FROM security_service.account WHERE id = ?', [this.id]);

	}

	validate (): void {

		if (this.username && this.username.length > USERNAME_LEN) {

			throw new Error(`username cannot have string length greater than ${USERNAME_LEN}`);

		}

		if (!this._password) {

			throw new Error('password has not been set');

		}

		if (this._password.length > PASSWORD_LEN) {

			throw new Error(`password cannot have string length greater than ${PASSWORD_LEN}`);

		}

		if (this.email.length > EMAIL_LEN) {

			throw new Error(`email cannot have string length greater than ${EMAIL_LEN}`);

		}

		if (this.title && this.title.length > TITLE_LEN) {

			throw new Error(`title cannot have string length greater than ${TITLE_LEN}`);

		}

		if (this.firstName.length > FIRST_NAME_LEN) {

			throw new Error(`firstName cannot have string length greater than ${FIRST_NAME_LEN}`);

		}

		if (this.middleName && this.middleName.length > MIDDLE_NAME_LEN) {

			throw new Error(`middleName cannot have string length greater than ${MIDDLE_NAME_LEN}`);

		}

		if (this.lastName.length > LAST_NAME_LEN) {

			throw new Error(`lastName cannot have string length greater than ${LAST_NAME_LEN}`);

		}

		if (this.address1 && this.address1.length > ADDRESS1_LEN) {

			throw new Error(`address1 cannot have string length greater than ${ADDRESS1_LEN}`);

		}

		if (this.address2 && this.address2.length > ADDRESS2_LEN) {

			throw new Error(`address2 cannot have string length greater than ${ADDRESS2_LEN}`);

		}

		if (this.city && this.city.length > CITY_LEN) {

			throw new Error(`city cannot have string length greater than ${CITY_LEN}`);

		}

		if (this.state && this.state.length > STATE_LEN) {

			throw new Error(`state cannot have string length greater than ${STATE_LEN}`);

		}

		if (this.postalCode && this.postalCode.length > POSTAL_CODE_LEN) {

			throw new Error(`postalCode cannot have string length greater than ${POSTAL_CODE_LEN}`);

		}

		if (this.country && this.country.length > COUNTRY_LEN) {

			throw new Error(`country cannot have string length greater than ${COUNTRY_LEN}`);

		}

		if (this.phone && this.phone.length > PHONE_LEN) {

			throw new Error(`phone cannot have string length greater than ${PHONE_LEN}`);

		}

		if (this.timezone && this.timezone.length > TZ_LEN) {

			throw new Error(`timezone cannot have string length greater than ${TZ_LEN}`);

		}

		if (this.status.length > STATUS_LEN) {

			throw new Error(`status cannot have string length greater than ${STATUS_LEN}`);

		}

	}

	async changePassword (password: string): Promise<void> {

		this._password = await bcrypt.hash(password, 13);

	}

	async checkPassword (password: string): Promise<boolean> {

		try {

			return await bcrypt.compare(password, this._password);

		} catch (ex) {

			return false;

		}

	}

	async addToGroupById (id: string): Promise<void> {

		const group = await Group.byId(id);
		return group.addAccount(this.id);

	}

	async removeFromGroupById (id: string): Promise<void> {

		const group = await Group.byId(id);
		return group.removeAccount(this.id);

	}

	async addToGroupByName (name: string): Promise<void> {

		const group = await Group.byNameAndDirectory(name, this.directoryId);
		return group.addAccount(this.id);

	}

	async removeFromGroupByName (name: string): Promise<void> {

		const group = await Group.byNameAndDirectory(name, this.directoryId);
		return group.removeAccount(this.id);

	}

	async enabledGroups () {

		return Group.byAccountIdAndEnabled(this.id);

	}

	async addApiKey (): Promise<ApiKey> {

		const apiKey = new ApiKey(this.id);
		await apiKey.save();
		return apiKey;

	}

	async deleteApiKeyById (id: string): Promise<void> {

		const apiKey = await ApiKey.byId(id);

		if (apiKey && apiKey.accountId === this.id) {

			return apiKey.del();

		} else {

			throw new Error('apiKey not found for account');

		}

	}

	async deleteApiKeyByPublic (pub: string): Promise<void> {

		const apiKey = await ApiKey.byPublic(pub);

		if (apiKey && apiKey.accountId === this.id) {

			return apiKey.del();

		} else {

			throw new Error('apiKey not found for account');

		}

	}

	async apiKeys (): Promise<Array<ApiKey>> {

		return ApiKey.byAccountId(this.id);

	}

	static async byId (id: string, options: { connection?: Object } = {}): Promise<?Account> {

		const query = `SELECT ${ATTRIBUTES} FROM security_service.account a WHERE a.id = ?`;
		const db = options.connection || DB.pool;
		const records = await db.query(query, [id]);

		if (!records.length) {

			return null;

		}

		return this._mapToEntity(records[0]);

	}

	static async byEmailAndDirectory (email: string, directoryId: string, options: { connection?: Object } = {}): Promise<?Account> {

		const query = `SELECT ${ATTRIBUTES} FROM security_service.account a WHERE a.email = ? and a.directory_id = ?`;
		const db = options.connection || DB.pool;
		const records = await db.query(query, [email, directoryId]);

		if (!records.length) {

			return null;

		}

		return this._mapToEntity(records[0]);

	}

	static async byEmail (email: string, options: { connection?: Object } = {}): Promise<Array<Account>> {

		const query = `SELECT ${ATTRIBUTES} FROM security_service.account a WHERE a.email = ?`;
		const db = options.connection || DB.pool;
		const records = await db.query(query, [email]);
		return records.map(this._mapToEntity);

	}

	static async byUserName (username: string, options: { connection?: Object } = {}): Promise<Array<Account>> {

		const query = `SELECT ${ATTRIBUTES} FROM security_service.account a WHERE a.user_name = ?`;
		const db = options.connection || DB.pool;
		const records = await db.query(query, [username]);
		return records.map(this._mapToEntity);

	}

	static async byUserNameAndDirectory (username: string, directoryId: string, options: { connection?: Object } = {}): Promise<?Account> {

		const query = `SELECT ${ATTRIBUTES} FROM security_service.account a WHERE a.user_name = ? and a.directory_id = ?`;
		const db = options.connection || DB.pool;
		const records = await db.query(query, [username, directoryId]);

		if (!records.length) {

			return null;

		}

		return this._mapToEntity(records[0]);

	}

	static async byGroupId (id: string, options: { connection?: Object } = {}): Promise<Array<Account>> {

		const db = options.connection || DB.pool;

		let query = `SELECT ${ATTRIBUTES} FROM security_service.account a \
		             INNER JOIN security_service.account_group ag ON a.id = ag.account_id \
		             WHERE ag.group_id = ?`;

		const accountRecords = await db.query(query, [id]);

		return accountRecords.map(this._mapToEntity);

	}

	static _mapToEntity (record: AccountRecordType): Account {

		return new Account(
			record.directory_id,
			record.email,
			record.first_name,
			record.last_name,
			{
				id: record.id,
				password: record.password,
				username: record.user_name,
				title: record.title,
				middleName: record.middle_name,
				address1: record.address_1,
				address2: record.address_2,
				city: record.city,
				state: record.state,
				postalCode: record.postal_code,
				country: record.country,
				phone: record.phone,
				timezone: record.timezone,
				status: record.status,
				created: DateConversions.utcStringToMoment(record.created)
			}
		);

	}

	static _mapToRecord (account: Account): DraftAccountRecordType {

		return {
			id: account.id,
			directory_id: account.directoryId,
			user_name: account.username,
			password: account._password || '',
			email: account.email,
			title: account.title,
			first_name: account.firstName,
			middle_name: account.middleName,
			last_name: account.lastName,
			address_1: account.address1,
			address_2: account.address2,
			city: account.city,
			state: account.state,
			postal_code: account.postalCode,
			country: account.country,
			phone: account.phone,
			timezone: account.timezone,
			status: account.status
		};

	}

}

export default Account;
