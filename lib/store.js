'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

var _lodash = require('lodash');

var _ = _interopRequireWildcard(_lodash);

class MemoryStore {
    constructor() {
        this.roles = new Map();
    }
    addRole(role) {
        if (this.roles.has(role.name)) {
            return Promise.reject(new Error('role already defined'));
        }
        this.roles.set(role.name, role);
        return Promise.resolve(role);
    }
    getRole(name) {
        return Promise.resolve(this.roles.get(name));
    }
    addRule(role, rule) {
        if (!role.permissions) role.permissions = [];
        if (!_.contains(role.permissions, rule)) {
            role.permissions.push(rule);
        }
        return Promise.resolve(role);
    }
    getRules(role, resource, action) {
        if (!resource && !action) return Promise.resolve(role.permissions);
        var perms = role.permissions.filter(function (p) {
            if (resource && !_.isEqual(p.resource, resource)) return false;
            if (action && !_.isEqual(p.action, action)) return false;
            return true;
        });
        return Promise.resolve(perms);
    }
}

exports.MemoryStore = MemoryStore;