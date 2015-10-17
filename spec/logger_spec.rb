require 'spec_helper'

describe Binnacle::Logging do
  let(:logger) {
    Binnacle.configuration.asynch_logging = false
    Binnacle::Logging.build('vceth4xcwqfoowpz2esi', '1grttyb8ozbe9axt88ji', 'localhost', 'icoc0tnol3obe8pas207')
  }

  describe 'logging' do

    it 'invokes the events api signal', :vcr do
      logger.info("This is an info message")

      expect(a_request(:get, 'http://localhost:8080/api/endpoints'))
      expect(
        a_request(:post, "http://localhost:8080/api/events/icoc0tnol3obe8pas207").
        with(body: hash_including({
          "contextId": "icoc0tnol3obe8pas207",
          "eventName": "log",
          "logLevel": "INFO",
          "json": { "message": "This is an info message" }
          })
        )
      ).to(have_been_made.times(1))
    end
  end
end
