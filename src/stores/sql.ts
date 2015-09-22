/// <reference path="../../typings/tsd.d.ts" />

import Knex from 'knex'
import {IStore} from '../store'
import {IRole, IPermission} from '../index'
import * as _ from 'lodash'
import co from 'co'

export interface SQLStoreConfig extends Knex.Config {
	roleTable?: string
	permissionTable: string
}

interface TableMap {
	roles?: string,
	permissions?: string,
	joint?: string
}

export class SQLStore implements IStore {
	knex: Knex
	config: SQLStoreConfig
	private _tables: TableMap
	constructor(options: SQLStoreConfig) {

		this.knex = Knex(options)
		this.config = options

	}

	public init(): Promise<void> {
		return this._initTables()
	}

	public close() {
		return this.knex.destroy();
	}

	private _initTables() {
		var knex = this.knex
		var ts: TableMap = this._tables = {
			roles: this.config.roleTable || 'roles',
			permissions: this.config.permissionTable || 'permissions'
		}

		ts.joint = this._tables.roles + '_' + this._tables.permissions

		return co(function *() {

			yield knex.schema.hasTable(ts.roles).then(exists => {
				if (!exists) {
					return knex.schema.createTable(ts.roles, function(t) {
						t.increments('id')
						t.string('name').index().unique;
						t.integer('parent_id').unsigned().references('roles.id');
					});
				}
			})

			yield knex.schema.hasTable(ts.permissions).then(exists => {
				if (!exists) {
					return knex.schema.createTable(ts.permissions, function(t) {
						t.increments('id');
						t.string('resource').index();
						t.string('action').index();
						//t.primary(['action','resource','id'])
					});
				}
			})

			yield knex.schema.hasTable(ts.joint).then(exists => {
				if (!exists) {
					return knex.schema.createTable(ts.joint, function(t) {
						t.integer('permission_id').unsigned().references('permissions.id')
						t.integer('role_id').unsigned().references('roles.id')
						t.primary(['permission_id', 'role_id']);
					});
				}
			});

			yield knex.schema.hasTable('acl_meta').then(exists => {
				if (!exists) {
					return knex.schema.createTable('acl_meta', function(t) {
						t.integer('version')
					});
				}
			});


		})


	}

	addRole(role: IRole): Promise<IRole> {
		var self = this, knex = this.knex, table = this._tables.roles

		if (role.id) {
			return Promise.reject<IRole>(new Error('role already exists!'))
		}

		return this._coTransaction(knex, function *(knex, thx) {
			var parentID = null
			if (role.parent) {
				let {id, name} = role.parent

				var parent = yield knex(table)
					.transacting(thx).first('id').where('name', name)

				if (!parent) {
					throw new Error(`parent role not found`)
				}

				parentID = parent.id

			}

			role = _.pick(role, ['name']);

			if (parentID) role.parent_id = parentID

			return thx.insert(role)
				.into(table)

		}).then(function(i) {
			if (!i) return null
			return knex(table).where('id', i[0]).first();
		})

	}
	getRole(name: string): Promise<IRole> {
		var knex = this.knex, table = this._tables.roles
		return co(function *() {

			let role = yield knex(table).where('name', name).first()

			return role
		})
	}
	addRule(role: IRole, rule: IPermission): Promise<IRole> {
		var knex = this.knex, table = this._tables.permissions
		var self = this
		return this._coTransaction(knex, function *(knex, thx) {

			role = yield knex(self._tables.roles)
				.transacting(thx).where('name', role.name).first('id')

			if (!role) {
				throw new Error(`role '${role.name}' not found`);
			}

		
			let perm = yield knex(table).transacting(thx).where(_.omit(rule, 'predicate')).first('id')

			if (!perm) {
				perm = yield knex(table).transacting(thx).insert({
					resource: rule.resource,
					action: rule.action
				});

				perm = { id: perm[0] }

			}


			return yield knex(self._tables.joint)
				.transacting(thx).insert({
					permission_id: perm.id,
					role_id: role.id
				})



		}).then((r) => {
			let role = knex(this._tables.roles).where('id', r[0]).first()
			return role
		});

	}
	getRules(role: IRole, resource?: any, action?: string): Promise<IPermission[]> {
		var self = this, knex = this.knex, table = this._tables.permissions, joint = this._tables.joint
		var roles = this._tables.roles
		return co(function *() {

			let where: any = {}

			if (resource) where.resource = resource
			if (action) where.action = action
			where[roles + '.name'] = role.name;

			let r = yield knex(table).innerJoin(joint, table + '.id', joint + '.permission_id')
				.innerJoin(roles, joint + '.role_id', roles + '.id').select('action', 'resource', table + '.id')
				.where(where)

			return r
		})
	}

	_coTransaction(knex: Knex, fn: (knex: Knex, thx: any) => void): Promise<any> {
		var self = this
		
		return knex.transaction((thx) => {

			return co(function *() {
				return yield fn.call(self, knex, thx)
			}).then(function(result) {
				return thx.commit()
				.then(function() {
					return result;
				})
			}).catch(thx.rollback);

		});
	}
}