// @flow

import Redis from '@adexchange/aeg-redis';
import Config from './config';
import Token from './token';

/**
 * Token cache
 */
class TokenCache extends Redis {

	_instance: TokenCache;

	/**
	 * Constructor
	 */
	constructor () {

		super({host: Config.security.cache.host, port: Config.security.cache.port, prefix: 'aeg-security:'});

	}

	static instance () {

		if (!this._instance) {

			this._instance = new TokenCache();

		}

		return this._instance;

	}

	async getAccessToken (token: string): Promise<Object> {

		return super.hgetall('accessToken:' + token);

	}

	async getRefreshToken (token: string): Promise<Object> {

		return super.hgetall('refreshToken:' + token);

	}

	async addAccessAndRefreshToken (secret: string,
	                                accessToken: string,
	                                refreshToken: string): Promise<void> {

		let accessTokenJwt;

		try {

			accessTokenJwt = await Token.verify(accessToken, secret);

		} catch (ex) {

			// the token is invalid, we just wont add it

		}

		if (!accessTokenJwt) {

			return;

		}

		const application = accessTokenJwt.header.kid;
		const accessTokenExpireTime = Math.floor(accessTokenJwt.body.exp - (new Date().getTime() / 1000));

		await super.hmset('accessToken:' + accessToken, {
			application,
			account: accessTokenJwt.body.account,
			refreshToken
		}, {expire: accessTokenExpireTime});

		let refreshTokenJwt;

		try {

			refreshTokenJwt = await Token.verify(refreshToken, secret);

		} catch (ex) {

			// the token is invalid, we just wont add it

		}

		if (!refreshTokenJwt) {

			return;

		}

		const refreshTokenExpireTime = Math.floor(refreshTokenJwt.body.exp - (new Date().getTime() / 1000));
		await super.hmset('refreshToken:' + refreshToken, {
			application,
			account: refreshTokenJwt.body.account,
			accessToken
		}, {expire: refreshTokenExpireTime});

	}

	async addAccessToken (secret: string, accessToken: string): Promise<void> {

		let accessTokenJwt;

		try {

			accessTokenJwt = await Token.verify(accessToken, secret);

		} catch (ex) {

			// the token is invalid, we just wont add it

		}

		if (!accessTokenJwt) {

			return;

		}

		const application = accessTokenJwt.header.kid;
		const accessTokenExpireTime = Math.floor(accessTokenJwt.body.exp - (new Date().getTime() / 1000));

		await super.hmset('accessToken:' + accessToken, {
			application,
			account: accessTokenJwt.body.account
		}, {expire: accessTokenExpireTime});

	}

	async deleteAccessToken (accessToken: string): Promise<void> {

		await super.del('accessToken:' + accessToken);

	}

	async deleteRefreshToken (refreshToken: string): Promise<void> {

		await super.del('refreshToken:' + refreshToken);

	}

}

export default TokenCache;
