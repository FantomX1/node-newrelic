'use strict'

var DESTINATIONS = require('../../../../lib/config/attribute-filter').DESTINATIONS
var helper = require('../../../lib/agent_helper')
var HTTP_ATTRS = require('../../../lib/fixtures').httpAttributes
var request = require('request')
var tap = require('tap')


module.exports = runTests

function runTests(createServer) {
  tap.test("Hapi capture params support", function(t) {
    t.autoend()

    var agent = null
    var server = null
    var port = null

    t.beforeEach(function(done) {
      agent = helper.instrumentMockedAgent(null, {
        allow_all_headers: false,
        attributes: {
          enabled: true,
          include: ['request.parameters.*']
        }
      })

      server = createServer()
      done()
    })

    t.afterEach(function(done) {
      helper.unloadAgent(agent)
      server.stop(done)
    })

    t.test("simple case with no params", function(t) {
      agent.on('transactionFinished', function(transaction) {
        t.ok(transaction.trace, 'transaction has a trace.')
        var attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
        HTTP_ATTRS.forEach(function(key) {
          t.ok(attributes[key], 'Trace contains expected HTTP attribute: ' + key)
        })
        if (attributes.httpResponseMessage) {
          t.equal(
            attributes.httpResponseMessage,
            'OK',
            'Trace contains httpResponseMessage'
          )
        }
      })

      server.route({
        method: 'GET',
        path: '/test/',
        handler: function(req, reply) {
          t.ok(agent.getTransaction(), "transaction is available")

          reply({status: 'ok'})
        }
      })

      server.start(function() {
        port = server.info.port
        makeRequest(t, 'http://localhost:' + port + '/test/')
      })
    })

    t.test("case with route params", function(t) {
      agent.on('transactionFinished', function(transaction) {
        t.ok(transaction.trace, 'transaction has a trace.')
        var attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
        t.equal(
          attributes['request.parameters.id'], '1337',
          'Trace attributes include `id` route param'
        )
      })

      server.route({
        method: 'GET',
        path: '/test/{id}/',
        handler: function(req, reply) {
          t.ok(agent.getTransaction(), "transaction is available")

          reply({status: 'ok'})
        }
      })

      server.start(function() {
        port = server.info.port
        makeRequest(t, 'http://localhost:' + port + '/test/1337/')
      })
    })

    t.test("case with query params", function(t) {
      agent.on('transactionFinished', function(transaction) {
        t.ok(transaction.trace, 'transaction has a trace.')
        var attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
        t.equal(
          attributes['request.parameters.name'], 'hapi',
          'Trace attributes include `name` query param'
        )
      })

      server.route({
        method: 'GET',
        path: '/test/',
        handler: function(req, reply) {
          t.ok(agent.getTransaction(), "transaction is available")

          reply({status: 'ok'})
        }
      })

      server.start(function() {
        port = server.info.port
        makeRequest(t, 'http://localhost:' + port + '/test/?name=hapi')
      })
    })

    t.test("case with both route and query params", function(t) {
      agent.on('transactionFinished', function(transaction) {
        t.ok(transaction.trace, 'transaction has a trace.')
        var attributes = transaction.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
        t.equal(
          attributes['request.parameters.id'], '1337',
          'Trace attributes include `id` route param'
        )
        t.equal(
          attributes['request.parameters.name'], 'hapi',
          'Trace attributes include `name` query param'
        )
      })

      server.route({
        method: 'GET',
        path: '/test/{id}/',
        handler: function(req, reply) {
          t.ok(agent.getTransaction(), "transaction is available")

          reply({status: 'ok'})
        }
      })

      server.start(function() {
        port = server.info.port
        makeRequest(t, 'http://localhost:' + port + '/test/1337/?name=hapi')
      })
    })
  })
}

function makeRequest(t, uri) {
  var params = {
    uri: uri,
    json: true
  }
  request.get(params, function(err, res, body) {
    t.equal(res.statusCode, 200, "nothing exploded")
    t.deepEqual(body, {status: 'ok'}, "got expected response")
    t.end()
  })
}
