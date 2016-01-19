var co = require('co'),
  path = require('path'),
  assert = require('assert'),
  f = require('util').format,
  SocketIOTransport = require('../../server/socket_io_transport'),
  Server = require('../../server/server'),
  MongoClient = require('mongodb').MongoClient;

// MongoDB Topology Manager
var ServerManager = require('mongodb-topology-manager').Server,
  ReplSetManager = require('mongodb-topology-manager').ReplSet;

// Get the client so we can simulate the Browser - Server connection
var MongoBrowserClient = require('../../client/mongo_client'),
  SocketIOClientTransport = require('../../client/transports/socket_io_transport'),
  ioClient = require('socket.io-client');

var createServer = function() {
  return new Promise(function(resolve, reject) {
    co(function*() {
      var httpServer = require('http').createServer(function(req, res) {
        res.end("Hello World Page");
      });

      // Get the MongoClient
      var client = yield MongoClient.connect('mongodb://localhost:27017/test');
      // Add to the server
      var mongoDBserver = new Server(client, {});
      // Add a socket transport
      mongoDBserver.registerHandler(new SocketIOTransport(httpServer));

      // Register channel handlers these are used to handle any data before it's passed through
      // to the mongodb handler
      mongoDBserver.channel('mongodb').before(function(conn, data, callback) {
        console.log("-------------------------- recevied mongodb channel message pre")
        console.dir(conn)
        callback();
      });

      // Register channel handlers these are used to handle any data before it's returned through
      // to the mongodb handler
      mongoDBserver.channel('mongodb').after(function(conn, data, callback) {
        console.log("-------------------------- recevied mongodb channel message post")
        console.dir(conn)
        callback();
      });

      // Listen to the http server
      httpServer.listen(8080, function() {
        resolve({
          httpServer: httpServer,
          client: client,
          mongoDBserver: mongoDBserver
        });
      });
    }).catch(function(err) {
      reject(err);
    });
  });
}

describe('Integration', function() {
  describe('MongoDB Connection test', function() {
    it('correctly connect', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer();
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new SocketIOClientTransport(ioClient.connect, {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080');

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });
  });

  describe('MongoDB CRUD Insert Operations', function() {
    it('correctly perform insertOne', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer();
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new SocketIOClientTransport(ioClient.connect, {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080');
        // Perform an insert
        var result = yield connectedClient.db('test').collection('tests').insertOne({a:1}, {w:1});
        assert.equal(1, result.insertedCount);
        assert.equal(1, result.insertedIds.length);

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });

    it('correctly perform insertMany', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer();
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new SocketIOClientTransport(ioClient.connect, {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080');
        // Perform an insert
        var result = yield connectedClient.db('test').collection('tests').insertMany([{a:1}, {a:2}], {w:1});
        assert.equal(2, result.insertedCount);
        assert.equal(2, Object.keys(result.insertedIds).length);
        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });
  });

  describe('MongoDB CRUD Update Operations', function() {
    it('correctly perform updateOne', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer();
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new SocketIOClientTransport(ioClient.connect, {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080');

        // Perform an upsert
        var result = yield connectedClient.db('test').collection('tests').updateOne({a:1}, {a:1}, {upsert:true, w:1});
        assert.equal(1, result.matchedCount);
        assert.equal(1, result.upsertedCount);
        assert.equal(0, result.modifiedCount);
        assert.equal(0, result.upsertedId.index);

        // Perform an update
        var result = yield connectedClient.db('test').collection('tests').updateOne({a:1}, {$set: {b:1}}, {w:1});
        assert.equal(1, result.matchedCount);
        assert.equal(0, result.upsertedCount);
        assert.equal(1, result.modifiedCount);

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });

    it('correctly perform updateMany', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer();
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new SocketIOClientTransport(ioClient.connect, {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080');

        // Perform an upsert
        var result = yield connectedClient.db('test').collection('tests').updateOne({a:1, b:1}, {a:1, b:1}, {upsert:true, w:1});
        assert.equal(1, result.matchedCount);
        assert.equal(1, result.upsertedCount);
        assert.equal(0, result.modifiedCount);
        assert.equal(0, result.upsertedId.index);

        // Perform an upsert
        var result = yield connectedClient.db('test').collection('tests').updateOne({a:1, b:2}, {a:1, b:2}, {upsert:true, w:1});
        assert.equal(1, result.matchedCount);
        assert.equal(1, result.upsertedCount);
        assert.equal(0, result.modifiedCount);
        assert.equal(0, result.upsertedId.index);

        // Perform an update
        var result = yield connectedClient.db('test').collection('tests').updateMany({a:1}, {$set: {c:1}}, {w:1});
        assert.equal(2, result.matchedCount);
        assert.equal(0, result.upsertedCount);
        assert.equal(2, result.modifiedCount);

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });
  });

  describe('MongoDB CRUD Delete Operations', function() {
    it('correctly perform deleteOne', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer();
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new SocketIOClientTransport(ioClient.connect, {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080');
        // Perform an insert
        var result = yield connectedClient.db('test').collection('tests').insertOne({a:1}, {w:1});
        assert.equal(1, result.insertedCount);
        assert.equal(1, result.insertedIds.length);

        // Perform a deleteOne
        var result = yield connectedClient.db('test').collection('tests').deleteOne({a:1}, {w:1});
        assert.equal(1, result.deletedCount);

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });

    it('correctly perform insertMany', function(done) {
      co(function*() {
        // Start the server manager
        var manager = new ServerManager('mongod', {
          dbpath: path.join(path.resolve('db'), f("data-%d", 27017)),
          setParameter: ['enableTestCommands=1']
        });

        // Start a MongoDB instance
        yield manager.purge();
        yield manager.start();

        //
        // Server connection
        //

        var object = yield createServer();
        var mongoDBserver = object.mongoDBserver;
        var dbClient = object.client;
        var httpServer = object.httpServer;

        //
        // Client connection
        //

        // Create an instance
        var client = new MongoBrowserClient(new SocketIOClientTransport(ioClient.connect, {}));

        // Attempt to connect
        var connectedClient = yield client.connect('http://localhost:8080');
        // Perform an insert
        var result = yield connectedClient.db('test').collection('tests').insertMany([{a:1}, {a:1}], {w:1});
        assert.equal(2, result.insertedCount);
        assert.equal(2, Object.keys(result.insertedIds).length);

        // Perform a deleteOne
        var result = yield connectedClient.db('test').collection('tests').deleteMany({a:1}, {w:1});
        assert.equal(2, result.deletedCount);

        // Shut down the
        httpServer.close();
        // Shut down MongoDB connection
        dbClient.close();
        // Shut down MongoDB instance
        yield manager.stop();

        done();
      }).catch(function(e) {
        console.log(e.stack)
      });
    });
  });
});
