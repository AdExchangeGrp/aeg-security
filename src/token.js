// @flow

import nJwt from 'njwt';

class Token {

	static async verify (token: string, secret: string): Promise<Object> {

		return new Promise((resolve, reject) => {

			nJwt.verify(token, secret, (err, jwt) => {

				if (err) {

					reject(err);

				} else {

					resolve(jwt);

				}

			});

		});

	}

	/**
	 * Parses the token from the authorization header
	 * @param {string} authorization
	 * @returns {*}
	 */
	static parseTokenFromAuthorization (authorization: string): string {

		if (!authorization) {

			return '';

		}

		const parts = authorization.split(' ');

		if (parts.length) {

			return parts[1];

		} else {

			return '';

		}

	}

	/**
	 * Will this token expire soon
	 * @param {string} token
	 * @param {string} secret
	 * @param {number} seconds
	 */
	static async willExpire (token: string, secret: string, seconds: number): Promise<void> {

		const result = await Token.verify(token, secret);

		// exp is in seconds, date construction is in milliseconds
		if (new Date((result.body.exp - seconds) * 1000) <= new Date()) {

			throw new Error('Token will expire');

		}

	}

	/**
	 * Parses the account href from a JWT token
	 * @param {Object} jwt
	 * @returns {*}
	 */
	static parseAccountFromJwt (jwt: Object): string {

		return jwt.body.account;

	}

	/**
	 * Parses an array of scopes from a JWT token
	 * @param {Object} jwt
	 * @returns {*}
	 */
	static parseScopesFromJwt (jwt: Object): Array<string> {

		return jwt.body.scope ? jwt.body.scope.split(' ') : [];

	}

	/**
	 * Parses the environment from a JWT token
	 * @param {Object} jwt
	 * @returns {*}
	 */
	static parseEnvFromJwt (jwt: Object): string {

		return jwt.body.env;

	}

	/**
	 * Parses the organization from a JWT token
	 * @param {Object} jwt
	 * @returns {*}
	 */
	static parseOrganizationFromJwt (jwt: Object): string {

		return jwt.body.organization;

	}

	/**
	 * Determines whether the token is the result of a password OAUTH flow
	 * @param {Object} jwt
	 */
	static isPasswordToken (jwt: Object): boolean {

		return jwt.body.grant === 'password';

	}

}

export default Token;
