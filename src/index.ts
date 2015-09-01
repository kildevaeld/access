/// <reference path="../typings/tsd.d.ts" />

import * as _ from 'lodash'
import {IStore, MemoryStore} from './store'
import co from 'co'


export function role(...roles: string[]): ClassDecorator {
	return function(target) {
		var cRoles = target.prototype.acl_roles || [];
		target.prototype.acl_roles = _.uniq(cRoles.concat(roles));
	}
}

export interface Predicate {
	(role: any, resource: any, action: string): Promise<boolean>
}

export interface IPermission {
	action: string
	resource: any
	predicate?: Predicate
}

export interface IPermisiveable {
	acl_id?: string
}

export interface IRoleable extends IPermisiveable {
	acl_roles?: string[]
}

export interface IRole {
	name: string
	parent?: IRole
	permissions: IPermission[]
}

export interface IACL {
	role(name: string, inherits?: string): IACL
	allow(role: string|IRoleable, resource: string|IPermisiveable, action: string, fn?: Predicate): IACL 
}

export class Queue implements IACL {
	_queue: IACL[]
	_queue2: Function[]
	acl: IACL
	__done: boolean
	constructor (acl:IACL, promise?:any) {
		this.acl = acl
		if (role) {
			
		}
		this._queue = promise ? [promise] : []
		this._queue2 =  []
		this.__done = false
	}
	role(name: string, inherits?: string): IACL {
		if (this.__done) return this
		this._queue.push(this.acl.role(name,inherits))
		return this
	}
	allow(role: string|IRoleable, resource: string|IPermisiveable, action: string, fn?: Predicate): IACL {
		if (this.__done) return this
		this._queue2.push((acl) => {
			return acl.allow(role,resource,action, fn)
		})
		return this
	}
	then(resolve,reject): Promise<any> {
		this.__done = true;
		
		return Promise.all(this._queue)
		.then( () => {
			let a = this._queue2.map( q => q(this.acl) )
			return Promise.all(a)
		}).then(resolve, reject)
	}
}

export class ACL implements IACL {
	store: IStore

	constructor(store?: IStore) {
		this.store = store || new MemoryStore();
	}

	role(name: string, inherits?: string, silent:boolean = true): IACL {
		var self = this

		let p =  co(function *() {

			let role = yield self.store.getRole(name)
			
			if (role) {
				if (!silent)
					throw new Error(`Role '${name}'' already exists`);
				return role
			}

			let parent
			if (inherits) {
				parent = yield self.store.getRole(inherits)

				if (!parent) {
					throw new Error(`parent role '${inherits}' for role ${name} does not exists`);
				}
			}

			role = {
				name: name,
				parent: parent,
				permissions: []
			};

			return yield self.store.addRole(role)
		});
		
		return new Queue(this, p);
	}


	allow(role: string|IRoleable, resource: string|IPermisiveable, action: string, fn?: Predicate, silent:boolean = true ): IACL {
		var self = this;

		resource = (resource && (<IPermisiveable>resource).acl_id) ?
			(<IPermisiveable>resource).acl_id : resource; 

		let p = co(function *() {
			
			let roles = []
			if (typeof role !== 'string' && role.acl_id) {

				let irole = yield self.store.getRole(role.acl_id)
				if (!irole) {
					irole = yield self.store.addRole({name:role.acl_id});
				}

				roles = [irole]

			} else {
				roles = yield self._getRoles(self.store, role);
			}

			let perm: IPermission = {
				action: action,
				resource: resource,
				predicate: fn
			};

			let proms = roles.map(function(r) {
				return self.store.addRule(r, perm)
			})

			return Promise.all(proms).catch( e => {
				if (!silent)
					throw e
				return roles
			})
		});

		let q = new Queue(this)
		q._queue2.push(() => {
			return p
		})
		return q
	}

	hasRole(name: string): Promise<boolean> {
		return this.store.getRole(name)
			.then(function(r) {
				return r != null
			})
	}

	can(role: string|IRoleable, action: string, resource: string|IPermisiveable): Promise<boolean> {

		var self = this;
		
		resource = (resource && (<IPermisiveable>resource).acl_id) ?
			(<IPermisiveable>resource).acl_id : resource; 

		return co(function *() {

			let roles

			if (typeof role !== 'string' && role.acl_id) {

				let irole = yield self.store.getRole(role.acl_id)
				if (!irole) {
					irole = yield self.role(role.acl_id);
				}

				roles = [irole]

			} else {
				roles = yield self._getRoles(self.store, role);
			}
			
			let perms, parent
			for (let i = 0, ii = roles.length; i < ii; i++) {

				parent = roles[i];
				
				perms = yield self.store.getRules(parent,resource,action)
			
				if (perms.length) {
					return true;
				}
				
				while (parent = parent.parent) {

					perms = yield self.store.getRules(parent, resource, action);

					if (perms.length) return true;

				}
				
			}
			return false;
			
		});

	}

	_getRole(store: IStore, role: string|IRole): Promise<IRole> {
		if (typeof role === 'string') {
			return store.getRole(role).then(function(irole) {
				if (irole == null) {
					throw new Error(`role '${role}'' not found`)
				}
				return irole
			})
		} else {
			return Promise.resolve(role)
		}

	}

	_getRoles(store: IStore, role: string|IRoleable): Promise<IRole[]> {
		if (typeof role === 'string') {
			return store.getRole(role).then(function(irole) {
				if (irole == null) {
					throw new Error(`role '${role}' not found`)
				}
				return [irole]
			})
		} else if (role.acl_roles && Array.isArray(role.acl_roles)) {
			let roles = role.acl_roles
			return co(function *() {

				for (let i = 0, ii = roles.length; i < ii; i++) {

					let role = yield store.getRole(roles[i]);
					if (!role) {
						throw new Error(`role '${roles[i]} not found'`);
					}

					roles[i] = role;
				}

				return roles.length ? roles : null
			});


		}

	}

}