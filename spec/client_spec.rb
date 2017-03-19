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
          "channelId": "icoc0tnol3obe8pas207",
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

  describe '#ready?' do
    before { Binnacle.binnacle_logger.pause }
    after  { Binnacle.binnacle_logger.continue }

    it 'returns true if a connection has been successfully established', :vcr do
      Binnacle.configure do |config|
        config.endpoint = 'localhost'
        config.api_key = 'vceth4xcwqfoowpz2esi'
        config.api_secret = '1grttyb8ozbe9axt88ji'
      end

      expect(Binnacle.client.ready?).to be true
    end
  end

  describe 'signal_asynch' do
    it 'invokes the events api signal', :vcr do
      client.signal_asynch('icoc0tnol3obe8pas207', 'ASYNCH_TEST_EVT', 'binnacle-rb', 'My Sess', 'INFO')

      expect(a_request(:get, 'http://localhost:8080/api/endpoints'))
      wait_for(
        a_request(:post, "http://localhost:8080/api/events/icoc0tnol3obe8pas207").
        with(body: hash_including({
          "channelId": "icoc0tnol3obe8pas207",
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

  describe 'events' do
    before { @events = client.events('icoc0tnol3obe8pas207', '2015-12-29', 8, 9, 500) }

    it 'invokes the events api', :vcr do
      expect(a_request(:get, 'http://localhost:8080/api/endpoints'))
      expect(
        a_request(:get, "http://localhost:8080/api/events/icoc0tnol3obe8pas207/2015-12-29?end_hour=9&limit=500&start_hour=8")
      ).to(have_been_made.times(1))
    end

    it 'returns a collection of event objects', :vcr do
      expect(@events).to have(40).events
      expect(@events).to all(satisfy { |e| e.event_time.strftime("%Y-%m-%d") == '2015-12-29' })
    end

  end

  describe 'report_exception' do
    before { Binnacle.binnacle_logger.pause }
    after  { Binnacle.binnacle_logger.continue }

    it 'invokes the events api signal', :vcr do

      Binnacle.configure do |config|
        config.error_channel = 'id0czm8eryfffcgp875c'
        config.encrypted = false
      end

      exception = ZeroDivisionError.new
      env = Rack::MockRequest.env_for(client.connection.active_url)
      client.report_exception(exception, env, false)

      expect(a_request(:get, 'http://localhost:8080/api/endpoints'))
      expect(
        a_request(:post, "http://localhost:8080/api/events/id0czm8eryfffcgp875c").
        with(body: hash_including({
          "channelId": "id0czm8eryfffcgp875c",
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
