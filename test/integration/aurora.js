import { MySQLPooled } from '@adexchange/aeg-mysql';
import logger from './logger-mock';

export const options = {
	logger,
	connectionLimit: 100,
	host: 'camp-ci-cluster.cluster-crg9xjuvtppr.us-west-2.rds.amazonaws.com',
	user: 'sec_service',
	port: 3306,
	password: '2hsdfhSD82d',
	insecureAuth: true,
	acquireTimeout: 240000,
	waitForConnections: true,
	queueLimit: 0,
	timezone: 'Z',
	dateStrings: true
};

export default new MySQLPooled(options);
