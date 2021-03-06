require 'spec_helper'

describe Binnacle::Client do
  before do 
    reset_env 
    Binnacle.configure do |config|
      config.encrypted = false
    end
  end
  let(:client) { Binnacle::Client.new('vceth4xcwqfoowpz2esi', '1grttyb8ozbe9axt88ji', 'localhost') }

  describe 'signal' do
    it 'invokes the events api signal', :vcr do
      client.signal('icoc0tnol3obe8pas207', 'TEST_EVT', 'binnacle-rb', 'My Sess', 'INFO', 'development')

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
        a_request(:get, "http://localhost:8080/api/events/icoc0tnol3obe8pas207/production/recents?limit=10&since=500")
      ).to(have_been_made.times(1))
    end

    it 'returns a collection of event objects', :vcr do
      expect(@recents).to have(1).events
    end
  end

  describe 'events' do
    before { 
      @events = client.events('icoc0tnol3obe8pas207', '2017-07-06', 11, 12, 500) 
    }

    it 'invokes the events api', :vcr do
      expect(a_request(:get, 'http://localhost:8080/api/endpoints'))
      expect(
        a_request(:get, "http://localhost:8080/api/events/icoc0tnol3obe8pas207/production/2017-07-06?end_hour=12&limit=500&start_hour=11")
      ).to(have_been_made.times(1))
    end

    it 'returns a collection of event objects', :vcr do
      expect(@events).to have(1).events
      expect(@events).to all(satisfy { |e| e.event_time.strftime("%Y-%m-%d") == '2017-07-06' })
    end

  end
end
