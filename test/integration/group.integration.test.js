import should from 'should';
import Organization from '../../src/organization';
import Account from '../../src/account';
import Group from '../../src/group';

let name = 'test dir group';
let type = 'test';
let org, dir, acc;

before(async () => {

	org = new Organization(name, type);
	await org.save();
	dir = await org.addDirectory(name);
	acc = new Account(dir.id, 'grouptest@test.com', 'test first', 'test last', {
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

});

after(async () => {

	await org.del();

});

describe('#group()', async () => {

	it('should create a group', async () => {

		const group = new Group(dir.id, name);
		await group.save();

		const result = await Group.byId(group.id);
		should.exist(result);
		result.should.have.properties(['id', 'directoryId', 'name', 'status', 'created']);
		result.id.should.be.equal(group.id);
		result.directoryId.should.be.equal(dir.id);
		result.name.should.be.equal(name);
		result.status.should.be.equal('ENABLED');
		(result.created.isValid()).should.be.ok;

	});

	it('should not create a group with the same name', async () => {

		try {

			const group = new Group(dir.id, name);
			await group.save();

		} catch (ex) {

			return;

		}

		throw new Error('should not save group with the same name');

	});

	it('should rename a group', async () => {

		const group = await Group.byNameAndDirectory(name, dir.id);
		group.name = 'test2';
		await group.save();

		const result = await Group.byId(group.id);
		should.exist(result);
		result.should.have.properties(['id', 'directoryId', 'name', 'created']);
		result.id.should.be.equal(group.id);
		result.directoryId.should.be.equal(dir.id);
		result.name.should.be.equal('test2');
		result.status.should.be.equal('ENABLED');
		(result.created.isValid()).should.be.ok;

	});

	it('should add an account', async () => {

		const group = await Group.byNameAndDirectory('test2', dir.id);
		await group.addAccount(acc.id);

		const accounts = await group.accounts();
		accounts.length.should.be.equal(1);
		accounts[0].id.should.be.equal(acc.id);

	});

	it('should remove an account', async () => {

		const group = await Group.byNameAndDirectory('test2', dir.id);
		await group.removeAccount(acc.id);

		const accounts = await group.accounts();
		accounts.length.should.be.equal(0);

	});

	it('should delete a group', async () => {

		const group = await Group.byNameAndDirectory('test2', dir.id);
		await group.del();

		const result = await Group.byId(group.id);
		should.not.exist(result);

	});

	it('should not return a group', async () => {

		const result = await Group.byId('0');
		should.not.exist(result);

	});

	it('should not save a group that fails validation', async () => {

		try {

			const group = new Group(dir.id, new Array(60).join('1'));
			await group.save();

		} catch (ex) {

			return;

		}

		throw new Error('group should not validate and save');

	});

});
