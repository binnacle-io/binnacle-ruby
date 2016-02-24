require 'spec_helper'

describe Binnacle do
  describe 'configure' do
    before do
      reset_env
      Binnacle.binnacle_logger.pause
    end

    after { Binnacle.binnacle_logger.continue }

    it 'creates a module-level instance of a binnacle client', :vcr do
      Binnacle.configure do |config|
        config.endpoint = 'localhost'
        config.api_key = 'vceth4xcwqfoowpz2esi'
        config.api_secret = '1grttyb8ozbe9axt88ji'
        config.encrypted = false
      end

      expect(a_request(:get, 'http://localhost:8080/api/endpoints'))
      expect(Binnacle.client).to_not be_nil
    end

    it 'can be configured via a hash of options', :vcr do
      Binnacle.configure(endpoint: 'localhost',
                         api_key: 'vceth4xcwqfoowpz2esi',
                         api_secret: '1grttyb8ozbe9axt88ji')

      expect(a_request(:get, 'http://localhost:8080/api/endpoints'))
      expect(Binnacle.client).to_not be_nil
    end
  end
end
