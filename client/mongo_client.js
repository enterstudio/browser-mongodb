"use strict"

var Promise = require('./util').Promise,
  Callbacks = require('./callbacks'),
  MongoError = require('./mongo_error'),
  Long = require('./bson/long'),
  ObjectId = require('./bson/objectid'),
  co = require('co'),
  deserializeFast = require('./bson/bson_parser').deserializeFast,
  Db = require('./db');

var deserialize = function(obj) {
  if(obj != null && typeof obj === 'object') {
    for(var name in obj) {
      if(obj[name] != null && obj[name]['$numberLong']) {
        obj[name] = Long.fromString(obj[name]['$numberLong']);
      } else if(obj[name] != null && obj[name]['$oid']) {
        obj[name] = new ObjectId(obj[name]['$oid']);
      } else if(obj[name] != null && typeof obj[name] === 'object') {
        obj[name] = deserialize(obj[name]);
      }
    }
  }

  return obj;
}

class MongoClient {
  constructor(transportFactory) {
    this.transportFactory = transportFactory;
    this.store = new Callbacks();
  }

  connect(url, channel, options) {
    var self = this;
    // Set the options
    this.options = options || {}
    // Use a custom channel or the default one
    this.channel = channel || 'mongodb';

    // Return the promise to allow for the connection
    return new Promise(function(resolve, reject) {
      co(function*() {
        console.log("!!!!!!!!!! connect 0")
        // Save the socket
        self.transport = yield self.transportFactory.connect(url, options);
        console.log("!!!!!!!!!! connect 1")
        // Listen to all mongodb socket information
        self.transport.onChannel(self.channel, function(data) {
          if(data.ok != null && !data.ok) {
            self.store.call(data._id, new MongoError(data), undefined);
          } else if(data.ok != null && data.ok && typeof data.type == 'string') {
            self.store.update(deserialize(data));
          } else if(data.ok != null && data.ok) {
            if(data.result.length) {
              data.result = deserializeFast(data.result);
            } else {
              data.result = deserialize(data.result);
            }

            // Result from a command
            self.store.call(data._id, null, data);
          }
        });
        console.log("!!!!!!!!!! connect 2")

        self.transport.on('connect', function() {
          console.log("!!!!!!!!!! connect")
          co(function*() {
            console.log("!!!!!!!!!! connect -1")
            // Execute ismaster against server to determine abilites available
            self.abilities = yield self.db('admin').command({ismaster:true});
            console.log("!!!!!!!!!! connect -2")
            // Resolve
            resolve(self);
          }).catch(function(err) {
            reject(err);
          });
        });

        self.transport.on('close', function() {
          reject();
        });

        self.transport.on('error', function(e) {
          reject(e);
        });
      }).catch(function(err) {
        reject(err);
      });
    });
  }

  db(name) {
    return new Db(name, this.channel, this.transport, this.store);
  }
}

module.exports = MongoClient;
