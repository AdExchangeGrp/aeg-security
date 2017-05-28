// @flow

import DB from './db';
import uuid from 'uuid';
import moment from 'moment-timezone';
import { DateConversions } from '@adexchange/aeg-common';
import Directory from './directory';
import Account from './account';
import nJwt from 'njwt';
import secureRandom from 'secure-random';
import Config from './config';
import TokenCache from './token-cache';
import Token from './token';
import ApiKey from './api-key';
import _ from 'lodash';

import type { ApplicationOptionsType, TokenResponseType } from './flow-typed/types';

declare type ApplicationRecordType = {
	id: string,
	name: string,
	signing_key: string,
	access_token_ttl: number,
	refresh_token_ttl: number,
	status: string,
	created: moment
}

declare type DraftApplicationRecordType = {
	id: string,
	name: string,
	signing_key: string,
	access_token_ttl: number,
	refresh_token_ttl: number,
	status: string,
	created?: moment
}

const ATTRIBUTES = 'id, name, signing_key, access_token_ttl, refresh_token_ttl, status, created';

const NAME_LEN = 255;
const STATUS_LEN = 15;

class Application {

	_id: string;

	_name: string;

	_signingKey: string;

	_accessTokenTTLInSeconds: number;

	_refreshTokenTTLInSeconds: number;

	_status: string;

	_created: ?moment;

	constructor (name: string, options: ApplicationOptionsType = {}) {

		this._id = options.id || uuid.v4();
		this._name = name;
		this._signingKey = options.signingKey || secureRandom(256, {type: 'Buffer'}).toString('base64');
		this._accessTokenTTLInSeconds = options.accessTokenTTLInSeconds || 3600;
		this._refreshTokenTTLInSeconds = options.refreshTokenTTLInSeconds || 5184000;
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

	get signingKey (): string {

		return this._signingKey;

	}

	set signingKey (signingKey: string): void {

		this._signingKey = signingKey;

	}

	set accessTokenTTLInSeconds (seconds: number): void {

		this._accessTokenTTLInSeconds = seconds;

	}

	get accessTokenTTLInSeconds (): number {

		return this._accessTokenTTLInSeconds;

	}

	set refreshTokenTTLInSeconds (seconds: number): void {

		this._refreshTokenTTLInSeconds = seconds;

	}

	get refreshTokenTTLInSeconds (): number {

		return this._refreshTokenTTLInSeconds;

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

			const application = await Application.byId(this.id, {connection});

			if (application) {

				await connection.query('UPDATE security_service.application SET ? WHERE id = ?', [Application._mapToRecord(this), application.id]);

			} else {

				await connection.query('INSERT INTO security_service.application SET ?', [Application._mapToRecord(this)]);

			}

		});

	}

	async del (): Promise<void> {

		await DB.pool.query('DELETE FROM security_service.application WHERE id = ?', [this.id]);

	}

	validate (): void {

		if (this.name.length > NAME_LEN) {

			throw new Error(`name cannot have string length greater than ${NAME_LEN}`);

		}

		if (this.status.length > STATUS_LEN) {

			throw new Error(`status cannot have string length greater than ${STATUS_LEN}`);

		}

	}

	async directories (): Promise<Array<Directory>> {

		return Directory.byApplication(this.id);

	}

	async addDirectory (id: string): Promise<void> {

		return DB.pool.query('INSERT INTO security_service.application_directory (application_id, directory_id) VALUES (?, ?)', [this.id, id]);

	}

	async removeDirectory (id: string): Promise<void> {

		return DB.pool.query('DELETE FROM security_service.application_directory WHERE application_id = ? AND directory_id = ?', [this.id, id]);

	}

	async authenticateWithPasswordGrant (directoryId: string, emailOrUserName: string, password: string): Promise<TokenResponseType> {

		if (this.status !== 'ENABLED') {

			throw new Error('Application is disabled');

		}

		const directory = await Directory.byId(directoryId);

		if (!directory) {

			throw new Error('Directory does not exist');

		}

		if (!await directory.belongsToApplication(this.id)) {

			throw new Error('Directory does not belong to application');

		}

		if (directory.status !== 'ENABLED') {

			throw new Error('Directory is disabled or does not exist');

		}

		const organization = await directory.organization;

		if (!organization) {

			throw new Error('Organization does not exist');

		}

		let account = await Account.byEmailAndDirectory(emailOrUserName, directory.id);

		if (!account) {

			account = await Account.byUserNameAndDirectory(emailOrUserName, directory.id);

		}

		if (!account) {

			const primaryDirectory = await Directory.byId(Config.security.primaryDirectory);

			if (!primaryDirectory) {

				throw new Error('Primary directory does not exist');

			}

			account = await Account.byEmailAndDirectory(emailOrUserName, primaryDirectory.id);

			if (!account) {

				account = await Account.byUserNameAndDirectory(emailOrUserName, primaryDirectory.id);

			}

		}

		if (!account || account.status !== 'ENABLED') {

			throw new Error('Invalid user or password');

		}

		const result = await account.checkPassword(password);

		if (!result) {

			throw new Error('Invalid password');

		}

		const groups = await account.enabledGroups();

		const scope = groups.map(g => g.name).join(' ');

		const claims = {
			iss: this.id,
			sub: account.id,
			scope,
			account: account.id,
			env: process.env.NODE_ENV,
			organization: {
				href: organization.id,
				nameKey: organization.nameKey
			},
			grant: 'password'
		};

		const accessJWT = nJwt.create(claims, this.signingKey);
		accessJWT.setHeader('kid', this.id);
		accessJWT.setHeader('stt', 'access');
		accessJWT.setExpiration(new Date().getTime() + (this._accessTokenTTLInSeconds * 1000));
		const accessToken = accessJWT.compact();

		const refreshJWT = nJwt.create(claims, this.signingKey);
		accessJWT.setHeader('kid', this.id);
		refreshJWT.setHeader('stt', 'refresh');
		const refreshToken = refreshJWT.compact();

		await TokenCache.instance.addAccessAndRefreshToken(this.signingKey, accessToken, refreshToken);

		return {
			accessToken,
			refreshToken: refreshToken,
			tokenType: 'bearer',
			expiresIn: this._accessTokenTTLInSeconds,
			scope,
			account: {
				href: account.id,
				status: account.status,
				email: account.email,
				givenName: account.firstName,
				surname: account.lastName,
				scopes: groups.map((g) => {

					return {href: g.id, name: g.name, status: g.status};

				})
			}
		};

	}

	async authenticateWithClientCredentialsGrant (base64Token: string, scopes: Array<string>): Promise<TokenResponseType> {

		if (this.status !== 'ENABLED') {

			throw new Error('Application is disabled');

		}

		const utf8Token = Buffer.from(base64Token, 'base64').toString('utf8');
		const [pub, pri] = utf8Token.split(':');

		const apiKey = await ApiKey.byPublic(pub);

		if (!apiKey) {

			throw new Error('API key does not exist for account');

		}

		if (apiKey.pri !== pri) {

			throw new Error('API key is invalid');

		}

		const account = await apiKey.account;

		if (!account || account.status !== 'ENABLED') {

			throw new Error('Invalid user or password');

		}

		const directory = await account.directory;

		if (!directory) {

			throw new Error('Directory does not exist');

		}

		if (!await directory.belongsToApplication(this.id)) {

			throw new Error('Directory does not belong to application');

		}

		if (directory.status !== 'ENABLED') {

			throw new Error('Directory is disabled or does not exist');

		}

		const organization = await directory.organization;

		if (!organization) {

			throw new Error('Organization does not exist');

		}

		const groups = (await account.enabledGroups()).map(g => g.name);
		const allowedScopes = _.intersection(scopes, groups);

		const claims = {
			iss: this.id,
			sub: account.id,
			scope: allowedScopes.join(' '),
			account: account.id,
			env: process.env.NODE_ENV,
			organization: {
				href: organization.id,
				nameKey: organization.nameKey
			},
			grant: 'client_credentials'
		};

		const accessJWT = nJwt.create(claims, this.signingKey);
		accessJWT.setHeader('kid', this.id);
		accessJWT.setHeader('stt', 'access');
		accessJWT.setExpiration(new Date().getTime() + (this._accessTokenTTLInSeconds * 1000));
		const accessToken = accessJWT.compact();

		await TokenCache.instance.addAccessToken(this.signingKey, accessToken);

		return {
			accessToken,
			tokenType: 'bearer',
			expiresIn: this._accessTokenTTLInSeconds,
			scope: allowedScopes.join(' ')
		};

	}

	async refreshToken (refreshToken: string): Promise<TokenResponseType> {

		const exists = await TokenCache.instance.getRefreshToken(refreshToken);

		if (!exists) {

			throw new Error('Token has expired');

		}

		let jwt;

		try {

			jwt = await Token.verify(refreshToken, this.signingKey);

		} catch (ex) {

			if (ex.message === 'Jwt is expired') {

				throw new Error('Token has expired');

			} else {

				throw new Error('Invalid token');

			}

		}

		if (this.status !== 'ENABLED') {

			throw new Error('Application is disabled');

		}

		const account = await Account.byId(jwt.body.account);

		if (!account || account.status !== 'ENABLED') {

			throw new Error('Account does not exist or is invalid');

		}

		const directory = await account.directory;

		if (!directory) {

			throw new Error('Directory does not exist');

		}

		if (!await directory.belongsToApplication(this.id)) {

			throw new Error('Directory does not belong to application');

		}

		if (directory.status !== 'ENABLED') {

			throw new Error('Directory is disabled or does not exist');

		}

		const organization = await directory.organization;

		if (!organization) {

			throw new Error('Organization does not exist');

		}

		const groups = await account.enabledGroups();

		const scope = groups.map(g => g.name).join(' ');

		const claims = {
			iss: this.id,
			sub: account.id,
			scope,
			account: account.id,
			env: process.env.NODE_ENV,
			organization: {
				href: organization.id,
				nameKey: organization.nameKey
			},
			grant: 'password'
		};

		const accessJWT = nJwt.create(claims, this.signingKey);
		accessJWT.setHeader('kid', this.id);
		accessJWT.setHeader('stt', 'access');
		accessJWT.setExpiration(new Date().getTime() + (this._accessTokenTTLInSeconds * 1000));
		const accessToken = accessJWT.compact();

		await TokenCache.instance.addAccessAndRefreshToken(this.signingKey, accessToken, refreshToken);

		return {
			accessToken,
			refreshToken: refreshToken,
			tokenType: 'bearer',
			expiresIn: this._accessTokenTTLInSeconds,
			scope,
			account: {
				href: account.id,
				status: account.status,
				email: account.email,
				givenName: account.firstName,
				surname: account.lastName,
				scopes: groups.map((g) => {

					return {href: g.id, name: g.name, status: g.status};

				})
			}
		};

	}

	async authenticateToken (token: string): Promise<boolean> {

		const result = await TokenCache.instance.getAccessToken(token);
		return !!result;

	}

	async revokeGrant (accessToken: string): Promise<void> {

		const token = await TokenCache.instance.getAccessToken(accessToken);

		if (token) {

			await TokenCache.instance.deleteAccessToken(accessToken);

			if (token.refreshToken) {

				await TokenCache.instance.deleteRefreshToken(token.refreshToken);

			}

		}

	}

	static async byId (id: string, options: { connection?: Object } = {}): Promise<?Application> {

		const query = `SELECT ${ATTRIBUTES} FROM security_service.application WHERE id = ?`;
		const db = options.connection || DB.pool;
		const records = await db.query(query, [id]);

		if (!records.length) {

			return null;

		}

		return this._mapToEntity(records[0]);

	}

	static async byName (name: string, options: { connection?: Object } = {}): Promise<?Application> {

		const query = `SELECT ${ATTRIBUTES} FROM security_service.application WHERE name = ?`;
		const db = options.connection || DB.pool;
		const records = await db.query(query, [name]);

		if (!records.length) {

			return null;

		}

		return this._mapToEntity(records[0]);

	}

	static _mapToEntity (record: ApplicationRecordType): Application {

		return new Application(
			record.name,
			{
				id: record.id,
				signingKey: record.signing_key,
				accessTokenTTLInSeconds: record.access_token_ttl,
				refreshTokenTTLInSeconds: record.refresh_token_ttl,
				status: record.status,
				created: DateConversions.utcStringToMoment(record.created)
			}
		);

	}

	static _mapToRecord (application: Application): DraftApplicationRecordType {

		return {
			id: application.id,
			name: application.name,
			signing_key: application.signingKey,
			access_token_ttl: application.accessTokenTTLInSeconds,
			refresh_token_ttl: application.refreshTokenTTLInSeconds,
			status: application.status
		};

	}

}

export default Application;
