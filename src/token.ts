import nJwt from 'njwt';

class Token {

	/**
	 * Verify a token is valid
	 */
	public static async verify (token: string, secret: string): Promise<any> {

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
	 */
	public static parseTokenFromAuthorization (authorization: string): string {

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
	 */
	public static async willExpire (token: string, secret: string, seconds: number): Promise<void> {

		const result = await Token.verify(token, secret);

		// exp is in seconds, date construction is in milliseconds
		if (new Date((result.body.exp - seconds) * 1000) <= new Date()) {

			throw new Error('Token will expire');

		}

	}

	/**
	 * Parses the account href from a JWT token
	 */
	public static parseAccountFromJwt (jwt: any): string {

		return jwt.body.account;

	}

	/**
	 * Parses an array of scopes from a JWT token
	 */
	public static parseScopesFromJwt (jwt: any): string[] {

		return jwt.body.scope ? jwt.body.scope.split(' ') : [];

	}

	/**
	 * Parses the environment from a JWT token
	 */
	public static parseEnvFromJwt (jwt: any): string {

		return jwt.body.env;

	}

	/**
	 * Parses the organization from a JWT token
	 */
	public static parseOrganizationFromJwt (jwt: any): string {

		return jwt.body.organization;

	}

	/**
	 * Determines whether the token is the result of a password OAUTH flow
	 */
	public static isPasswordToken (jwt: any): boolean {

		return jwt.body.grant === 'password';

	}

}

export default Token;
