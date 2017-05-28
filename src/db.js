// @flow

class DB {

	_pool: Object;

	get pool (): Object {

		if (!this._pool) {

			throw new Error('Security database pool not set');

		}

		return this._pool;

	}

	initialize (pool: Object) {

		this._pool = pool;

	}

}

export default new DB();
