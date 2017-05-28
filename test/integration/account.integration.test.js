import should from 'should';
import Account from '../../src/account';
import Organization from '../../src/organization';
import Group from '../../src/group';

let org, dir, grp, apiKey;
const name = 'test account';
const type = 'test';

before(async () => {

	org = new Organization(name, type);
	await org.save();
	dir = await org.addDirectory(name);
	grp = new Group(dir.id, 'test acc');
	await grp.save();

});

after(async () => {

	await org.del();

});

// it('should create an account', async () => {
//
// 	const o = await Organization.byName('Ad Exchange Group');
// 	console.log(o);
// 	const acc = new Account((await o.defaultDirectory()).id, 'affiliate-service@adexchangegrp.com', 'Affiliate', 'Service');
// 	await acc.changePassword('7NH7og9nANP');
// 	await acc.save();
//
// });

// it('should create an apiKey', async () => {
//
// 	const acc = await Account.byId('520b7e88-6cc7-4e68-9dea-906133c109da');
// 	console.log(await acc.addApiKey());
//
// });

describe.skip('#Account()', async () => {

	it('should create an account', async () => {

		const acc = new Account(dir.id, 'test@test.com', 'test first', 'test last', {
			middleName: 'test middle',
			address1: 'test address1',
			address2: 'test address2',
			city: 'test city',
			state: 'MD',
			postalCode: 'test postal',
			country: 'US',
			phone: '123-123-1234',
			timezone: 'test tz'
		});
		await acc.changePassword('test');
		await acc.save();

		const result = await Account.byId(acc.id);
		should.exist(result);
		result.should.have.properties(
			[
				'id',
				'directoryId',
				'email',
				'firstName',
				'lastName',
				'address1',
				'address2',
				'city',
				'state',
				'postalCode',
				'country',
				'phone',
				'timezone',
				'status',
				'created'
			]);
		result.id.should.be.equal(acc.id);
		result.directoryId.should.be.equal(dir.id);
		result.email.should.be.equal('test@test.com');
		result.firstName.should.be.equal('test first');
		result.middleName.should.be.equal('test middle');
		result.lastName.should.be.equal('test last');
		result.address1.should.be.equal('test address1');
		result.address2.should.be.equal('test address2');
		result.city.should.be.equal('test city');
		result.state.should.be.equal('MD');
		result.postalCode.should.be.equal('test postal');
		result.country.should.be.equal('US');
		result.phone.should.be.equal('123-123-1234');
		result.timezone.should.be.equal('test tz');
		result.status.should.be.equal('ENABLED');
		(result.created.isValid()).should.be.ok;

		(await result.checkPassword('test')).should.be.ok;

	});

	it('should not create an account with the same email', async () => {

		try {

			const acc = new Account(dir.id, 'test@test.com', 'test', 'test');
			await acc.changePassword('test');
			await acc.save();

		} catch (ex) {

			return;

		}

		throw new Error('should not save account with the same email');

	});

	it('should not create an account with the same userName', async () => {

		try {

			const acc = new Account(dir.id, 'test3@test.com', 'test', 'test', {userName: 'test'});
			acc.userName.should.be.equal('test');
			await acc.changePassword('test');
			await acc.save();

			const acc2 = new Account(dir.id, 'test4@test.com', 'test', 'test', {userName: 'test'});
			await acc2.changePassword('test');
			await acc2.save();

		} catch (ex) {

			ex.message.should.match(/userName already exists/);

			return;

		}

		throw new Error('should not save account with the same userName');

	});

	it('should update an account email and userName', async () => {

		const acc = new Account(dir.id, 'test9@test.com', 'test first', 'test last');
		await acc.changePassword('test');
		await acc.save();

		const result = await Account.byEmailAndDirectory('test9@test.com', dir.id);
		result.email = 'test10@test.com';
		result.userName = 'me';
		await result.save();

		const result2 = await Account.byId(result.id);
		should.exist(result2);
		result2.email.should.be.equal('test10@test.com');
		result2.userName.should.be.equal('me');

	});

	it('should add an apiKey to a account', async () => {

		const acc = await Account.byEmailAndDirectory('test@test.com', dir.id);
		apiKey = await acc.addApiKey();
		should.exist(apiKey);

		const keys = await acc.apiKeys();
		keys.length.should.be.equal(1);

	});

	it('should delete an apiKey from an account', async () => {

		const acc = await Account.byEmailAndDirectory('test@test.com', dir.id);
		await acc.deleteApiKeyById(apiKey.id);

		const keys = await acc.apiKeys();
		keys.length.should.be.equal(0);

	});

	it('should add an account to a group', async () => {

		const acc = await Account.byEmailAndDirectory('test@test.com', dir.id);
		await acc.addToGroupById(grp.id);

		const accounts = await grp.accounts();
		accounts.length.should.be.equal(1);

	});

	it('should remove an account from a group', async () => {

		const acc = await Account.byEmailAndDirectory('test@test.com', dir.id);
		await acc.removeFromGroupById(grp.id);

		const accounts = await grp.accounts();
		accounts.length.should.be.equal(0);

	});

	it('should delete an account', async () => {

		const acc = await Account.byEmailAndDirectory('test@test.com', dir.id);
		await acc.del();

		const result = await Account.byId(acc.id);
		should.not.exist(result);

	});

	it('should not return an account', async () => {

		const result = await Account.byId('0');
		should.not.exist(result);

	});

	it('should not save an account that fails validation', async () => {

		try {

			const acc = new Account(dir.id, 'test2@test.com', 'test', new Array(100).join('1'));
			await acc.save();

		} catch (ex) {

			return;

		}

		throw new Error('account should not validate and save');

	});

	it('should validate a stormpath password hash', async () => {

		const account = new Account(dir.id, 'auto-credits@adexchangegrp.com', 'auto', 'credits');

		// Position 36 start of password
		// $2a$13$vVtwzECIRodSni/mHxgoZuhDHZPkdjq/id9kBbjYKGhsXvWSZsdDm

		account._salt = '$2a$13$vVtwzECIRodSni/mHxgoZuhDHZPk';
		account._password = 'djq/id9kBbjYKGhsXvWSZsdDm';

		const result = await account.checkPassword('3sfDSF3ssf@');
		result.should.be.ok;

	});

	it('should not validate a stormpath password hash', async () => {

		const account = new Account(dir.id, 'auto-credits@adexchangegrp.com', 'auto', 'credits');
		account._salt = '$2a$13$vVtwzECIRodSni/mHxgoZuhDHZPk';
		account._password = 'djq/id9kBbjYKGhsXvWSZsdDm';

		const result = await account.checkPassword('argh');
		result.should.not.be.ok;

	});

});
