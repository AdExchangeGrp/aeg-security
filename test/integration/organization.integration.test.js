import should from 'should';
import Organization from '../../src/organization';

let name = 'test save';
let nameKey = 'test-save';
let type = 'test';

describe('#organization()', async () => {

	it('should create an organization', async () => {

		const org = new Organization(name, type);
		await org.save();

		const result = await Organization.byId(org.id);
		should.exist(result);
		result.should.have.properties(['id', 'name', 'nameKey', 'type', 'status', 'created']);
		result.id.should.be.equal(org.id);
		result.name.should.be.equal(name);
		result.nameKey.should.be.equal(nameKey);
		result.type.should.be.equal(type);
		result.status.should.be.equal('ENABLED');
		(result.created.isValid()).should.be.ok;

	});

	it('should not save an organization with the same name', async () => {

		try {

			const org = new Organization(name, type);
			await org.save();

		} catch (ex) {

			return;

		}

		throw new Error('should not save directory with the same name');

	});

	it('should not create an organization with the same name', async () => {

		try {

			const org = new Organization(name, type);
			await org.save();

		} catch (ex) {

			return;

		}

		throw new Error('should not save an organization with the same name');

	});

	it('should update an organization', async () => {

		const org = await Organization.byNameKey(nameKey);
		org.type = 'test2';
		await org.save();

		const result = await Organization.byId(org.id);
		should.exist(result);
		result.should.have.properties(['id', 'name', 'nameKey', 'type', 'status', 'created']);
		result.id.should.be.equal(org.id);
		result.name.should.be.equal('test save');
		result.nameKey.should.be.equal('test-save');
		result.type.should.be.equal('test2');
		(result.created.isValid()).should.be.ok;

	});

	it('should rename an organization', async () => {

		const org = await Organization.byNameKey(nameKey);
		org.name = 'test21';
		await org.save();

		const result = await Organization.byId(org.id);
		should.exist(result);
		result.should.have.properties(['id', 'name', 'nameKey', 'type', 'status', 'created']);
		result.id.should.be.equal(org.id);
		result.name.should.be.equal('test21');
		result.nameKey.should.be.equal('test21');
		result.type.should.be.equal('test2');
		(result.created.isValid()).should.be.ok;

	});

	it('should get organizations', async () => {

		const organizations = await Organization.all();
		should.exist(organizations);
		organizations.length.should.be.greaterThanOrEqual(1);

	});

	it('should get organizations by type', async () => {

		const organizations = await Organization.byType('test2');
		should.exist(organizations);
		organizations.length.should.be.greaterThanOrEqual(1);

	});

	it('should delete an organization', async () => {

		const org = await Organization.byNameKey('test21');
		await org.del();

		const result = await Organization.byId(org.id);
		should.not.exist(result);

	});

	it('should not return an organization', async () => {

		const result = await Organization.byId('0');
		should.not.exist(result);

	});

	it('should not save an organization that fails validation', async () => {

		try {

			const org = new Organization(name, type, {status: '11111111111111111111111111111111111111111111'});
			await org.save();

		} catch (ex) {

			return;

		}

		throw new Error('organization should not validate and save');

	});

});
