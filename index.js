'use strict';

const ACL = require('./lib').ACL
const SQLStore = require('./lib/stores/sql').SQLStore
const co = require('co');
const inspect = require('util').inspect


let store = new SQLStore({
	dialect: 'sqlite3',
	connection: {
		filename: 'test.sqlite'
	},
	debug:false
});

let acl = new ACL(store);

class Test {
	constructor () {
		this.acl_id = "test:1"
	}
}

function User (name) {
	this.name = name
}

User.prototype.acl_id = "user:1"



co(function *() {
	
	let user = new User("rasmus")
	let test = new Test()
	
	yield store.init()

	
	yield acl.role('guest', null, true)
	.role("admin", null, true)
	.role('member', 'guest', true)	
	.allow('member', 'blog', 'view',null,true)
	.allow(user, test, 'admin', function *() {
		console.log(arguments)
		return true
	});
	
	
	
	
	
	
	console.log('can edit blog',yield acl.can("member",'view', 'blog'))
	console.log('can admin test',yield acl.can('member','admin', test))
	console.log('can guest admin test', yield acl.can('guest', 'admin', test))
	console.log('can user admin test', yield acl.can(user, 'admin', test))
	store.close()
}).then(function () {
	
}).catch(function (e) {
	console.log(e.stack)
})


