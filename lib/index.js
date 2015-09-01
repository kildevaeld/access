/// <reference path="../typings/tsd.d.ts" />
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});
exports.role = role;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

var _lodash = require('lodash');

var _ = _interopRequireWildcard(_lodash);

var _store = require('./store');

var _co = require('co');

var _co2 = _interopRequireDefault(_co);

function role() {
    for (var _len = arguments.length, roles = Array(_len), _key = 0; _key < _len; _key++) {
        roles[_key] = arguments[_key];
    }

    return function (target) {
        var cRoles = target.prototype.acl_roles || [];
        target.prototype.acl_roles = _.uniq(cRoles.concat(roles));
    };
}

class Queue {
    constructor(acl, promise) {
        this.acl = acl;
        if (role) {}
        this._queue = promise ? [promise] : [];
        this._queue2 = [];
        this.__done = false;
    }
    role(name, inherits) {
        if (this.__done) return this;
        this._queue.push(this.acl.role(name, inherits));
        return this;
    }
    allow(role, resource, action, fn) {
        if (this.__done) return this;
        this._queue2.push(function (acl) {
            return acl.allow(role, resource, action, fn);
        });
        return this;
    }
    then(resolve, reject) {
        var _this = this;

        this.__done = true;
        return Promise.all(this._queue).then(function () {
            var a = _this._queue2.map(function (q) {
                return q(_this.acl);
            });
            return Promise.all(a);
        }).then(resolve, reject);
    }
}

exports.Queue = Queue;

class ACL {
    constructor(store) {
        this.store = store || new _store.MemoryStore();
    }
    role(name, inherits) {
        var silent = arguments.length <= 2 || arguments[2] === undefined ? true : arguments[2];

        var self = this;
        var p = (0, _co2['default'])(function* () {
            var role = yield self.store.getRole(name);
            if (role) {
                if (!silent) throw new Error('Role \'' + name + '\'\' already exists');
                return role;
            }
            var parent = undefined;
            if (inherits) {
                parent = yield self.store.getRole(inherits);
                if (!parent) {
                    throw new Error('parent role \'' + inherits + '\' for role ' + name + ' does not exists');
                }
            }
            role = {
                name: name,
                parent: parent,
                permissions: []
            };
            return yield self.store.addRole(role);
        });
        return new Queue(this, p);
    }
    allow(role, resource, action, fn) {
        var silent = arguments.length <= 4 || arguments[4] === undefined ? true : arguments[4];

        var self = this;
        resource = resource && resource.acl_id ? resource.acl_id : resource;
        var p = (0, _co2['default'])(function* () {
            var roles = [];
            if (typeof role !== 'string' && role.acl_id) {
                var irole = yield self.store.getRole(role.acl_id);
                if (!irole) {
                    irole = yield self.store.addRole({ name: role.acl_id });
                }
                roles = [irole];
            } else {
                roles = yield self._getRoles(self.store, role);
            }
            var perm = {
                action: action,
                resource: resource,
                predicate: fn
            };
            var proms = roles.map(function (r) {
                return self.store.addRule(r, perm);
            });
            return Promise.all(proms)['catch'](function (e) {
                if (!silent) throw e;
                return roles;
            });
        });
        var q = new Queue(this);
        q._queue2.push(function () {
            return p;
        });
        return q;
    }
    hasRole(name) {
        return this.store.getRole(name).then(function (r) {
            return r != null;
        });
    }
    can(role, action, resource) {
        var self = this;
        resource = resource && resource.acl_id ? resource.acl_id : resource;
        return (0, _co2['default'])(function* () {
            var roles = undefined;
            if (typeof role !== 'string' && role.acl_id) {
                var irole = yield self.store.getRole(role.acl_id);
                if (!irole) {
                    irole = yield self.role(role.acl_id);
                }
                roles = [irole];
            } else {
                roles = yield self._getRoles(self.store, role);
            }
            var perms = undefined,
                parent = undefined;
            for (var i = 0, ii = roles.length; i < ii; i++) {
                parent = roles[i];
                perms = yield self.store.getRules(parent, resource, action);
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
    _getRole(store, role) {
        if (typeof role === 'string') {
            return store.getRole(role).then(function (irole) {
                if (irole == null) {
                    throw new Error('role \'' + role + '\'\' not found');
                }
                return irole;
            });
        } else {
            return Promise.resolve(role);
        }
    }
    _getRoles(store, role) {
        if (typeof role === 'string') {
            return store.getRole(role).then(function (irole) {
                if (irole == null) {
                    throw new Error('role \'' + role + '\' not found');
                }
                return [irole];
            });
        } else if (role.acl_roles && Array.isArray(role.acl_roles)) {
            var _ret = (function () {
                var roles = role.acl_roles;
                return {
                    v: (0, _co2['default'])(function* () {
                        for (var i = 0, ii = roles.length; i < ii; i++) {
                            var _role = yield store.getRole(roles[i]);
                            if (!_role) {
                                throw new Error('role \'' + roles[i] + ' not found\'');
                            }
                            roles[i] = _role;
                        }
                        return roles.length ? roles : null;
                    })
                };
            })();

            if (typeof _ret === 'object') return _ret.v;
        }
    }
}

exports.ACL = ACL;