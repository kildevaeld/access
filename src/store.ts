import {IRole, IPermission} from './index'
import * as _ from 'lodash'
export interface IStore {
	addRole(role:IRole): Promise<IRole>
	getRole(name:string): Promise<IRole>
	addRule(role:IRole, rule:IPermission)
	getRules(role:IRole, resource?:any, action?:string): Promise<IPermission[]>
}


export class MemoryStore implements IStore {
	roles: Map<string,IRole> = new Map<string,IRole>();
	
	addRole(role:IRole): Promise<IRole> {
		if (this.roles.has(role.name)) {
			return Promise.reject<IRole>(new Error('role already defined'))
		}
		
		this.roles.set(role.name, role)
		return Promise.resolve(role)
	}
	
	getRole(name:string): Promise<IRole> {
		return Promise.resolve(this.roles.get(name))
	}
	
	addRule(role:IRole, rule:IPermission): Promise<IRole> {
		
		if (!role.permissions) role.permissions = [];
		
		if (!_.contains(role.permissions, rule)) {
			role.permissions.push(rule)
		}
		return Promise.resolve(role);
	}
	
	getRules(role:IRole, resource?:any, action?:string): Promise<IPermission[]> {
		
		if (!resource && !action) return Promise.resolve(role.permissions)
		
		let perms = role.permissions.filter( p => {

			if (resource && !_.isEqual(p.resource, resource)) 
				return false
				
			if (action && !_.isEqual(p.action, action)) return false;
			
			return true
		});
		
		return Promise.resolve(perms)
			
	}
	
}