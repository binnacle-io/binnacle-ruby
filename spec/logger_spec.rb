require 'spec_helper'

describe Binnacle::Logging do
  before { Binnacle.configuration.asynch_logging = false }

  let(:logger) {
    Binnacle::Logging.build('vceth4xcwqfoowpz2esi', '1grttyb8ozbe9axt88ji', 'localhost', 'icoc0tnol3obe8pas207')
  }

  describe 'logging' do
    it 'invokes the events api signal', :vcr do
      logger.info("This is an info message")

      expect(a_request(:get, 'http://localhost:8080/api/endpoints'))
      expect(
        a_request(:post, "http://localhost:8080/api/events/icoc0tnol3obe8pas207").
        with(body: hash_including({
          "channelId": "icoc0tnol3obe8pas207",
          "eventName": "log",
          "logLevel": "INFO",
          "json": { "message": "This is an info message" }
          })
        )
      ).to(have_been_made.times(1))
    end

    it 'respects the logger severity', :vcr do
      logger.debug("This is an debug message")

      expect(a_request(:get, 'http://localhost:8080/api/endpoints'))
      expect(
        a_request(:post, "http://localhost:8080/api/events/icoc0tnol3obe8pas207").
        with(body: hash_including({
          "channelId": "icoc0tnol3obe8pas207",
          "eventName": "log",
          "logLevel": "DEBUG",
          "json": { "message": "This is an debug message" }
          })
        )
      ).to(have_been_made.times(1))
    end

    it 'allows passing other parameters using a hash', :vcr do
      logger.info(session_id: '8675309', event_name: 'failed_transfer') { 'transfer failed, bad RTN' }

      expect(a_request(:get, 'http://localhost:8080/api/endpoints'))
      expect(
        a_request(:post, "http://localhost:8080/api/events/icoc0tnol3obe8pas207").
        with(body: hash_including({
          "channelId": "icoc0tnol3obe8pas207",
          "sessionId": "8675309",
          "eventName": "failed_transfer",
          "logLevel": "INFO",
          "json": { "message": "transfer failed, bad RTN" }
          })
        )
      ).to(have_been_made.times(1))
    end
  end
end
