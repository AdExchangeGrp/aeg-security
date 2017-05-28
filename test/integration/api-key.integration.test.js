import should from 'should';
import ApiKey from '../../src/api-key';
import Account from '../../src/account';
import Organization from '../../src/organization';
import Application from '../../src/application';
// import { authorize as authorizeToken } from '../../../src/oauth-security-handler';

let app, org, dir, acc, apiKeyId, token;
const name = 'test account apikey';
const type = 'test';

before(async () => {

	app = await Application.byName('Camp 2');
	org = new Organization(name, type);
	await org.save();
	dir = await org.addDirectory(name);
	await app.addDirectory(dir.id);
	acc = new Account(dir.id, 'apptestauth2apikey@test.com', 'test', 'test');
	await acc.changePassword('test');
	await acc.save();

});

after(async () => {

	await org.del();

});

describe('#ApiKey()', async () => {

	it('should create an apiKey', async () => {

		const apiKey = new ApiKey(acc.id);
		await apiKey.save();

		const result = await ApiKey.byId(apiKey.id);
		result.should.have.properties(['id', 'accountId', 'pub', 'pri', 'created']);
		result.accountId.should.be.equal(acc.id);

		apiKeyId = apiKey.id;

	});

	it('should exchange an apiKey for an accessToken and reauthorize it', async () => {

		const apiKey = await ApiKey.byId(apiKeyId);
		const result = await app.authenticateWithClientCredentialsGrant(apiKey.tokenize(), []);
		result.should.have.properties(['accessToken', 'tokenType', 'expiresIn', 'scope']);
		result.tokenType.should.be.equal('bearer');
		result.expiresIn.should.be.a.Number;

		token = result.accessToken;

		await (await Application.byName('Camp 2')).authenticateToken(token);

	});

	it('should revoke an access token by apiKey', async () => {

		await app.revokeGrant(token);

		try {

			await (await Application.byName('Camp 2')).authenticateToken(token);

		} catch (ex) {

			return;

		}

		throw new Error('should not have authorized revoked token');

	});

	it('should delete an apiKey by id', async () => {

		const apiKey = new ApiKey(apiKeyId);
		await apiKey.del();

		const result = await ApiKey.byId(apiKey.id);
		should.not.exist(result);

	});

});
