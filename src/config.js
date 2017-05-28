// @flow

import config from 'config';

class Config {

	_securityConfig: Object;

	get security (): Object {

		if (!this._securityConfig) {

			this._securityConfig = config.get('aeg-security');

		}

		return this._securityConfig;

	}

}

export default new Config();
