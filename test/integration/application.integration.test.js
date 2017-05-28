import should from 'should';
import Application from '../../src/application';
import Organization from '../../src/organization';
import Directory from '../../src/directory';
import Account from '../../src/account';
import Group from '../../src/group';
import nJwt from 'njwt';
import TokenCache from '../../src/token-cache';

let application, signingKey, adexDir, adexOrg, adexAcc, adexGrp, oauthOrg, oauthDir, oauthAcc;

const verify = function (token, secret) {

	return new Promise((resolve, reject) => {

		nJwt.verify(token, secret, (err, result) => {

			if (err) {

				reject(err);

			} else {

				resolve(result);

			}

		});

	});

};

before(async () => {

	application = await Application.byId('f0234fba-519b-41d1-95ee-3d5cf873aed2');

	adexDir = await Directory.byId('d843415b-4adf-4dfd-8e14-68fb8cedcf7d');
	adexOrg = await adexDir.organization;
	adexAcc = new Account(adexDir.id, 'apptestauth2@test.com', 'test', 'test');
	await adexAcc.changePassword('test');
	await adexAcc.save();
	adexGrp = new Group(adexDir.id, 'test2');
	await adexGrp.save();
	await adexAcc.addToGroupById(adexGrp.id);

	oauthOrg = new Organization('test auth', 'affiliate');
	await oauthOrg.save();
	oauthDir = await oauthOrg.addDirectory('test auth');
	await oauthDir.addToApplication(application.id);
	oauthAcc = new Account(oauthDir.id, 'apptestauth3@test.com', 'test', 'test');
	await oauthAcc.changePassword('test');
	await oauthAcc.save();

});

after(async () => {

	await adexAcc.del();
	await adexGrp.del();

	await oauthOrg.del();

});

describe('#application()', async () => {

	it('should authenticate an adex account on the adex directory', async () => {

		const result = await application.authenticateWithPasswordGrant(adexDir.id, adexAcc.email, 'test');
		result.should.have.properties('accessToken', 'refreshToken', 'tokenType', 'expiresIn', 'scope');
		result.tokenType.should.be.equal('bearer');
		result.expiresIn.should.be.a.Number;
		result.scope.should.be.equal(adexGrp.name);

		const jwt = await verify(result.accessToken, application.signingKey);
		jwt.body.organization.href.should.be.equal(adexOrg.id);

		const refreshResult = await application.refreshToken(result.refreshToken);
		refreshResult.should.have.properties('accessToken', 'refreshToken', 'tokenType', 'expiresIn', 'scope');
		refreshResult.tokenType.should.be.equal('bearer');
		refreshResult.expiresIn.should.be.a.Number;
		refreshResult.scope.should.be.equal(adexGrp.name);

		refreshResult.refreshToken.should.be.equal(result.refreshToken);
		refreshResult.accessToken.should.not.be.equal(result.accessToken);

	});

	it('should not authenticate a non-adex account on any other directory', async () => {

		try {

			await application.authenticateWithPasswordGrant(adexDir.id, oauthAcc.email, 'test');

		} catch (ex) {

			return;

		}

		throw new Error('Should not have authenticated');

	});

	it('should authenticate an adex account on any other directory', async () => {

		const result = await application.authenticateWithPasswordGrant(oauthDir.id, adexAcc.email, 'test');
		result.should.have.properties('accessToken', 'refreshToken', 'tokenType', 'expiresIn', 'scope');

		const jwt = await verify(result.accessToken, application.signingKey);
		jwt.body.organization.href.should.be.equal(oauthOrg.id);

	});

	it('should authenticate and revoke a non-adex account on its own directory', async () => {

		const result = await application.authenticateWithPasswordGrant(oauthDir.id, oauthAcc.email, 'test');
		result.should.have.properties('accessToken', 'refreshToken', 'tokenType', 'expiresIn', 'scope');

		const jwt = await verify(result.accessToken, application.signingKey);
		jwt.body.organization.href.should.be.equal(oauthOrg.id);

		const t1 = await TokenCache.instance.getAccessToken(result.accessToken);
		should.exist(t1);
		t1.should.have.properties(['refreshToken']);
		const t2 = await TokenCache.instance.getRefreshToken(result.refreshToken);
		should.exist(t2);
		t2.should.have.properties(['accessToken']);

		await application.revokeGrant(result.accessToken);

		const t3 = await TokenCache.instance.getAccessToken(result.accessToken);
		should.not.exist(t3);
		const t4 = await TokenCache.instance.getRefreshToken(result.refreshToken);
		should.not.exist(t4);

	});

	it('should create an application', async () => {

		const app = new Application('test');
		await app.save();

		const result = await Application.byId(app.id);
		should.exist(result);
		result.should.have.properties(['id', 'name', 'signingKey', 'accessTokenTTLInSeconds', 'refreshTokenTTLInSeconds', 'status', 'created']);
		result.id.should.be.equal(app.id);
		result.name.should.be.equal('test');
		result.signingKey.length.should.be.ok;

		signingKey = result.signingKey;

		result.accessTokenTTLInSeconds.should.be.equal(3600);
		result.refreshTokenTTLInSeconds.should.be.equal(5184000);
		result.status.should.be.equal('ENABLED');
		(result.created.isValid()).should.be.ok;

	});

	it('should not save an application with the same name', async () => {

		try {

			const app = new Application('test');
			await app.save();

		} catch (ex) {

			return;

		}

		throw new Error('should not save application with the same name');

	});

	it('should not create an application with the same name', async () => {

		try {

			const app = new Application('test');
			await app.save();

		} catch (ex) {

			return;

		}

		throw new Error('should not save an application with the same name');

	});

	it('should update an application', async () => {

		const app = await Application.byName('test');
		app.accessTokenTTLInSeconds = 36000;
		app.refreshTokenTTLInSeconds = 51840000;
		await app.save();

		const result = await Application.byId(app.id);
		should.exist(result);
		result.should.have.properties(['id', 'name', 'signingKey', 'accessTokenTTLInSeconds', 'refreshTokenTTLInSeconds', 'status', 'created']);
		result.signingKey.should.be.equal(signingKey);
		result.accessTokenTTLInSeconds.should.be.equal(36000);
		result.refreshTokenTTLInSeconds.should.be.equal(51840000);

	});

	it('should remove a directory from an application', async () => {

		const app = await Application.byName('test');
		await app.removeDirectory(oauthDir.id);

		const apps = await app.directories();
		apps.length.should.be.equal(0);

	});

	it('should add a directory to an application', async () => {

		const app = await Application.byName('test');
		await app.addDirectory(oauthDir.id);

		const apps = await app.directories();
		apps.length.should.be.equal(1);

	});

	it('should rename an application', async () => {

		const app = await Application.byName('test');
		app.name = 'test2';
		await app.save();

		const result = await Application.byId(app.id);
		should.exist(result);
		result.should.have.properties(['id', 'name', 'signingKey', 'accessTokenTTLInSeconds', 'refreshTokenTTLInSeconds', 'status', 'created']);
		result.id.should.be.equal(app.id);
		result.name.should.be.equal('test2');
		(result.created.isValid()).should.be.ok;

	});

	it('should delete an application', async () => {

		const app = await Application.byName('test2');
		await app.del();

		const result = await Application.byId(app.id);
		should.not.exist(result);

	});

	it('should not return an application', async () => {

		const result = await Application.byId('0');
		should.not.exist(result);

	});

	it('should not save an application that fails validation', async () => {

		try {

			const app = new Application(new Array(300).join('1'));
			await app.save();

		} catch (ex) {

			return;

		}

		throw new Error('application should not validate and save');

	});

});
