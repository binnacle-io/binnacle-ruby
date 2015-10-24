require 'spec_helper'

describe Binnacle::Client do
  before { reset_env }
  let(:client) { Binnacle::Client.new('vceth4xcwqfoowpz2esi', '1grttyb8ozbe9axt88ji', 'localhost') }

  describe 'signal' do
    it 'invokes the events api signal', :vcr do
      client.signal('icoc0tnol3obe8pas207', 'TEST_EVT', 'binnacle-rb', 'My Sess', 'INFO')

      expect(a_request(:get, 'http://localhost:8080/api/endpoints'))
      expect(
        a_request(:post, "http://localhost:8080/api/events/icoc0tnol3obe8pas207").
        with(body: hash_including({
          "contextId": "icoc0tnol3obe8pas207",
          "sessionId": "My Sess",
          "eventName": "TEST_EVT",
          "clientId": "binnacle-rb",
          "logLevel": "INFO",
          "tags": [],
          "json": {}
          })
        )
      ).to(have_been_made.times(1))
    end
  end

  describe 'signal_asynch' do
    it 'invokes the events api signal', :vcr do
      client.signal_asynch('icoc0tnol3obe8pas207', 'ASYNCH_TEST_EVT', 'binnacle-rb', 'My Sess', 'INFO')

      expect(a_request(:get, 'http://localhost:8080/api/endpoints'))
      expect(
        a_request(:post, "http://localhost:8080/api/events/icoc0tnol3obe8pas207").
        with(body: hash_including({
          "contextId": "icoc0tnol3obe8pas207",
          "sessionId": "My Sess",
          "eventName": "ASYNCH_TEST_EVT",
          "clientId": "binnacle-rb",
          "logLevel": "INFO",
          "tags": [],
          "json": {}
          })
        )
      ).to(have_been_made.times(1))
    end
  end

  describe 'recents' do
    before { @recents = client.recents(10, 500, 'icoc0tnol3obe8pas207') }

    it 'invokes the events api recents', :vcr do
      expect(a_request(:get, 'http://localhost:8080/api/endpoints'))
      expect(
        a_request(:get, "http://localhost:8080/api/events/icoc0tnol3obe8pas207/recents?limit=10&since=500")
      ).to(have_been_made.times(1))
    end

    it 'returns a collection of event objects', :vcr do
      expect(@recents).to have(10).events
    end
  end

  describe 'report_exception' do
    before { Binnacle.logger.pause }
    after  { Binnacle.logger.continue }

    it 'invokes the events api signal', :vcr do

      Binnacle.configure do |config|
        config.error_ctx = 'id0czm8eryfffcgp875c'
      end

      exception = ZeroDivisionError.new
      env = Rack::MockRequest.env_for(client.connection.active_url)
      client.report_exception(exception, env, false)

      expect(a_request(:get, 'http://localhost:8080/api/endpoints'))
      expect(
        a_request(:post, "http://localhost:8080/api/events/id0czm8eryfffcgp875c").
        with(body: hash_including({
          "contextId": "id0czm8eryfffcgp875c",
          "eventName":"ZeroDivisionError",
          "logLevel":"EXCEPTION"
        }))
      ).to(have_been_made.times(1))

      # TODO: need a way to check nested partial hash in the body for:
      # "json": hash_including({
      #   "exception":"ZeroDivisionError",
      #   "message":"ZeroDivisionError"
      # })
    end
  end
end
