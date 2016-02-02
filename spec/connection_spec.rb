require 'spec_helper'

describe Binnacle::Connection do

  describe 'initialize', :vcr do
    before { Binnacle.logger = TestLogger.new }

    it 'fails with incorrect credentials', :vcr do
      expected_output = "ERROR -- : Error communicating with Binnacle: Credentials are required to access this resource."
      connection = Binnacle::Connection.new('vceth4xcwqfoowpz2esi', '1grttyb8ozbe9axt88ji', 'http://104.131.46.61:8080')
      expect(a_request(:get, 'http://104.131.46.61:8080/api/endpoints'))
      expect(Binnacle.logger.messages).to include(expected_output)
    end

    it 'retrieves available endpoints upon successful connection', :vcr do
      connection = Binnacle::Connection.new('863u7fzchvjx2oiclasx', '33lrt5aiizizhu5z7f3b', 'http://104.131.46.61:8080')
      expect(a_request(:get, 'http://104.131.46.61:8080/api/endpoints'))
      expect(Binnacle.configuration.urls).to include('http://104.131.41.123:8080',
                                                     'http://104.236.110.41:8080',
                                                     'http://104.131.46.61:8080',
                                                     'http://104.131.106.113:8080',
                                                     'http://45.55.141.159:8080',
                                                     'http://104.131.75.74:8080')
    end

    it 'fails with bad endpoint', :vcr do
      expected_output = %[ERROR -- : Error communicating with Binnacle: Connection refused - connect(2) for "localhost" port 8888 (localhost:8888)]
      connection = Binnacle::Connection.new('vceth4xcwqfoowpz2esi', '1grttyb8ozbe9axt88ji', 'http://localhost:8888')
      expect(a_request(:get, 'http://localhost:8888/api/endpoints'))
      expect(Binnacle.logger.messages).to include(expected_output)
    end
  end

end
