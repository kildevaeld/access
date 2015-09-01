/// <reference path="../../typings/tsd.d.ts" />
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _knex = require('knex');

var _knex2 = _interopRequireDefault(_knex);

var _lodash = require('lodash');

var _ = _interopRequireWildcard(_lodash);

var _co = require('co');

var _co2 = _interopRequireDefault(_co);

class SQLStore {
    constructor(options) {
        this.knex = (0, _knex2['default'])(options);
        this.config = options;
    }
    init() {
        return this._initTables();
    }
    close() {
        return this.knex.destroy();
    }
    _initTables() {
        var knex = this.knex;
        var ts = this._tables = {
            roles: this.config.roleTable || 'roles',
            permissions: this.config.permissionTable || 'permissions'
        };
        ts.joint = this._tables.roles + '_' + this._tables.permissions;
        return (0, _co2['default'])(function* () {
            yield knex.schema.hasTable(ts.roles).then(function (exists) {
                if (!exists) {
                    return knex.schema.createTable(ts.roles, function (t) {
                        t.increments('id');
                        t.string('name').index().unique;
                        t.integer('parent_id').unsigned().references('roles.id');
                    });
                }
            });
            yield knex.schema.hasTable(ts.permissions).then(function (exists) {
                if (!exists) {
                    return knex.schema.createTable(ts.permissions, function (t) {
                        t.increments('id');
                        t.string('resource').index();
                        t.string('action').index();
                        //t.primary(['action','resource','id'])
                    });
                }
            });
            yield knex.schema.hasTable(ts.joint).then(function (exists) {
                if (!exists) {
                    return knex.schema.createTable(ts.joint, function (t) {
                        t.integer('permission_id').unsigned().references('permissions.id');
                        t.integer('role_id').unsigned().references('roles.id');
                        t.primary(['permission_id', 'role_id']);
                    });
                }
            });
            yield knex.schema.hasTable('acl_meta').then(function (exists) {
                if (!exists) {
                    return knex.schema.createTable('acl_meta', function (t) {
                        t.integer('version');
                    });
                }
            });
        });
    }
    addRole(role) {
        var self = this,
            knex = this.knex,
            table = this._tables.roles;
        if (role.id) {
            return Promise.reject(new Error('role already exists!'));
        }
        return this._coTransaction(knex, function* (knex, thx) {
            var parentID = null;
            if (role.parent) {
                var _role$parent = role.parent;
                var id = _role$parent.id;
                var _name = _role$parent.name;

                var parent = yield knex(table).transacting(thx).first('id').where('name', _name);
                if (!parent) {
                    throw new Error('parent role not found');
                }
                parentID = parent.id;
            }
            role = _.pick(role, ['name']);
            if (parentID) role.parent_id = parentID;
            return thx.insert(role).into(table);
        }).then(function (i) {
            if (!i) return null;
            return knex(table).where('id', i[0]).first();
        });
    }
    getRole(name) {
        var knex = this.knex,
            table = this._tables.roles;
        return (0, _co2['default'])(function* () {
            var role = yield knex(table).where('name', name).first();
            return role;
        });
    }
    addRule(role, rule) {
        var _this = this;

        var knex = this.knex,
            table = this._tables.permissions;
        return this._coTransaction(knex, function* (knex, thx) {
            role = yield knex(this._tables.roles).transacting(thx).where('name', role.name).first('id');
            if (!role) {
                throw new Error('role \'' + role.name + '\' not found');
            }
            var perm = yield knex(table).transacting(thx).where(rule).first('id');
            if (!perm) {
                perm = yield knex(table).transacting(thx).insert({
                    resource: rule.resource,
                    action: rule.action
                });
                perm = { id: perm[0] };
            }
            return yield knex(this._tables.joint).transacting(thx).insert({
                permission_id: perm.id,
                role_id: role.id
            });
        }).then(function (r) {
            var role = knex(_this._tables.roles).where('id', r[0]).first();
            return role;
        });
    }
    getRules(role, resource, action) {
        var self = this,
            knex = this.knex,
            table = this._tables.permissions,
            joint = this._tables.joint;
        var roles = this._tables.roles;
        return (0, _co2['default'])(function* () {
            var where = {};
            if (resource) where.resource = resource;
            if (action) where.action = action;
            where[roles + '.name'] = role.name;
            var r = yield knex(table).innerJoin(joint, table + '.id', joint + '.permission_id').innerJoin(roles, joint + '.role_id', roles + '.id').select('action', 'resource', table + '.id').where(where);
            return r;
        });
    }
    _coTransaction(knex, fn) {
        var self = this;
        return new Promise(function (resolve, reject) {
            knex.transaction(function (thx) {
                return (0, _co2['default'])(function* () {
                    return yield fn.call(self, knex, thx);
                }).then(function (result) {
                    return thx.commit().then(function () {
                        resolve(result);
                    });
                })['catch'](function (e) {
                    thx.rollback().then(function () {
                        reject(e);
                    });
                });
            });
        });
    }
}

exports.SQLStore = SQLStore;