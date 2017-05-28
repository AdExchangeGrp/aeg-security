import should from 'should';
import Organization from '../../src/organization';
import Directory from '../../src/directory';
import aurora from './aurora';

let name = 'test dir2';
let type = 'test';
let org;

before(async () => {

	org = new Organization(name, type);
	await org.save();

});

after(async () => {

	await org.del();

});

describe('#directory()', async () => {

	it('should create a default directory', async () => {

		const dir = new Directory(org.id, name);
		await dir.save();
		const result = await Directory.byId(dir.id);
		should.exist(result);
		result.should.have.properties(['id', 'organizationId', 'name', 'status', 'created']);
		result.id.should.be.equal(dir.id);
		result.organizationId.should.be.equal(org.id);
		result.name.should.be.equal(name);
		result.isDefault.should.be.ok;
		result.status.should.be.equal('ENABLED');
		(result.created.isValid()).should.be.ok;

	});

	it('should not save a directory with the same name', async () => {

		try {

			const dir = new Directory(org.id, name);
			await dir.save();

		} catch (ex) {

			return;

		}

		throw new Error('should not save directory with the same name');

	});

	it('should count directories for an organization', async () => {

		const count = await Directory.byOrganizationCount(org.id);
		count.should.be.equal(1);

	});

	it('should rename a directory', async () => {

		const dir = await Directory.byNameAndOrganization(name, org.id);
		dir.name = 'test2';
		await dir.save();

		const result = await Directory.byId(dir.id);
		should.exist(result);
		result.should.have.properties(['id', 'organizationId', 'name', 'status', 'created']);
		result.id.should.be.equal(dir.id);
		result.organizationId.should.be.equal(org.id);
		result.name.should.be.equal('test2');
		(result.created.isValid()).should.be.ok;

	});

	it('should create another directory as the default', async () => {

		const dir = new Directory(org.id, 'test3', {isDefault: true});
		await dir.save();
		const result = await Directory.byId(dir.id);
		should.exist(result);
		result.isDefault.should.be.ok;

		const count = await countByIsDefaultAndOrganization(org.id);
		count.should.be.equal(1);

	});

	it('should set another directory as the default', async () => {

		// make test2 the default
		let dir = await Directory.byNameAndOrganization('test2', org.id);
		dir.isDefault = true;
		await dir.save();

		let result = await Directory.byId(dir.id);
		should.exist(result);
		result.isDefault.should.be.ok;

		let count = await countByIsDefaultAndOrganization(org.id);
		count.should.be.equal(1);

		// make test3 the default by making test2 not the default
		dir.isDefault = false;
		await dir.save();

		result = await Directory.byId(dir.id);
		should.exist(result);
		result.isDefault.should.not.be.ok;

		count = await countByIsDefaultAndOrganization(org.id);
		count.should.be.equal(1);

	});

	it('should delete the default directory', async () => {

		const dir = await Directory.byNameAndOrganization('test3', org.id);
		await dir.del();

		const result = await Directory.byId(dir.id);
		should.not.exist(result);

		const count = await countByIsDefaultAndOrganization(org.id);
		count.should.be.equal(1);

	});

	it('should not return a directory', async () => {

		const result = await Directory.byId('0');
		should.not.exist(result);

	});

	it('should not save an organization that fails validation', async () => {

		try {

			const dir = new Directory(org.id, name, {status: '11111111111111111111111111111111111111111111'});
			await dir.save();

		} catch (ex) {

			return;

		}

		throw new Error('directory should not validate and save');

	});

});

async function countByIsDefaultAndOrganization (organizationId) {

	const query = 'SELECT id, organization_id, name, is_default, status, created FROM security_service.directory WHERE organization_id = ? AND is_default = 1';
	const records = await aurora.query(query, [organizationId]);
	return records.length;

}
