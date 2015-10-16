require 'spec_helper'

describe Binnacle::Client do
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
    it 'invokes the events api recents', :vcr do
      client.recents(10, 500, 'icoc0tnol3obe8pas207')

      expect(a_request(:get, 'http://localhost:8080/api/endpoints'))
      expect(
        a_request(:get, "http://localhost:8080/api/events/icoc0tnol3obe8pas207/recents?limit=10&since=500")
      ).to(have_been_made.times(1))
    end
  end
end
