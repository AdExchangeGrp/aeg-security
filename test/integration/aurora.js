import { MySQLPooled } from '@adexchange/aeg-mysql';
import config from 'config';
import logger from './logger-mock';

const auroraConfig = config.get('app').aws.aurora;

export const options = {
	logger,
	connectionLimit: 100,
	host: auroraConfig.host,
	user: auroraConfig.user,
	port: auroraConfig.port,
	password: auroraConfig.password,
	insecureAuth: true,
	acquireTimeout: 240000,
	waitForConnections: true,
	queueLimit: 0,
	timezone: 'Z',
	dateStrings: true
};

export default new MySQLPooled(options);
