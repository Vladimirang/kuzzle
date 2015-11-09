module.exports = function (kuzzle) {
  var
    _ = require('lodash'),
    q = require('q'),
    Repository = require('./repository'),
    Role = require('../security/role');


  function RoleRepository() {
    this.roles = {};
  }

  RoleRepository.prototype = new Repository(kuzzle, {
    collection: '_kuzzle/roles',
    ObjectConstructor: Role,
    cacheEngine: kuzzle.services.list.userCache
  });

  /**
   * From a list of role ids, retrieves the matching Role objects.
   *
   * @param {Array} roleKeys The role ids to load
   * @returns {Promise} Resolves to an array containing the matching found Role objects.
   */
  RoleRepository.prototype.loadRoles = function (roleKeys) {
    var
      deferred = q.defer(),
      keys = [],
      buffer = {},
      result = [];

    roleKeys.forEach(function (roleKey) {
      if (this.roles[roleKey]) {
        buffer[roleKey] = this.roles[roleKey];
      }
      else {
        keys.push(roleKey);
      }
    }.bind(this));

    if (keys.length === 0) {
      Object.keys(buffer).forEach(function (key) {
        result.push(buffer[key]);
      });

      deferred.resolve(result);
    }
    else {
      this.loadMultiFromDatabase(keys)
        .then(function (roles) {
          var promises = [];

          roles.forEach(function (role) {
            buffer[role._id] = role;
          });

          _.difference(roleKeys, Object.keys(buffer)).forEach(function (key) {
            var role;

            if (kuzzle.config.defaultUserRoles[key] !== undefined) {
              role = new Role();
              promises.push(this.hydrate(role, kuzzle.config.defaultUserRoles[key]));
            }
          }.bind(this));

          if (promises.length === 0) {
            Object.keys(buffer).forEach(function (key) {
              result.push(buffer[key]);
            });

            deferred.resolve(result);
            return;
          }

          q.all(promises)
            .then(function (results) {
              results.forEach(function (role) {
                buffer[role._id] = role;
              });

              Object.keys(buffer).forEach(function (key) {
                result.push(buffer[key]);
              });

              deferred.resolve(result);
            })
            .catch(function (error) {
              deferred.reject(error);
            });
        }.bind(this))
        .catch(function (error) {
          deferred.reject(error);
        });
    }


    return deferred.promise;
  };

  return RoleRepository;
};
